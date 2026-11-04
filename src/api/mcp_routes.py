"""FastAPI Router exposing the Second Brain Model Context Protocol (MCP) Server over HTTP & JSON-RPC."""
import json
from fastapi import APIRouter, HTTPException, Request, Body
from pydantic import BaseModel
from typing import Dict, Any, Optional
from src.mcp.server import (
    dispatch_mcp_request,
    handle_tool_call,
    TOOLS,
    SERVER_INFO,
    PROTOCOL_VERSION,
)

router = APIRouter(prefix="/mcp", tags=["Model Context Protocol (MCP) Server"])


class MCPToolCallRequest(BaseModel):
    name: str
    arguments: Optional[Dict[str, Any]] = None


class DynamicMCPServer(BaseModel):
    name: str
    url: str
    description: Optional[str] = "External MCP Server"


EXTERNAL_SERVERS: list[dict] = []


@router.get("/info")
async def mcp_server_info():
    """Return MCP server metadata, protocol version, and active capabilities."""
    return {
        "status": "ONLINE",
        "serverInfo": SERVER_INFO,
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": {
            "tools": {"count": len(TOOLS), "list": [t["name"] for t in TOOLS]},
            "resources": {"supported": True, "scheme": "secondbrain://"},
            "prompts": {"supported": True},
            "transports": ["stdio", "http-jsonrpc", "sse"]
        }
    }


@router.get("/tools")
async def list_mcp_tools():
    """List all available MCP tools with full JSON Schemas."""
    return {"tools": TOOLS, "count": len(TOOLS)}


@router.post("/tools/call")
async def call_mcp_tool(req: MCPToolCallRequest):
    """Directly execute an MCP tool and return the output."""
    result = await handle_tool_call(req.name, req.arguments or {})
    return result


@router.post("/rpc")
async def mcp_jsonrpc_endpoint(payload: Dict[str, Any] = Body(...)):
    """Standard JSON-RPC 2.0 MCP Protocol Dispatcher."""
    response = await dispatch_mcp_request(payload)
    if response is None:
        return {"status": "ok"}
    return response


@router.get("/servers")
async def list_mcp_servers():
    """List internal Second Brain MCP server + any registered external servers."""
    return {
        "servers": [
            {
                "name": "second-brain-native",
                "type": "native",
                "url": "http://127.0.0.1:8000/mcp/rpc",
                "status": "online",
                "tools_count": len(TOOLS),
            },
            *EXTERNAL_SERVERS,
        ]
    }


@router.post("/servers")
async def register_mcp_server(srv: DynamicMCPServer):
    """Register an external MCP server endpoint."""
    item = {
        "name": srv.name,
        "type": "external",
        "url": srv.url,
        "description": srv.description,
        "status": "connected",
        "tools_count": 0,
    }
    EXTERNAL_SERVERS.append(item)
    return {"status": "registered", "server": item}

