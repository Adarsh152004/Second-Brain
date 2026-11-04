import asyncio
import json
import uuid
from typing import AsyncGenerator

async def mock_stream_agent():
    yield {"type": "jev_decision", "decision": {"recommended_model": "llama-3.3-70b", "expected_utility": 0.92}}
    yield {"type": "tool_start", "tool": "web_search", "message": "Searching web..."}
    yield {"type": "tool_use", "tool": "web_search", "count": 2}
    for word in ["Hello", " this", " is", " streaming", " with", " Vercel", " AI", " SDK!"]:
        yield {"type": "chunk", "token": word, "content": word}
    yield {
        "type": "done",
        "trace_id": "tr-12345",
        "latency_ms": 350.2,
        "cost_usd": 0.0001,
        "sources": [{"type": "web", "title": "Test Source", "url": "https://example.com"}]
    }

async def generate_ai_sdk_stream():
    text_id = "part-0"
    text_started = False
    async for chunk in mock_stream_agent():
        ctype = chunk.get("type")
        if ctype == "jev_decision":
            yield f"data: {json.dumps({'type': 'data-jev', 'data': chunk.get('decision', {})})}\n\n"
        elif ctype == "tool_start":
            call_id = f"call_{uuid.uuid4().hex[:6]}"
            yield f"data: {json.dumps({'type': 'tool-input-available', 'toolCallId': call_id, 'toolName': chunk.get('tool', 'tool'), 'input': {}, 'title': chunk.get('message', '')})}\n\n"
        elif ctype == "tool_use":
            call_id = f"call_{uuid.uuid4().hex[:6]}"
            yield f"data: {json.dumps({'type': 'tool-output-available', 'toolCallId': call_id, 'output': chunk})}\n\n"
        elif ctype == "chunk":
            token = chunk.get("token") or chunk.get("content") or ""
            if token:
                if not text_started:
                    yield f"data: {json.dumps({'type': 'text-start', 'id': text_id})}\n\n"
                    text_started = True
                yield f"data: {json.dumps({'type': 'text-delta', 'id': text_id, 'delta': token})}\n\n"
        elif ctype == "done":
            if text_started:
                yield f"data: {json.dumps({'type': 'text-end', 'id': text_id})}\n\n"
                text_started = False
            for s in chunk.get("sources", []):
                yield f"data: {json.dumps({'type': 'source-url', 'sourceId': f'src_{uuid.uuid4().hex[:6]}', 'url': s.get('url'), 'title': s.get('title')})}\n\n"
            yield f"data: {json.dumps({'type': 'data-telemetry', 'data': {'trace_id': chunk.get('trace_id'), 'latency_ms': chunk.get('latency_ms'), 'cost_usd': chunk.get('cost_usd')}})}\n\n"

    if text_started:
        yield f"data: {json.dumps({'type': 'text-end', 'id': text_id})}\n\n"
    yield "data: [DONE]\n\n"

async def main():
    events = []
    async for line in generate_ai_sdk_stream():
        events.append(line)
    full_output = "".join(events)
    print("Generated SSE Output:")
    print(full_output)
    with open("scratch/test_ai_sdk_stream.txt", "w", encoding="utf-8") as f:
        f.write(full_output)

asyncio.run(main())
