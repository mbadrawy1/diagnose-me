"""
Diagnose Me — AI inference microservice (Hugging Face Spaces, Docker, CPU).

Models are discovered from ./models/*.json (one metadata file per model_id).
Adding model_2 / model_3 = drop `<model_id>.onnx` + `<model_id>.json` into ./models.
"""
from __future__ import annotations

import hmac
import io
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Literal, Optional

import numpy as np
from fastapi import Depends, FastAPI, File, HTTPException, Path as PathParam, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("diagnose-me")

MODELS_DIR = Path(__file__).parent / "models"
PRECISION = os.environ.get("MODEL_PRECISION", "fp32").lower()  # fp32 | int8
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))
ALLOWED_MODEL_IDS = ("model_1", "model_2", "model_3")

# Default risk thresholds on P(disease) for binary models.
DEFAULT_RISK_THRESHOLDS = {"medium": 0.25, "high": 0.5, "critical": 0.8}

RiskLevel = Literal["low", "medium", "high", "critical"]


class PredictionResponse(BaseModel):
    model_id: str
    model_name: Optional[str] = None
    predicted_class: str
    confidence: float
    probabilities: Dict[str, float]
    risk_level: RiskLevel
    inference_ms: float


class LoadedModel:
    """Wraps an ONNX (preferred) or Keras (fallback) model plus its metadata."""

    def __init__(self, meta: Dict[str, Any]):
        self.meta = meta
        self.id: str = meta["model_id"]
        shape = meta["input_shape"]  # e.g. [null, 128, 128, 3]
        self.layout = meta.get("layout", "NHWC")
        if self.layout == "NHWC":
            self.h, self.w, self.c = shape[1], shape[2], shape[3]
        else:  # NCHW
            self.c, self.h, self.w = shape[1], shape[2], shape[3]
        self.backend = "onnx"
        self._load()

    def _onnx_path(self) -> Path:
        if PRECISION == "int8":
            int8 = MODELS_DIR / f"{self.id}.int8.onnx"
            if int8.exists():
                return int8
        fp32 = MODELS_DIR / f"{self.id}.onnx"
        return fp32 if fp32.exists() else MODELS_DIR / self.meta.get("onnx_file", "")

    def _load(self) -> None:
        path = self._onnx_path()
        if path.is_file():
            import onnxruntime as ort

            so = ort.SessionOptions()
            so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            so.intra_op_num_threads = int(os.environ.get("ORT_THREADS", "2"))
            self.session = ort.InferenceSession(str(path), so, providers=["CPUExecutionProvider"])
            self.input_name = self.session.get_inputs()[0].name
            self.file = path.name
            return
        # Fallback: native Keras model served with tensorflow-cpu
        keras_path = MODELS_DIR / self.meta.get("keras_file", f"{self.id}.keras")
        if keras_path.is_file():
            import keras  # lazy: only imported if a model needs it

            self.keras_model = keras.models.load_model(keras_path, compile=False)
            self.backend = "keras"
            self.file = keras_path.name
            return
        raise FileNotFoundError(f"No weights found for {self.id}")

    # ---------- inference ----------
    def preprocess(self, raw: bytes) -> np.ndarray:
        pp = self.meta.get("preprocessing", {})
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        img = img.convert("L" if self.c == 1 else "RGB")
        img = img.resize((self.w, self.h), Image.BILINEAR)
        x = np.asarray(img, dtype=np.float32)
        if x.ndim == 2:
            x = x[..., None]
        x = x * float(pp.get("scale", 1.0 / 255.0))
        if "mean" in pp and "std" in pp:
            x = (x - np.array(pp["mean"], np.float32)) / np.array(pp["std"], np.float32)
        if self.layout == "NCHW":
            x = np.transpose(x, (2, 0, 1))
        return x[None, ...]

    def run(self, x: np.ndarray) -> np.ndarray:
        if self.backend == "onnx":
            return np.asarray(self.session.run(None, {self.input_name: x})[0])
        return np.asarray(self.keras_model.predict(x, verbose=0))

    def postprocess(self, y: np.ndarray) -> Dict[str, Any]:
        y = y.reshape(-1).astype(np.float64)
        classes = self.meta["classes"]
        if self.meta.get("output_type") == "sigmoid" or y.size == 1:
            p_pos = float(np.clip(y[0], 0.0, 1.0))
            pos, neg = self.meta["positive_class"], self.meta["negative_class"]
            probs = {neg: 1.0 - p_pos, pos: p_pos}
            disease_prob = p_pos
        else:
            if self.meta.get("output_type") == "logits":
                e = np.exp(y - y.max())
                y = e / e.sum()
            probs = {c: float(p) for c, p in zip(classes, y)}
            healthy = set(self.meta.get("healthy_classes", []))
            disease_prob = float(sum(p for c, p in probs.items() if c not in healthy))
        predicted = max(probs, key=probs.get)
        return {
            "predicted_class": predicted,
            "confidence": round(probs[predicted], 6),
            "probabilities": {k: round(v, 6) for k, v in probs.items()},
            "risk_level": self.risk(disease_prob),
        }

    def risk(self, disease_prob: float) -> RiskLevel:
        t = {**DEFAULT_RISK_THRESHOLDS, **self.meta.get("risk_thresholds", {})}
        if disease_prob >= t["critical"]:
            return "critical"
        if disease_prob >= t["high"]:
            return "high"
        if disease_prob >= t["medium"]:
            return "medium"
        return "low"


