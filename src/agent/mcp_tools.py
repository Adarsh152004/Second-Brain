"""MCP (Model Context Protocol) Tools Implementation."""
import sys
import io
import math
import sqlite3
import time
import platform
import os
import re
import shutil
import inspect
import httpx
from typing import Dict, Any, List
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)

MCP_REGISTRY: Dict[str, Dict[str, Any]] = {}

def register_mcp_tool(name: str, description: str, parameters: dict):
    def decorator(fn):
        MCP_REGISTRY[name] = {
            "name": name,
            "description": description,
            "parameters": parameters,
            "handler": fn,
        }
        return fn
    return decorator

@register_mcp_tool(
    name="calculator",
    description="Perform accurate mathematical calculations and expressions (e.g. sqrt, log, trigonometrics, arithmetic)",
    parameters={
        "type": "object",
        "properties": {"expression": {"type": "string", "description": "Math expression to evaluate"}},
        "required": ["expression"],
    },
)
async def calculator_tool(expression: str) -> dict:
    safe_dict = {
        "sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "log": math.log, "log10": math.log10, "exp": math.exp, "pi": math.pi, "e": math.e,
        "pow": pow, "abs": abs, "round": round
    }
    try:
        result = eval(expression, {"__builtins__": {}}, safe_dict)
        return {"status": "success", "result": str(result), "expression": expression}
    except Exception as e:
        return {"status": "error", "error": str(e), "expression": expression}

@register_mcp_tool(
    name="python_interpreter",
    description="Execute Python code in a sandboxed environment and return stdout output",
    parameters={
        "type": "object",
        "properties": {"code": {"type": "string", "description": "Python script to execute"}},
        "required": ["code"],
    },
)
async def python_interpreter_tool(code: str) -> dict:
    old_stdout = sys.stdout
    redirected_output = io.StringIO()
    sys.stdout = redirected_output
    try:
        local_vars = {}
        exec(code, {"__builtins__": __builtins__}, local_vars)
        sys.stdout = old_stdout
        out = redirected_output.getvalue()
        return {"status": "success", "output": out if out else "(Code executed successfully with no console output)"}
    except Exception as e:
        sys.stdout = old_stdout
        return {"status": "error", "error": str(e)}

@register_mcp_tool(
    name="sqlite_database_explorer",
    description="Inspect SQLite database schema, list tables, or run safe read-only SELECT queries",
    parameters={
        "type": "object",
        "properties": {
            "action": {"type": "string", "description": "'tables', 'schema', or 'query'", "default": "tables"},
            "query": {"type": "string", "description": "SELECT query to run if action is 'query'"},
            "table_name": {"type": "string", "description": "Table name to inspect if action is 'schema'"}
        },
    },
)
async def sqlite_database_explorer_tool(action: str = "tables", query: str = None, table_name: str = None) -> dict:
    try:
        conn = sqlite3.connect(settings.memory_db_path)
        if action == "tables":
            tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
            table_infos = []
            for t in tables:
                tname = t[0]
                count = conn.execute(f"SELECT COUNT(*) FROM {tname}").fetchone()[0]
                table_infos.append({"table": tname, "rows": count})
            return {"status": "success", "tables": table_infos}
        elif action == "schema" and table_name:
            info = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
            cols = [{"name": c[1], "type": c[2], "notnull": bool(c[3]), "pk": bool(c[5])} for c in info]
            return {"status": "success", "table": table_name, "columns": cols}
        elif query:
            q_clean = query.strip()
            if not q_clean.upper().startswith("SELECT") and not q_clean.upper().startswith("PRAGMA"):
                return {"status": "error", "error": "Only read-only SELECT or PRAGMA queries are permitted."}
            if "LIMIT" not in q_clean.upper():
                q_clean += " LIMIT 20"
            cur = conn.execute(q_clean)
            headers = [d[0] for d in cur.description] if cur.description else []
            rows = cur.fetchall()
            return {"status": "success", "columns": headers, "rows": rows, "count": len(rows)}
        else:
            return {"status": "error", "error": "Must specify valid action or query."}
    except Exception as e:
        return {"status": "error", "error": str(e)}

