"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      setError("Please fill out all required fields.");
      return;
    }
    setLoading(true);
    setError(null);

    // Simulate account and workspace creation
    setTimeout(() => {
      setLoading(false);
      router.push("/chat");
    }, 600);
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
          Already have an account?{" "}
          <Link href="/login" className="text-[#e07a5f] hover:underline font-medium ml-1">
            Sign in
          </Link>
        </div>
      </header>

      {/* REGISTRATION CARD */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-[#1c1c1a] border border-[#2e2e2a] rounded-2xl p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[#ececeb]">
              Create your Second Brain
            </h1>
            <p className="text-sm text-[#9d9d96]">
              Instant access to multi-model routing, Supabase vector memory, and tool execution.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#b0b0a8]">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ada Lovelace"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#333330] focus:border-[#cc785c] focus:outline-none text-sm text-[#ececeb] placeholder-[#575752] transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#b0b0a8]">Workspace name</label>
                <input
                  type="text"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  placeholder="Research Lab"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#333330] focus:border-[#cc785c] focus:outline-none text-sm text-[#ececeb] placeholder-[#575752] transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#b0b0a8]">Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ada@institute.org"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#333330] focus:border-[#cc785c] focus:outline-none text-sm text-[#ececeb] placeholder-[#575752] transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#b0b0a8]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#333330] focus:border-[#cc785c] focus:outline-none text-sm text-[#ececeb] placeholder-[#575752] transition"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-[#242422] border border-[#333330] text-xs text-[#9d9d96] space-y-1">
              <div className="font-medium text-[#ececeb] flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Free Starter Plan Included
              </div>
              <p>Unlimited sessions, 54MB Supabase pgvector memory, and real-time JEV routing across all models.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-white text-sm font-medium transition shadow-sm disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Creating workspace...</span>
              ) : (
                <>
                  <span>Create Account &amp; Start Free</span>
                  <span>➔</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-[#73736c] pt-2">
            By creating an account, you agree to our{" "}
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
        Second Brain Intelligence • Built for Researchers, Engineers, and Thinkers
      </footer>
    </div>
  );
}

