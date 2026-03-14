"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const API = process.env.NEXT_PUBLIC_API_URL || "/api";

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || "Login failed");
        setLoading(false);
        return;
      }

      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      router.push("/");
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(47,125,255,0.12),transparent_28%),linear-gradient(180deg,#0b1017,#05070b)] px-6">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--line-strong)] bg-[rgba(20,28,39,0.92)] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">InvoiceFlow</div>
          <h1 className="mt-3 text-3xl font-semibold text-white">Workbook Access</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Sign in to manage staffing sheets, combined invoices, and balances.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--muted)]">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.9)] px-4 py-3 text-white outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(47,125,255,0.2)]"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--muted)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.9)] px-4 py-3 text-white outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(47,125,255,0.2)]"
              required
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Enter Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
