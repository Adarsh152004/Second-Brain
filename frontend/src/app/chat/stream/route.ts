import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

    const upstream = await fetch(`${backendUrl}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({
          type: "error",
          error: `Backend returned HTTP ${upstream.status}`,
        }),
        {
          status: upstream.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Direct unbuffered streaming proxy
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        type: "error",
        error: err.message || "Failed to reach backend streaming endpoint",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
