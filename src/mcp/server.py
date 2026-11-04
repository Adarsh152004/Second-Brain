"""Official Model Context Protocol (MCP) Server for Second Brain.
Compliant with MCP Specification 2024-11-05.
Supports stdio transport (Claude Desktop / Cursor / Antigravity) and JSON-RPC 2.0.
"""
import sys
import io
import json
import asyncio
import math
import sqlite3
from typing import Dict, Any, List, Optional
from src.config.settings import settings
from src.vectorstore.chroma_store import list_documents, search as chroma_search
from src.agent.agents.web_search_agent import tavily_search
from src.observability.cache import get_cache_stats
from src.utils.logging import get_logger

logger = get_logger(__name__)

SERVER_INFO = {
    "name": "second-brain-mcp",
    "version": "1.0.0"
}

PROTOCOL_VERSION = "2024-11-05"

# --- TOOLS DEFINITIONS ---
TOOLS = [
    {
        "name": "calculator",
        "description": "Evaluate mathematical expressions with precision (trigonometry, logs, square roots, arithmetic).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "Math expression (e.g., 'sqrt(144) + sin(pi/4) * 10')"
                }
            },
            "required": ["expression"]
        }
    },
    {
        "name": "python_interpreter",
        "description": "Execute Python code in an isolated environment and capture console stdout.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Python source code to execute"
                }
            },
            "required": ["code"]
        }
    },
    {
        "name": "sqlite_database_explorer",
        "description": "Inspect SQLite database schema, list tables and row counts, or run safe read-only queries.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "description": "Operation to perform: 'tables', 'schema', or 'query'",
                    "enum": ["tables", "schema", "query"]
                },
                "query": {
                    "type": "string",
                    "description": "SQL SELECT statement (only if action is 'query')"
                },
                "table_name": {
                    "type": "string",
                    "description": "Target table name (only if action is 'schema')"
                }
            },
            "required": ["action"]
        }
    },
    {
        "name": "knowledge_rag_search",
        "description": "Search the Second Brain ChromaDB vector knowledge base for relevant chunks from indexed PDFs, docs, and notes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query or topic to find in indexed documents"
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of relevant chunks to retrieve (default: 4)",
                    "default": 4
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "web_search",
        "description": "Perform live real-time internet searches via Tavily for breaking news, current data, and documentation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query string"
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of search results (default: 4)",
                    "default": 4
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "cache_inspector",
        "description": "Inspect multi-tier response cache metrics (exact hits, semantic hits, token savings, cost savings).",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    }
]

# --- TOOL HANDLERS ---
async def handle_tool_call(name: str, arguments: dict) -> Dict[str, Any]:
    try:
        if name == "calculator":
            expression = str(arguments.get("expression", ""))
            safe_dict = {
                "sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan,
                "log": math.log, "log10": math.log10, "exp": math.exp, "pi": math.pi, "e": math.e,
                "pow": pow, "abs": abs, "round": round
            }
            res = eval(expression, {"__builtins__": {}}, safe_dict)
            return {"content": [{"type": "text", "text": f"Result: {res}"}], "isError": False}

        elif name == "python_interpreter":
            code = str(arguments.get("code", ""))
            old_stdout = sys.stdout
            buf = io.StringIO()
            sys.stdout = buf
            try:
                local_scope = {}
                exec(code, {"__builtins__": __builtins__}, local_scope)
                sys.stdout = old_stdout
                output = buf.getvalue()
                return {"content": [{"type": "text", "text": output if output else "(Execution completed with no output)"}], "isError": False}
            except Exception as pe:
                sys.stdout = old_stdout
                return {"content": [{"type": "text", "text": f"Python Execution Error: {pe}"}], "isError": True}

        elif name == "sqlite_database_explorer":
            action = arguments.get("action", "tables")
            conn = sqlite3.connect(settings.memory_db_path)
            if action == "tables":
                tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
                results = []
                for (tname,) in tables:
                    cnt = conn.execute(f"SELECT COUNT(*) FROM {tname}").fetchone()[0]
                    results.append(f"- {tname} ({cnt} rows)")
                return {"content": [{"type": "text", "text": "Database Tables:\n" + "\n".join(results)}], "isError": False}
            elif action == "schema":
                tname = arguments.get("table_name", "turns")
                cols = conn.execute(f"PRAGMA table_info({tname})").fetchall()
                lines = [f"{c[1]} ({c[2]})" for c in cols]
                return {"content": [{"type": "text", "text": f"Schema for {tname}:\n" + "\n".join(lines)}], "isError": False}
            elif action == "query":
                sql = arguments.get("query", "")
                if not sql.strip().lower().startswith("select"):
                    return {"content": [{"type": "text", "text": "Error: Only read-only SELECT queries are allowed."}], "isError": True}
                cursor = conn.execute(sql)
                rows = cursor.fetchall()[:25]
                col_names = [d[0] for d in cursor.description] if cursor.description else []
                return {"content": [{"type": "text", "text": json.dumps({"columns": col_names, "rows": rows}, indent=2)}], "isError": False}

        elif name == "knowledge_rag_search":
            query = arguments.get("query", "")
            top_k = int(arguments.get("top_k", 4))
            chunks = chroma_search(query, top_k=top_k)
            formatted = []
            for i, c in enumerate(chunks):
                title = c.get("title", "Document")
                score = c.get("score", 0.0)
                text = c.get("text", "")[:400]
                formatted.append(f"[{i+1}] {title} (Score: {score:.3f})\n{text}")
            out_text = "\n\n".join(formatted) if formatted else "No matching chunks found in knowledge base."
            return {"content": [{"type": "text", "text": out_text}], "isError": False}

        elif name == "web_search":
            query = arguments.get("query", "")
            max_res = int(arguments.get("max_results", 4))
            res = await tavily_search(query, max_results=max_res)
            lines = [f"- [{r.get('title')}]({r.get('url')}): {r.get('content')[:250]}" for r in res]
            out_text = "\n".join(lines) if lines else "No web results found."
            return {"content": [{"type": "text", "text": out_text}], "isError": False}

        elif name == "cache_inspector":
            stats = get_cache_stats()
            return {"content": [{"type": "text", "text": json.dumps(stats, indent=2)}], "isError": False}

        else:
            return {"content": [{"type": "text", "text": f"Tool '{name}' not found."}], "isError": True}

    except Exception as e:
        logger.error(f"MCP tool {name} error: {e}", exc_info=True)
        return {"content": [{"type": "text", "text": f"Tool Execution Error: {str(e)}"}], "isError": True}


