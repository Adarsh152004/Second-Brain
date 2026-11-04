"""FastAPI application entry point."""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from src.api.chat import router as chat_router
from src.api.ingest import router as ingest_router
from src.api.voice import router as voice_router
from src.api.eval_api import router as eval_router
from src.api.mcp_routes import router as mcp_router
from src.utils.logging import get_logger

logger = get_logger(__name__)

app = FastAPI(title="Second Brain AI Assistant & Evaluation Platform", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ingest_router)
app.include_router(chat_router)
app.include_router(voice_router)
app.include_router(eval_router)
app.include_router(mcp_router)

_WEB_DIR = Path(__file__).parent.parent / "web"
app.mount("/static", StaticFiles(directory=str(_WEB_DIR)), name="static")


@app.get("/")
async def root():
    return FileResponse(str(_WEB_DIR / "index.html"))


@app.get("/health")
async def health():
    from src.config.settings import settings
    return {
        "api": "ok",
        "llm_backend": settings.llm_backend,
        "groq_configured": bool(settings.groq_api_key),
        "tavily_configured": bool(settings.tavily_api_key),
        "evaluation_system": "active",
        "observability_system": "active"
    }


@app.get("/models")
@app.get("/providers")
async def app_models():
    from src.agent.llm_backends import get_available_providers
    return {"providers": get_available_providers()}
