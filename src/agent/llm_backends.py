"""Multi-Provider LLM Backends & Streaming Routing Engine."""
import os
import time
import json
import httpx
from typing import AsyncGenerator, Dict, Any, List, Optional, Tuple
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)

PROVIDERS = [
    {
        "id": "groq",
        "name": "Groq LPU",
        "model": getattr(settings, 'groq_model', 'openai/gpt-oss-120b'),
        "badge": "Ultra Fast",
        "color": "#f97316",
        "best_for": "Ultra-low latency streaming, agents, coding",
    },
    {
        "id": "gemini",
        "name": "Google Gemini",
        "model": getattr(settings, 'gemini_model', 'gemini-1.5-flash'),
        "badge": "Multimodal & Long Context",
        "color": "#3b82f6",
        "best_for": "Long documents, reasoning, multimodal analysis",
    },
    {
        "id": "openrouter",
        "name": "OpenRouter Hub",
        "model": getattr(settings, 'openrouter_model', 'google/gemini-2.0-flash-exp:free'),
        "badge": "Multi-Model Hub",
        "color": "#8b5cf6",
        "best_for": "Access to 100+ open & proprietary models",
    },
    {
        "id": "mistral",
        "name": "Mistral AI",
        "model": getattr(settings, 'mistral_model', 'mistral-small-latest'),
        "badge": "Reasoning & Code",
        "color": "#06b6d4",
        "best_for": "European AI, concise coding, structured output",
    },
    {
        "id": "cloudflare",
        "name": "Cloudflare Workers AI",
        "model": getattr(settings, 'cf_model', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'),
        "badge": "Serverless Edge",
        "color": "#f59e0b",
        "best_for": "Zero cold start, edge execution, global CDN",
    },
    {
        "id": "ollama",
        "name": "Ollama (Local)",
        "model": getattr(settings, 'ollama_model', 'llama3.2'),
        "badge": "Local & Private",
        "color": "#10b981",
        "best_for": "100% offline, privacy, zero cost",
    },
]

def get_available_providers() -> List[Dict[str, Any]]:
    return PROVIDERS

class LLMBackend:
    name: str = "base"
    async def chat(self, messages: list[dict], system: str = None, model: str = None) -> str:
        raise NotImplementedError
    async def stream_chat(self, messages: list[dict], system: str = None, model: str = None) -> AsyncGenerator[str, None]:
        res = await self.chat(messages, system=system, model=model)
        for token in res.split(" "):
            yield token + " "

class GroqBackend(LLMBackend):
    name = "groq"

    def _resolve_model(self, model: str = None) -> str:
        m = model or getattr(settings, 'groq_model', 'openai/gpt-oss-120b')
        if m in ['auto', 'default']:
            return 'openai/gpt-oss-120b'
        return m

    async def chat(self, messages: list[dict], system: str = None, model: str = None) -> str:
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is not configured.")
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        req_model = self._resolve_model(model)
        headers = {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json={"model": req_model, "messages": all_msgs, "temperature": 0.7, "max_tokens": 2048},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def stream_chat(self, messages: list[dict], system: str = None, model: str = None) -> AsyncGenerator[str, None]:
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is not configured.")
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        req_model = self._resolve_model(model)
        headers = {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                "https://api.groq.com/openai/v1/chat/completions",
                json={"model": req_model, "messages": all_msgs, "temperature": 0.7, "max_tokens": 2048, "stream": True},
                headers=headers
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            pass

class GeminiBackend(LLMBackend):
    name = "gemini"

    async def chat(self, messages: list[dict], system: str = None, model: str = None) -> str:
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")
        contents = []
        if system:
            contents.append({"role": "user", "parts": [{"text": f"System instruction: {system}"}]})
            contents.append({"role": "model", "parts": [{"text": "Understood."}]})
        for m in messages:
            role = "user" if m["role"] in ["user", "system"] else "model"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
        req_model = 'gemini-flash-lite-latest' if (not model or model in ['gemini-1.5-flash', 'gemini-2.5-flash', 'auto', 'default']) else model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{req_model}:generateContent?key={settings.gemini_api_key}"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json={"contents": contents})
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    async def stream_chat(self, messages: list[dict], system: str = None, model: str = None) -> AsyncGenerator[str, None]:
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")
        contents = []
        if system:
            contents.append({"role": "user", "parts": [{"text": f"System instruction: {system}"}]})
            contents.append({"role": "model", "parts": [{"text": "Understood."}]})
        for m in messages:
            role = "user" if m["role"] in ["user", "system"] else "model"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
        req_model = 'gemini-flash-lite-latest' if (not model or model in ['gemini-1.5-flash', 'gemini-2.5-flash', 'auto', 'default']) else model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{req_model}:streamGenerateContent?key={settings.gemini_api_key}&alt=sse"
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json={"contents": contents}) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        try:
                            chunk = json.loads(data_str)
                            cands = chunk.get("candidates", [])
                            if cands:
                                parts = cands[0].get("content", {}).get("parts", [])
                                for p in parts:
                                    t = p.get("text", "")
                                    if t:
                                        yield t
                        except Exception:
                            pass

class OpenRouterBackend(LLMBackend):
    name = "openrouter"

    async def chat(self, messages: list[dict], system: str = None, model: str = None) -> str:
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured.")
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "HTTP-Referer": "https://secondbrain.ai",
            "X-Title": "Second Brain",
            "Content-Type": "application/json",
        }
        req_model = model or getattr(settings, 'openrouter_model', 'google/gemini-2.0-flash-exp:free')
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json={"model": req_model, "messages": all_msgs, "max_tokens": 2048},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def stream_chat(self, messages: list[dict], system: str = None, model: str = None) -> AsyncGenerator[str, None]:
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured.")
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "HTTP-Referer": "https://secondbrain.ai",
            "X-Title": "Second Brain",
            "Content-Type": "application/json",
        }
        req_model = model or getattr(settings, 'openrouter_model', 'google/gemini-2.0-flash-exp:free')
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                "https://openrouter.ai/api/v1/chat/completions",
                json={"model": req_model, "messages": all_msgs, "max_tokens": 2048, "stream": True},
                headers=headers
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            pass

