---
title: Diagnose Me AI API
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
short_description: CPU inference API for the Diagnose Me health platform
---

# Diagnose Me — AI Inference API

FastAPI microservice serving the Diagnose Me diagnostic models on CPU (ONNX Runtime,
with a `tensorflow-cpu` fallback for models that can't be exported to ONNX).

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | public | `{"status":"ok","models_loaded":N}` |
| GET | `/models` | Bearer | Metadata for every loaded model |
| POST | `/predict/{model_id}` | Bearer | Multipart `file` upload → prediction |

`model_id` ∈ `model_1`, `model_2`, `model_3`.

### Response

```json
{
  "model_id": "model_1",
  "model_name": "Malaria Cell Classifier",
  "predicted_class": "Parasitized",
  "confidence": 0.97,
  "probabilities": {"Uninfected": 0.03, "Parasitized": 0.97},
  "risk_level": "critical",
  "inference_ms": 4.1
}
```

## Models

| ID | Name | Input | Output |
|---|---|---|---|
| `model_1` | Malaria Cell Classifier | 128×128 RGB, /255 | sigmoid → P(Parasitized) |
| `model_2` | _reserved_ | | |
| `model_3` | _reserved_ | | |

### Adding a model

Drop `models/model_N.onnx` + `models/model_N.json` (see `model_1.json`) and redeploy.

## Configuration (Space secrets / variables)

- `HF_API_SECRET` (**required**): bearer token expected on protected routes.
- `MODEL_PRECISION`: `fp32` (default) or `int8`.
- `ORT_THREADS`: ONNX Runtime intra-op threads (default 2).

> ⚠️ For clinical decision **support** only. Not a substitute for professional diagnosis.
