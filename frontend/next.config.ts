import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    return [
      {
        source: "/voice/:path*",
        destination: "http://127.0.0.1:8000/voice/:path*",
      },
      {
        source: "/chat/sessions/:path*",
        destination: "http://127.0.0.1:8000/chat/sessions/:path*",
      },
      {
        source: "/chat/sessions",
        destination: "http://127.0.0.1:8000/chat/sessions",
      },
      {
        source: "/chat/stream",
        destination: "http://127.0.0.1:8000/chat/stream",
      },
      {
        source: "/mcp/:path*",
        destination: "http://127.0.0.1:8000/mcp/:path*",
      },
      {
        source: "/eval/:path*",
        destination: "http://127.0.0.1:8000/eval/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "http://127.0.0.1:8000/ingest/:path*",
      },
      {
        source: "/documents/:path*",
        destination: "http://127.0.0.1:8000/documents/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:8000/health",
      },
      {
        source: "/models",
        destination: "http://127.0.0.1:8000/models",
      },
      {
        source: "/providers",
        destination: "http://127.0.0.1:8000/providers",
      },
      {
        source: "/static/:path*",
        destination: "http://127.0.0.1:8000/static/:path*",
      },
    ];
  },
};

export default nextConfig;
