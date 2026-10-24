"""Local smoke test for hf-space/app.py (no Docker needed)."""
import io
import os
import sys
from pathlib import Path

os.environ["HF_API_SECRET"] = "test-secret"
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "hf-space"))
os.chdir(Path(__file__).resolve().parents[1] / "hf-space")

import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
import app as svc

def img_bytes(color):
    buf = io.BytesIO()
    Image.fromarray(np.full((150, 140, 3), color, np.uint8)).save(buf, "PNG")
    return buf.getvalue()

with TestClient(svc.app) as c:
    print("health:", c.get("/health").json())
    print("no-auth:", c.post("/predict/model_1", files={"file": ("a.png", img_bytes((200, 120, 150)), "image/png")}).status_code)
    print("bad-auth:", c.post("/predict/model_1", headers={"Authorization": "Bearer nope"}, files={"file": ("a.png", img_bytes((0, 0, 0)), "image/png")}).status_code)
    H = {"Authorization": "Bearer test-secret"}
    for col in [(230, 180, 200), (120, 40, 90), (0, 0, 0)]:
        r = c.post("/predict/model_1", headers=H, files={"file": ("a.png", img_bytes(col), "image/png")})
        print("predict", col, r.status_code, r.json())
    print("missing model 3:", c.post("/predict/model_3", headers=H, files={"file": ("a.png", img_bytes((1, 1, 1)), "image/png")}).status_code)
    print("bad id:", c.post("/predict/model_9", headers=H, files={"file": ("a.png", img_bytes((1, 1, 1)), "image/png")}).status_code)
    print("corrupt model 1:", c.post("/predict/model_1", headers=H, files={"file": ("a.png", b"notanimage", "image/png")}).status_code)

    # Test model_2
    root = Path(__file__).resolve().parents[1]
    normal_csv = (root / "public" / "sample-ecg" / "normal_beat.csv").read_bytes()
    pvc_csv = (root / "public" / "sample-ecg" / "ventricular_ectopic_beat.csv").read_bytes()

    print("\n--- Testing Model 2 ---")
    r_n = c.post("/predict/model_2", headers=H, files={"file": ("normal.csv", normal_csv, "text/csv")})
    print("model_2 normal (CSV):", r_n.status_code, r_n.json())

    r_v = c.post("/predict/model_2", headers=H, files={"file": ("pvc.csv", pvc_csv, "text/csv")})
    print("model_2 PVC (CSV):", r_v.status_code, r_v.json())

    # JSON payload
    import json
    samples = json.loads((root / "public" / "sample-ecg" / "samples.json").read_text())
    r_json = c.post("/predict/model_2", headers=H, json={"signal": samples["normal_beat"]})
    print("model_2 normal (JSON):", r_json.status_code, r_json.json())

    # Padding test (< 187 values)
    r_pad = c.post("/predict/model_2", headers=H, json={"signal": [0.5] * 50})
    print("model_2 padding test:", r_pad.status_code, len(r_pad.json()["signal_preview"]))
