"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { apiPost } from "@/app/api";

export default function TimesheetsPage() {
  const [monthKey, setMonthKey] = useState("2025-12");
  const [rowsText, setRowsText] = useState("Alice, 120\nBob, 98.5");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  function parseRows() {
    return rowsText
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(",").map(s => s.trim());
        if (parts.length < 2) throw new Error(`Invalid format: "${line}"`);
        const hasIdColumn = parts.length >= 3;
        const name = hasIdColumn ? parts[1] : parts[0];
        const hours = Number(hasIdColumn ? parts[2] : parts[1]);
        if (!name || Number.isNaN(hours)) throw new Error(`Invalid data: "${line}"`);
        return { name, hours };
      });
  }

  async function ingest() {
    setErr(null); setOk(null);
    setLoading(true);
    try {
      const rows = parseRows();
      const resp = await apiPost("/timesheets/ingest", { month_key: monthKey, rows });
      setOk(resp);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Timesheets</h2>
          <p className="text-slate-400">Ingest hours for invoice generation</p>
        </div>

        {/* Ingest Timesheet */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm p-8">
          <h3 className="text-lg font-semibold text-white mb-4">Ingest Timesheet Data</h3>
          <p className="text-sm text-slate-400 mb-4">Paste hours as: <code className="text-blue-300 bg-slate-950/50 px-2 py-1 rounded">Name, Hours</code> or <code className="text-blue-300 bg-slate-950/50 px-2 py-1 rounded">ID, Name, Hours</code> (one per line)</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Month</label>
              <input
                className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                value={monthKey}
                onChange={e => setMonthKey(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Hours Data</label>
              <textarea
                className="w-full h-48 rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
                value={rowsText}
                onChange={e => setRowsText(e.target.value)}
                placeholder="Alice, 120&#10;Bob, 98.5&#10;Charlie, 110"
              />
            </div>

            <button
              onClick={ingest}
              disabled={loading}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
            >
              {loading ? "Processing..." : "Ingest Timesheet"}
            </button>
          </div>

          {err && (
            <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <strong>Error:</strong> {err}
            </div>
          )}
          
          {ok && (
            <div className="mt-4 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <strong>Success!</strong>
              <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(ok, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
