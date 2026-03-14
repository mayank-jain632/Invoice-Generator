"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { apiGet, apiPost } from "@/app/api";

type SummaryCard = { label: string; value: number };
type CompanyBalance = { company: string; total_amount: number; paid_amount: number; outstanding_amount: number };
type VendorBalance = { vendor: string; total_amount: number; sent_count: number };
type PairBalance = {
  invoice_id: number;
  pair_sheet_id: number;
  vendor_name: string;
  company_name: string;
  month_key: string;
  total_amount: number;
  sent: boolean;
  paid: boolean;
};
type EarningsPoint = { month_key: string; total_amount: number };

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function linePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export default function AnalyticsPage() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [summary, setSummary] = useState<SummaryCard[]>([]);
  const [companyBalances, setCompanyBalances] = useState<CompanyBalance[]>([]);
  const [vendorBalances, setVendorBalances] = useState<VendorBalance[]>([]);
  const [pairBalances, setPairBalances] = useState<PairBalance[]>([]);
  const [earnings, setEarnings] = useState<EarningsPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, companyData, vendorData, pairData, earningsData] = await Promise.all([
        apiGet<SummaryCard[]>(`/analytics/summary?month_key=${encodeURIComponent(monthKey)}`),
        apiGet<CompanyBalance[]>(`/analytics/company-balances?month_key=${encodeURIComponent(monthKey)}`),
        apiGet<VendorBalance[]>(`/analytics/vendor-balances?month_key=${encodeURIComponent(monthKey)}`),
        apiGet<PairBalance[]>(`/analytics/pair-balances?month_key=${encodeURIComponent(monthKey)}`),
        apiGet<EarningsPoint[]>("/analytics/earnings"),
      ]);
      setSummary(summaryData);
      setCompanyBalances(companyData);
      setVendorBalances(vendorData);
      setPairBalances(pairData);
      setEarnings(earningsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [monthKey]);

  async function togglePaid(invoiceId: number, paid: boolean) {
    try {
      await apiPost(`/combined-invoices/${invoiceId}/paid`, { paid });
      setPairBalances((current) => current.map((item) => item.invoice_id === invoiceId ? { ...item, paid } : item));
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const chart = useMemo(() => {
    const width = 720;
    const height = 240;
    const padding = 24;
    if (earnings.length === 0) {
      return { width, height, path: "", points: [] as { x: number; y: number }[] };
    }
    const ordered = [...earnings].sort((a, b) => a.month_key.localeCompare(b.month_key));
    const values = ordered.map((point) => point.total_amount);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const step = ordered.length === 1 ? 0 : (width - padding * 2) / (ordered.length - 1);
    const points = ordered.map((point, index) => ({
      x: padding + step * index,
      y: padding + (height - padding * 2) * (1 - (point.total_amount - min) / range),
    }));
    return { width, height, path: linePath(points), points };
  }, [earnings]);

  return (
    <Shell>
      <div className="space-y-6">
        <div className="rounded-[28px] border border-[var(--line)] bg-[rgba(20,28,39,0.9)] p-7">
          <div className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Analytics</div>
          <h1 className="mt-3 text-4xl font-semibold text-white">Workbook balances, not invoice sprawl.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Track what each company owes, how each vendor is performing, and which pair-month invoices are still outstanding.
          </p>
        </div>

        <div className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
          <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Month</label>
          <input
            type="month"
            value={monthKey}
            onChange={(event) => setMonthKey(event.target.value)}
            className="w-full max-w-[220px] rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.map((card) => (
            <div key={card.label} className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
              <div className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">{card.label}</div>
              <div className="mt-3 text-3xl font-semibold text-white">${card.value.toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
            <h2 className="text-lg font-semibold text-white">Company balances</h2>
            <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--line)]">
              <table className="min-w-full text-sm">
                <thead className="bg-[rgba(255,255,255,0.03)] text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3 text-right">Billed</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] bg-[rgba(10,15,22,0.92)]">
                  {companyBalances.map((row) => (
                    <tr key={row.company}>
                      <td className="px-4 py-3 text-white">{row.company}</td>
                      <td className="px-4 py-3 text-right text-white">${row.total_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-[#86efac]">${row.paid_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-[#fca5a5]">${row.outstanding_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {!loading && companyBalances.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">No company balances for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
            <h2 className="text-lg font-semibold text-white">Vendor balances</h2>
            <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--line)]">
              <table className="min-w-full text-sm">
                <thead className="bg-[rgba(255,255,255,0.03)] text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3 text-right">Billed</th>
                    <th className="px-4 py-3 text-right">Sent Sheets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] bg-[rgba(10,15,22,0.92)]">
                  {vendorBalances.map((row) => (
                    <tr key={row.vendor}>
                      <td className="px-4 py-3 text-white">{row.vendor}</td>
                      <td className="px-4 py-3 text-right text-white">${row.total_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-[var(--muted)]">{row.sent_count}</td>
                    </tr>
                  ))}
                  {!loading && vendorBalances.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-10 text-center text-[var(--muted)]">No vendor balances for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
          <h2 className="text-lg font-semibold text-white">Pair-month invoice status</h2>
          <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--line)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[rgba(255,255,255,0.03)] text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] bg-[rgba(10,15,22,0.92)]">
                {pairBalances.map((row) => (
                  <tr key={row.invoice_id}>
                    <td className="px-4 py-3 text-white">{row.vendor_name}</td>
                    <td className="px-4 py-3 text-white">{row.company_name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.month_key}</td>
                    <td className="px-4 py-3 text-right text-white">${row.total_amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs ${row.sent ? "bg-[rgba(47,125,255,0.16)] text-[#7fb0ff]" : "bg-[rgba(255,255,255,0.06)] text-[var(--muted)]"}`}>
                        {row.sent ? "Sent" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                        <input type="checkbox" checked={row.paid} onChange={(event) => togglePaid(row.invoice_id, event.target.checked)} />
                        <span>{row.paid ? "Paid" : "Open"}</span>
                      </label>
                    </td>
                  </tr>
                ))}
                {!loading && pairBalances.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">No generated sheet invoices for this month.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
          <h2 className="text-lg font-semibold text-white">Earnings trend</h2>
          {earnings.length === 0 ? (
            <div className="mt-4 text-sm text-[var(--muted)]">No earnings data yet.</div>
          ) : (
            <>
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="mt-4 h-64 w-full overflow-visible">
                <path d={chart.path} fill="none" stroke="#2f7dff" strokeWidth="3" />
                {chart.points.map((point, index) => (
                  <circle key={index} cx={point.x} cy={point.y} r="4" fill="#8cb7ff" />
                ))}
              </svg>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                {earnings.map((point) => (
                  <span key={point.month_key}>{point.month_key}: ${point.total_amount.toFixed(2)}</span>
                ))}
              </div>
            </>
          )}
        </section>

        {error && (
          <div className="rounded-[20px] border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>
    </Shell>
  );
}
