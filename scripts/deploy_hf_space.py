"""
Phase 3 — Deploy ./hf-space to a Hugging Face Docker Space.

  .venv-ml\\Scripts\\python.exe scripts/deploy_hf_space.py

Reads HF_TOKEN from the environment or .env.local. Generates HF_API_SECRET (once),
registers it as a Space secret, uploads the folder (model weights go via Xet/LFS),
waits for the Space to be RUNNING, verifies /health, and writes
HF_SPACE_API_URL + HF_API_SECRET back to .env.local.
"""
import os
import re
import secrets
import sys
import time
from pathlib import Path

import requests
from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"
SPACE_NAME = "diagnose-me-api"


def read_env() -> dict:
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
            if m:
                env[m.group(1)] = m.group(2)
    return env


def write_env(updates: dict) -> None:
    text = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    for k, v in updates.items():
        if re.search(rf"^{k}=.*$", text, flags=re.M):
            text = re.sub(rf"^{k}=.*$", f"{k}={v}", text, flags=re.M)
        else:
            text += f"\n{k}={v}\n"
    ENV_FILE.write_text(text, encoding="utf-8")


def main() -> None:
    env = read_env()
    token = os.environ.get("HF_TOKEN") or env.get("HF_TOKEN")
    if not token:
        sys.exit("HF_TOKEN missing (set env var or add it to .env.local)")

    api = HfApi(token=token)
    username = api.whoami()["name"]
    repo_id = f"{username}/{SPACE_NAME}"
    print(f"[hf] user={username} repo={repo_id}")

    api.create_repo(repo_id=repo_id, repo_type="space", space_sdk="docker", exist_ok=True, private=False)
    print("[hf] space ready")

    secret = env.get("HF_API_SECRET") or secrets.token_urlsafe(48)
    api.add_space_secret(repo_id=repo_id, key="HF_API_SECRET", value=secret)
    api.add_space_variable(repo_id=repo_id, key="MODEL_PRECISION", value="fp32")
    print("[hf] HF_API_SECRET registered as Space secret")

    url = f"https://{username.lower().replace('_', '-')}-{SPACE_NAME}.hf.space"
    write_env({"HF_API_SECRET": secret, "HF_SPACE_API_URL": url})
    print("[env] .env.local updated")

    commit = api.upload_folder(
        folder_path=str(ROOT / "hf-space"),
        repo_id=repo_id,
        repo_type="space",
        commit_message="Deploy Diagnose Me AI API",
        ignore_patterns=["__pycache__/*", "*.pyc", ".env*"],
    )
    print(f"[hf] uploaded: {commit}")

    # Wait for the Docker build + boot
    deadline = time.time() + 20 * 60
    stage = None
    while time.time() < deadline:
        rt = api.get_space_runtime(repo_id)
        if rt.stage != stage:
            stage = rt.stage
            print(f"[hf] stage={stage}")
        if stage == "RUNNING":
            break
        if stage in ("BUILD_ERROR", "RUNTIME_ERROR", "CONFIG_ERROR"):
            sys.exit(f"Space failed: {stage} — see https://huggingface.co/spaces/{repo_id}?logs=build")
        time.sleep(15)

    for _ in range(20):
        try:
            r = requests.get(f"{url}/health", timeout=20)
            if r.ok:
                print(f"[health] {r.json()}")
                break
        except requests.RequestException:
            pass
        time.sleep(10)

    print(f"\nSpace page : https://huggingface.co/spaces/{repo_id}\nAPI URL    : {url}")


if __name__ == "__main__":
    main()
