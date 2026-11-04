"""App settings loaded from .env."""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # LLM Provider Selection
    llm_backend: str = "auto"  # auto | groq | gemini | openrouter | mistral | huggingface | cloudflare | vercel | ollama

    # Groq
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    # Google Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    # OpenRouter (Multi-model hub)
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.0-flash-exp:free"

    # Mistral AI
    mistral_api_key: str = ""
    mistral_model: str = "mistral-small-latest"

    # Hugging Face
    hf_api_token: str = ""
    hf_model: str = "meta-llama/Llama-3.2-3B-Instruct"

    # Cloudflare Workers AI
    cf_account_id: str = ""
    cf_api_token: str = ""
    cf_model: str = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"

    # Vercel AI Gateway / Custom OpenAI compatible
    vercel_ai_key: str = ""
    vercel_ai_url: str = "https://gateway.ai.cloudflare.com/v1"
    custom_openai_url: str = ""
    custom_openai_key: str = ""
    custom_openai_model: str = "gpt-4o-mini"

    # TypeSafe AI Jev Decision Engine
    jev_api_key: str = ""
    typesafe_api_key: str = ""
    typesafe_model: str = "jev-latest"
    typesafe_api_url: str = "https://api.typesafe.ai/v1"

    # Ollama (Local)
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # Embeddings (Cohere)
    embedding_backend: str = "cohere"
    cohere_api_key: str = "pGtPiOsqJ3BGiknF4nlJSDApaB3aku1ZPzFyWq6o"
    cohere_embed_model: str = "embed-english-v3.0"
    embedding_dim: int = 1024

    # Web Search (Tavily)
    tavily_api_key: str = ""
    enable_tavily: bool = True

    # MCP (Model Context Protocol)
    enable_mcp_tools: bool = True
    mcp_allow_code_exec: bool = True
    mcp_allow_fs: bool = True

    # Chunking & Retrieval
    chunk_size: int = 800
    chunk_overlap: int = 150
    retrieval_top_k: int = 5

    # Storage
    chroma_path: str = "./data/chroma"
    documents_path: str = "./data/documents"
    memory_db_path: str = "./data/memory.db"
    memory_max_turns: int = 30
    max_upload_mb: int = 30

    # Server
    uvicorn_host: str = "0.0.0.0"
    uvicorn_port: int = 8000
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
