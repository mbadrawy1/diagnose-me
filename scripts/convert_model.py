"""
Inspect a .keras model and convert it to a CPU-optimised ONNX model for the HF Space.

Usage:
    .venv-ml\\Scripts\\python.exe scripts/convert_model.py \
        --keras malaria_refactored_final_model.keras --model-id model_1

Outputs (in hf-space/models/):
    <model_id>.onnx          FP32 ONNX graph (reference)
    <model_id>.int8.onnx     dynamically-quantised INT8 graph (only kept if accurate)
    <model_id>.json          metadata (input shape, classes, preprocessing)
"""
import argparse
import json
import os
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
import keras
import tensorflow as tf
import tf2onnx
import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "hf-space" / "models"

# Per-model metadata. Extend this dict when model_2 / model_3 are added.
MODEL_META = {
    "model_1": {
        "name": "Malaria Cell Classifier",
        "description": "Detects Plasmodium parasites in thin blood-smear cell images.",
        "modality": "microscopy",
        "output_type": "sigmoid",          # single sigmoid unit
        "positive_class": "Parasitized",   # sigmoid -> P(Parasitized)
        "negative_class": "Uninfected",
        "classes": ["Uninfected", "Parasitized"],
        "preprocessing": {"resize": "bilinear", "color": "RGB", "scale": 1.0 / 255.0},
    }
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keras", required=True)
    ap.add_argument("--model-id", required=True)
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    model = keras.models.load_model(args.keras, compile=False)

    in_shape = tuple(model.inputs[0].shape)
    out_shape = tuple(model.outputs[0].shape)
    print(f"[inspect] input_shape={in_shape} output_shape={out_shape}")
    model.summary()

    # ---- Convert via tf.function signature (works with Keras 3 Sequential models)
    spec = (tf.TensorSpec((None, *in_shape[1:]), tf.float32, name="input"),)

    @tf.function(input_signature=spec)
    def serve(x):
        return {"output": model(x, training=False)}

    fp32_path = OUT_DIR / f"{args.model_id}.onnx"
    model_proto, _ = tf2onnx.convert.from_function(serve, input_signature=spec, opset=17)
    onnx.save(model_proto, fp32_path)
    print(f"[convert] saved {fp32_path} ({fp32_path.stat().st_size / 1e6:.1f} MB)")

    # ---- INT8 dynamic quantisation
    int8_path = OUT_DIR / f"{args.model_id}.int8.onnx"
    quantize_dynamic(str(fp32_path), str(int8_path), weight_type=QuantType.QUInt8)
    print(f"[quant]   saved {int8_path} ({int8_path.stat().st_size / 1e6:.1f} MB)")

    # ---- Parity check: Keras vs ONNX FP32 vs ONNX INT8
    rng = np.random.default_rng(0)
    x = rng.random((16, *in_shape[1:]), dtype=np.float32)
    ref = model.predict(x, verbose=0)
    so = ort.SessionOptions()
    providers = ["CPUExecutionProvider"]
    s32 = ort.InferenceSession(str(fp32_path), so, providers=providers)
    s8 = ort.InferenceSession(str(int8_path), so, providers=providers)
    in_name = s32.get_inputs()[0].name
    o32 = s32.run(None, {in_name: x})[0]
    o8 = s8.run(None, {s8.get_inputs()[0].name: x})[0]
    d32 = float(np.max(np.abs(ref - o32)))
    d8 = float(np.max(np.abs(ref - o8)))
    print(f"[parity]  max|keras-onnx_fp32|={d32:.2e}  max|keras-onnx_int8|={d8:.2e}")

    # Medical use: only prefer INT8 when it is near-lossless (<0.5% prob drift).
    # Both files are kept; app.py can be forced to INT8 with MODEL_PRECISION=int8.
    use_int8 = d8 < 0.005
    if not use_int8:
        print("[quant]   INT8 drift above 0.5% -> serving FP32 by default")

    meta = {
        "model_id": args.model_id,
        **MODEL_META.get(args.model_id, {}),
        "source_file": Path(args.keras).name,
        "onnx_file": (int8_path if use_int8 else fp32_path).name,
        "input_name": in_name,
        "input_shape": [None if d is None else int(d) for d in in_shape],
        "output_shape": [None if d is None else int(d) for d in out_shape],
        "parity_max_abs_diff": {"fp32": d32, "int8": d8 if use_int8 else None},
    }
    (OUT_DIR / f"{args.model_id}.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
