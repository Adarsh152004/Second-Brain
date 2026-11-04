#!/usr/bin/env bash
set -euo pipefail

echo "==> Creating virtualenv"
python3 -m venv .venv
source .venv/bin/activate

echo "==> Installing Python dependencies"
pip install -r requirements.txt --break-system-packages

if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
fi

if ! command -v ollama >/dev/null; then
  echo "==> Installing Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
fi

echo "==> Pulling models"
ollama pull llama3.2
ollama pull nomic-embed-text

mkdir -p data/documents data/chroma

echo "==> Done. Run:"
echo "    uvicorn src.api.main:app --reload --port 8000"
echo "Then open http://localhost:8000"