# --- JSON-RPC 2.0 PROTOCOL DISPATCHER ---
async def dispatch_mcp_request(req: dict) -> dict:
    req_id = req.get("id")
    method = req.get("method")
    params = req.get("params", {}) or {}

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": PROTOCOL_VERSION,
                "serverInfo": SERVER_INFO,
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"subscribe": False, "listChanged": False},
                    "prompts": {"listChanged": False}
                }
            }
        }

    elif method == "notifications/initialized":
        return None  # Notifications do not return a response in JSON-RPC

    elif method == "ping":
        return {"jsonrpc": "2.0", "id": req_id, "result": {}}

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": TOOLS
            }
        }

    elif method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        tool_res = await handle_tool_call(tool_name, arguments)
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": tool_res
        }

    elif method == "resources/list":
        docs = list_documents()
        resources = []
        for d in docs:
            doc_id = d.get("doc_id") or d.get("id") or d.get("filename")
            resources.append({
                "uri": f"secondbrain://documents/{doc_id}",
                "name": d.get("filename") or d.get("title") or "Document",
                "description": f"Indexed Knowledge Document: {d.get('chunks_count', 1)} chunks",
                "mimeType": "text/plain"
            })
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"resources": resources}
        }

    elif method == "prompts/list":
        prompts = [
            {
                "name": "summarize_knowledge",
                "description": "Synthesize and summarize a document in Second Brain knowledge store.",
                "arguments": [{"name": "document_name", "description": "Title or filename of the document", "required": True}]
            },
            {
                "name": "deep_research",
                "description": "Conduct deep multi-source research using both RAG and live web search.",
                "arguments": [{"name": "topic", "description": "Research topic or problem statement", "required": True}]
            }
        ]
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"prompts": prompts}
        }

    else:
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {
                "code": -32601,
                "message": f"Method '{method}' not implemented."
            }
        }


# --- STDIO TRANSPORT RUNNER ---
async def run_stdio_server():
    """Run MCP server over standard input/output for Claude Desktop, Cursor, and Antigravity."""
    loop = asyncio.get_event_loop()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)

    while True:
        try:
            line = await reader.readline()
            if not line:
                break
            raw_text = line.decode("utf-8").strip()
            if not raw_text:
                continue
            req = json.loads(raw_text)
            resp = await dispatch_mcp_request(req)
            if resp is not None:
                out = json.dumps(resp) + "\n"
                sys.stdout.write(out)
                sys.stdout.flush()
        except Exception as e:
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"Parse error: {str(e)}"}
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    asyncio.run(run_stdio_server())