class MistralBackend(LLMBackend):
    name = "mistral"

    async def chat(self, messages: list[dict], system: str = None, model: str = None) -> str:
        if not settings.mistral_api_key:
            raise ValueError("MISTRAL_API_KEY is not configured.")
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        headers = {"Authorization": f"Bearer {settings.mistral_api_key}", "Content-Type": "application/json"}
        req_model = model or getattr(settings, 'mistral_model', 'mistral-small-latest')
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                json={"model": req_model, "messages": all_msgs, "max_tokens": 2048, "temperature": 0.7},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def stream_chat(self, messages: list[dict], system: str = None, model: str = None) -> AsyncGenerator[str, None]:
        if not settings.mistral_api_key:
            raise ValueError("MISTRAL_API_KEY is not configured.")
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        headers = {"Authorization": f"Bearer {settings.mistral_api_key}", "Content-Type": "application/json"}
        req_model = model or getattr(settings, 'mistral_model', 'mistral-small-latest')
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                "https://api.mistral.ai/v1/chat/completions",
                json={"model": req_model, "messages": all_msgs, "max_tokens": 2048, "temperature": 0.7, "stream": True},
                headers=headers
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            pass

class CloudflareBackend(LLMBackend):
    name = "cloudflare"

    async def chat(self, messages: list[dict], system: str = None, model: str = None) -> str:
        token = getattr(settings, 'cf_api_token', getattr(settings, 'cloudflare_api_token', ''))
        acc_id = getattr(settings, 'cf_account_id', getattr(settings, 'cloudflare_account_id', ''))
        if not token or not acc_id:
            raise ValueError("Cloudflare credentials not configured.")
        req_model = model or getattr(settings, 'cf_model', getattr(settings, 'cloudflare_model', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'))
        url = f"https://api.cloudflare.com/client/v4/accounts/{acc_id}/ai/run/{req_model}"
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json={"messages": all_msgs}, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data.get("result", {}).get("response", "")

    async def stream_chat(self, messages: list[dict], system: str = None, model: str = None) -> AsyncGenerator[str, None]:
        res = await self.chat(messages, system=system, model=model)
        for token in res.split(" "):
            yield token + " "

class OllamaBackend(LLMBackend):
    name = "ollama"

    async def chat(self, messages: list[dict], system: str = None, model: str = None) -> str:
        host = getattr(settings, 'ollama_host', getattr(settings, 'ollama_base_url', 'http://localhost:11434'))
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        req_model = model or getattr(settings, 'ollama_model', 'llama3.2')
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{host}/api/chat",
                json={"model": req_model, "messages": all_msgs, "stream": False},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")

    async def stream_chat(self, messages: list[dict], system: str = None, model: str = None) -> AsyncGenerator[str, None]:
        host = getattr(settings, 'ollama_host', getattr(settings, 'ollama_base_url', 'http://localhost:11434'))
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        req_model = model or getattr(settings, 'ollama_model', 'llama3.2')
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{host}/api/chat",
                json={"model": req_model, "messages": all_msgs, "stream": True}
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if line:
                        try:
                            chunk = json.loads(line)
                            content = chunk.get("message", {}).get("content", "")
                            if content:
                                yield content
                        except Exception:
                            pass

BACKENDS: Dict[str, LLMBackend] = {
    "groq": GroqBackend(),
    "gemini": GeminiBackend(),
    "openrouter": OpenRouterBackend(),
    "mistral": MistralBackend(),
    "cloudflare": CloudflareBackend(),
    "ollama": OllamaBackend(),
}

def get_backend(name: str) -> LLMBackend:
    return BACKENDS.get((name or "").lower(), BACKENDS["groq"])

async def route_chat(
    messages: list[dict],
    system: str = None,
    preferred_backend: str = None,
    model: str = None,
) -> Tuple[str, str, str]:
    priority = []
    if preferred_backend and preferred_backend.lower() in BACKENDS:
        priority.append(preferred_backend.lower())
    for b in ["groq", "gemini", "openrouter", "mistral", "cloudflare", "ollama"]:
        if b not in priority:
            priority.append(b)

    last_error = None
    for b_name in priority:
        try:
            backend = BACKENDS[b_name]
            resp = await backend.chat(messages, system=system, model=model)
            return resp, b_name, model or getattr(backend, 'name', 'default')
        except Exception as e:
            last_error = e
            logger.warn(f"Backend {b_name} failed: {e}. Falling back...")
    raise RuntimeError(f"All LLM backends failed. Last error: {last_error}")

async def stream_route_chat(
    messages: list[dict],
    system: str = None,
    preferred_backend: str = None,
    model: str = None,
) -> AsyncGenerator[Tuple[str, str, str], None]:
    priority = []
    if preferred_backend and preferred_backend.lower() in BACKENDS:
        priority.append(preferred_backend.lower())
    for b in ["groq", "gemini", "openrouter", "mistral", "cloudflare", "ollama"]:
        if b not in priority:
            priority.append(b)

    last_error = None
    for b_name in priority:
        try:
            backend = BACKENDS[b_name]
            yielded_any = False
            async for token in backend.stream_chat(messages, system=system, model=model):
                yielded_any = True
                yield (token, b_name, model or getattr(backend, 'name', 'default'))
            if yielded_any:
                return
        except Exception as e:
            last_error = e
            logger.warn(f"Streaming backend {b_name} failed: {e}. Falling back...")
    raise RuntimeError(f"All LLM streaming backends failed. Last error: {last_error}")

async def get_llm_response(prompt: Any, system: str = None, preferred_backend: str = None, model: str = None) -> Tuple[str, str]:
    if isinstance(prompt, str):
        msgs = [{"role": "user", "content": prompt}]
    elif isinstance(prompt, list):
        msgs = prompt
    else:
        msgs = [{"role": "user", "content": str(prompt)}]
    resp, backend, _ = await route_chat(msgs, system=system, preferred_backend=preferred_backend, model=model)
    return resp, backend