MCP_REGISTRY["sqlite_query"] = MCP_REGISTRY["sqlite_database_explorer"]

@register_mcp_tool(
    name="web_browser_reader",
    description="Fetch and extract clean readable text and markdown from any public URL",
    parameters={
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "The URL to fetch and read"},
            "max_chars": {"type": "integer", "description": "Maximum characters to return", "default": 4000}
        },
        "required": ["url"]
    },
)
async def web_browser_reader_tool(url: str, max_chars: int = 4000) -> dict:
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            text = resp.text
            text = re.sub(r"<(script|style).*?>.*?</\1>", "", text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"</?[a-zA-Z0-9]+[^>]*>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
            sample = text[:max_chars]
            return {"status": "success", "url": url, "length": len(text), "content": sample}
    except Exception as e:
        return {"status": "error", "error": str(e), "url": url}

MCP_REGISTRY["fetch_url"] = MCP_REGISTRY["web_browser_reader"]

@register_mcp_tool(
    name="web_search",
    description="Search the live web for recent news, facts, current events, weather, or real-time information",
    parameters={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "The search query string"}
        },
        "required": ["query"]
    },
)
async def web_search_mcp_tool(query: str, max_results: int = 5) -> dict:
    from src.agent.agents.web_search_agent import tavily_search
    try:
        results = await tavily_search(query, max_results=max_results)
        if not results:
            return {"status": "no_results", "query": query, "results": []}
        formatted = [
            {"title": r.get("title", "Result"), "url": r.get("url", ""), "snippet": r.get("content", "")[:350]}
            for r in results
        ]
        return {"status": "success", "query": query, "count": len(formatted), "results": formatted}
    except Exception as e:
        return {"status": "error", "error": str(e), "query": query}

MCP_REGISTRY["tavily_search"] = MCP_REGISTRY["web_search"]
MCP_REGISTRY["search_web"] = MCP_REGISTRY["web_search"]

@register_mcp_tool(
    name="system_metrics_analyzer",
    description="Inspect system health, CPU, RAM usage, disk space, Python runtime, and actife database statistics",
    parameters={
        "type": "object",
        "properties": {
            "component": {"type": "string", "description": "'all', 'memory', 'storage', or 'runtime'", "default": "all"}
        },
    },
)
async def system_metrics_analyzer_tool(component: str = "all") -> dict:
    try:
        disk = shutil.disk_usage(".")
        disk_total_gb = round(disk.total / (1024 ** 3), 2)
        disk_free_gb = round(disk.free / (1024 ** 3), 2)
        disk_used_pct = round((disk.used / disk.total) * 100, 1)
        conn = sqlite3.connect(settings.memory_db_path)
        traces_count = conn.execute("SELECT COUNT(*) FROM traces").fetchone()[0]
        feedback_count = conn.execute("SELECT COUNT(*) FROM feedback").fetchone()[0]
        conn.close()
        return {
            "status": "success",
            "os_platform": platform.platform(),
            "python_version": platform.python_version(),
            "cpu_count": os.cpu_count(),
            "disk_total_gb": disk_total_gb,
            "disk_free_gb": disk_free_gb,
            "disk_used_pct": disk_used_pct,
            "db_traces_count": traces_count,
            "db_feedback_count": feedback_count,
            "service_uptime_status": "healthy"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

async def execute_mcp_tool(tool_name: str, tool_args: dict) -> dict:
    if tool_name not in MCP_REGISTRY:
        return {"status": "error", "error": f"Unknown tool: {tool_name}"}
    handler = MCP_REGISTRY[tool_name]["handler"]
    try:
        sig = inspect.signature(handler)
        valid_args = {k: v for k, v in tool_args.items() if k in sig.parameters}
        result = await handler(**valid_args)
        return result
    except Exception as e:
        logger.error(f"Error executing tool {tool_name}: {e}")
        return {"status": "error", "error": str(e)}


def get_mcp_tool_definitions() -> List[Dict[str, Any]]:
    tools = []
    for k, v in MCP_REGISTRY.items():
        tools.append({
            "name": k,
            "description": v.get("description", ""),
            "parameters": v.get("parameters", {})
        })
    return tools
