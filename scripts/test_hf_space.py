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
    print("missing model:", c.post("/predict/model_2", headers=H, files={"file": ("a.png", img_bytes((1, 1, 1)), "image/png")}).status_code)
    print("bad id:", c.post("/predict/model_9", headers=H, files={"file": ("a.png", img_bytes((1, 1, 1)), "image/png")}).status_code)
    print("corrupt:", c.post("/predict/model_1", headers=H, files={"file": ("a.png", b"notanimage", "image/png")}).status_code)
