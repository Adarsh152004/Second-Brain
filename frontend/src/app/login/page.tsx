"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setError(null);

    // Simulate authentication
    setTimeout(() => {
      setLoading(false);
      router.push("/chat");
    }, 600);
  };

  const handleOAuth = (provider: string) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push("/chat");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#141413] text-[#ececeb] flex flex-col justify-between selection:bg-[#cc785c]/30">
      {/* TOP HEADER */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-[#262624]">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-[#cc785c] flex items-center justify-center text-white font-semibold text-sm shadow-sm">
            ⎔
          </div>
          <span className="font-semibold text-base tracking-tight text-[#ececeb] group-hover:text-white transition">
            Second Brain
          </span>
        </Link>
        <div className="text-xs text-[#9d9d96]">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[#e07a5f] hover:underline font-medium ml-1">
            Sign up
          </Link>
        </div>
      </header>

      {/* LOGIN CARD */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#1c1c1a] border border-[#2e2e2a] rounded-2xl p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[#ececeb]">
              Welcome back
            </h1>
            <p className="text-sm text-[#9d9d96]">
              Sign in to your intelligent workspace and persistent memory
            </p>
          </div>

          {/* Social Logins */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => handleOAuth("Google")}
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-[#383834] bg-[#242422] hover:bg-[#2b2b28] text-sm font-medium text-[#ececeb] transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 12s.7 2.3 1.9 4.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              onClick={() => handleOAuth("GitHub")}
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-[#383834] bg-[#242422] hover:bg-[#2b2b28] text-sm font-medium text-[#ececeb] transition"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Continue with GitHub</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-[1px] bg-[#2e2e2a]"></div>
            <span className="text-[11px] uppercase tracking-wider text-[#73736c]">or with email</span>
            <div className="flex-1 h-[1px] bg-[#2e2e2a]"></div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#b0b0a8]">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#333330] focus:border-[#cc785c] focus:outline-none text-sm text-[#ececeb] placeholder-[#575752] transition"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#b0b0a8]">Password</label>
                <a href="#" className="text-xs text-[#cc785c] hover:underline">
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#333330] focus:border-[#cc785c] focus:outline-none text-sm text-[#ececeb] placeholder-[#575752] transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-white text-sm font-medium transition shadow-sm disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign in to Second Brain</span>
                  <span>➔</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-[#73736c] pt-2">
            By signing in, you agree to our{" "}
            <a href="#" className="underline hover:text-[#9d9d96]">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline hover:text-[#9d9d96]">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="py-6 px-8 text-center text-xs text-[#73736c] border-t border-[#262624]">
        Second Brain Intelligence • Grounded Knowledge &amp; Adaptive Model Routing
      </footer>
    </div>
  );
}