MODELS: Dict[str, LoadedModel] = {}


def load_all_models() -> None:
    for meta_file in sorted(MODELS_DIR.glob("model_*.json")):
        meta = json.loads(meta_file.read_text())
        mid = meta.get("model_id", meta_file.stem)
        if mid not in ALLOWED_MODEL_IDS:
            continue
        try:
            m = LoadedModel(meta)
            dummy_shape = (1, m.h, m.w, m.c) if m.layout == "NHWC" else (1, m.c, m.h, m.w)
            m.run(np.zeros(dummy_shape, np.float32))  # warm-up
            MODELS[mid] = m
            log.info("Loaded %s (%s, %s)", mid, m.backend, m.file)
        except Exception:  # keep serving the other models
            log.exception("Failed to load %s", mid)


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_all_models()
    if not os.environ.get("HF_API_SECRET"):
        log.warning("HF_API_SECRET is not set — /predict will reject all requests.")
    yield


app = FastAPI(title="Diagnose Me AI API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

bearer = HTTPBearer(auto_error=False)


def require_token(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> None:
    secret = os.environ.get("HF_API_SECRET")
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Server auth not configured")
    if creds is None or creds.scheme.lower() != "bearer" or not hmac.compare_digest(
        creds.credentials.encode(), secret.encode()
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing bearer token",
                            headers={"WWW-Authenticate": "Bearer"})


@app.get("/")
def root():
    return {"service": "Diagnose Me AI API", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": len(MODELS), "models": sorted(MODELS)}


@app.get("/models", dependencies=[Depends(require_token)])
def list_models():
    return {
        mid: {
            "name": m.meta.get("name"),
            "description": m.meta.get("description"),
            "modality": m.meta.get("modality"),
            "classes": m.meta.get("classes"),
            "input_shape": m.meta.get("input_shape"),
            "backend": m.backend,
            "file": m.file,
        }
        for mid, m in MODELS.items()
    }


@app.post("/predict/{model_id}", response_model=PredictionResponse, dependencies=[Depends(require_token)])
async def predict(
    model_id: str = PathParam(..., pattern=r"^model_[123]$"),
    file: UploadFile = File(...),
):
    model = MODELS.get(model_id)
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model_id} is not available")

    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large")
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")

    try:
        x = model.preprocess(raw)
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported or corrupt image")

    t0 = time.perf_counter()
    y = model.run(x)
    ms = (time.perf_counter() - t0) * 1000
    result = model.postprocess(y)
    return PredictionResponse(model_id=model_id, model_name=model.meta.get("name"), inference_ms=round(ms, 2), **result)
