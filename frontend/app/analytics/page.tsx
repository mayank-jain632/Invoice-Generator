"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { apiGet, apiPost } from "@/app/api";

type CompanyTotal = {
  company: string;
  month_key: string;
  total_amount: number;
  paid: boolean;
};

type EarningsPoint = {
  month_key: string;
  total_amount: number;
};

function currentMonthKey() {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

function buildLinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

export default function AnalyticsPage() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [totals, setTotals] = useState<CompanyTotal[]>([]);
  const [earnings, setEarnings] = useState<EarningsPoint[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const [companyTotals, earningsSeries] = await Promise.all([
        apiGet<CompanyTotal[]>(`/analytics/company_totals?month_key=${encodeURIComponent(monthKey)}`),
        apiGet<EarningsPoint[]>("/analytics/earnings"),
      ]);
      setTotals(companyTotals);
      setEarnings(earningsSeries);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [monthKey]);

  const summary = useMemo(() => {
    const total = totals.reduce((sum, t) => sum + t.total_amount, 0);
    const paid = totals.filter(t => t.paid).reduce((sum, t) => sum + t.total_amount, 0);
    return { total, paid, outstanding: total - paid };
  }, [totals]);

  async function togglePaid(company: string, paid: boolean) {
    setErr(null);
    try {
      await apiPost("/analytics/company_totals/mark_paid", { company, month_key: monthKey, paid });
      setTotals(prev => prev.map(t => t.company === company ? { ...t, paid } : t));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  const chart = useMemo(() => {
    const width = 640;
    const height = 240;
    const padding = 24;
    const points = earnings.slice().sort((a, b) => a.month_key.localeCompare(b.month_key));
    if (points.length === 0) return { width, height, path: "", points: [] as { x: number; y: number }[] };
    const values = points.map(p => p.total_amount);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);
    const chartPoints = points.map((p, i) => ({
      x: padding + step * i,
      y: padding + (height - padding * 2) * (1 - (p.total_amount - min) / range),
    }));
    return { width, height, path: buildLinePath(chartPoints), points: chartPoints };
  }, [earnings]);

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Analytics</h2>
          <p className="text-slate-400">Track company balances and earnings over time</p>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm p-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Month</label>
          <input
            className="w-full md:w-48 rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
            type="month"
            value={monthKey}
            onChange={e => setMonthKey(e.target.value)}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total Owed</p>
            <p className="text-2xl font-semibold text-white mt-2">${summary.total.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-400">Paid</p>
            <p className="text-2xl font-semibold text-emerald-300 mt-2">${summary.paid.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-400">Outstanding</p>
            <p className="text-2xl font-semibold text-orange-300 mt-2">${summary.outstanding.toFixed(2)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-700/50">
            <h3 className="text-lg font-semibold text-white">Company Balances</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Company</th>
                  <th className="px-8 py-3 text-right text-xs font-semibold text-slate-300">Amount</th>
                  <th className="px-8 py-3 text-center text-xs font-semibold text-slate-300">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {loading ? (
                  <tr><td colSpan={3} className="px-8 py-6 text-center text-slate-400">Loading...</td></tr>
                ) : totals.length === 0 ? (
                  <tr><td colSpan={3} className="px-8 py-6 text-center text-slate-400">No invoices for this month.</td></tr>
                ) : (
                  totals.map(t => (
                    <tr key={t.company} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-8 py-4 text-sm text-white">{t.company}</td>
                      <td className="px-8 py-4 text-sm text-right text-slate-200">${t.total_amount.toFixed(2)}</td>
                      <td className="px-8 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={t.paid}
                          onChange={e => togglePaid(t.company, e.target.checked)}
                          className="rounded"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm p-8">
          <h3 className="text-lg font-semibold text-white mb-4">Earnings Over Time</h3>
          {earnings.length === 0 ? (
            <p className="text-sm text-slate-400">No invoice data yet.</p>
          ) : (
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="w-full h-64">
              <path d={chart.path} fill="none" stroke="#60A5FA" strokeWidth="2" />
              {chart.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#93C5FD" />
              ))}
            </svg>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
            {earnings.slice(-6).map(p => (
              <span key={p.month_key}>{p.month_key}: ${p.total_amount.toFixed(2)}</span>
            ))}
          </div>
        </div>

        {err && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <strong>Error:</strong> {err}
          </div>
        )}
      </div>
    </Shell>
  );
}
