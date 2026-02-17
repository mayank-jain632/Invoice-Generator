"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { apiGet, apiPost } from "@/app/api";

type Employee = { id: number; name: string; hourly_rate: number; lifetime_hours: number; email?: string | null; preferred_vendor_id?: number | null };
type Vendor = { id: number; name: string; email: string };
type Invoice = {
  id: number; employee_id: number; month_key: string; hours: number; rate: number;
  amount: number; invoice_number: string; approved: boolean; sent: boolean;
};

export default function InvoicesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [monthKey, setMonthKey] = useState("2025-12");
  const [selectedEmp, setSelectedEmp] = useState<Record<number, boolean>>({});
  const [selectedInv, setSelectedInv] = useState<Record<number, boolean>>({});
  const [employeeVendorFilter, setEmployeeVendorFilter] = useState<string>("all");
  const [invoiceVendorFilter, setInvoiceVendorFilter] = useState<string>("all");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const [emps, activeEmps, invs, vends] = await Promise.all([
        apiGet<Employee[]>("/employees"),
        apiGet<Employee[]>(`/employees?month_key=${encodeURIComponent(monthKey)}&active_only=true`),
        apiGet<Invoice[]>("/invoices"),
        apiGet<Vendor[]>("/vendors"),
      ]);
      setEmployees(emps);
      setActiveEmployees(activeEmps);
      setInvoices(invs);
      setVendors(vends);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelectedEmp({});
    refresh();
  }, [monthKey]);

  async function generate() {
    setErr(null); setOk(null);
    const ids = activeEmployees.filter(e => selectedEmp[e.id]).map(e => e.id);
    if (ids.length === 0) {
      setErr("Select at least one employee");
      return;
    }
    try {
      const resp = await apiPost("/invoices/generate", { month_key: monthKey, employee_ids: ids });
      setOk(resp);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  function selectAllEmployees() {
    const newSelected: Record<number, boolean> = {};
    activeEmployees.forEach(e => newSelected[e.id] = true);
    setSelectedEmp(newSelected);
  }

  function deselectAllEmployees() {
    setSelectedEmp({});
  }

  function selectAllInvoices() {
    const newSelected: Record<number, boolean> = {};
    invoices.forEach(i => newSelected[i.id] = true);
    setSelectedInv(newSelected);
  }

  function deselectAllInvoices() {
    setSelectedInv({});
  }

  async function send() {
    setErr(null); setOk(null);
    const ids = invoices.filter(i => selectedInv[i.id]).map(i => i.id);
    if (ids.length === 0) {
      setErr("Select at least one invoice");
      return;
    }
    try {
      const resp = await apiPost("/invoices/send", { invoice_ids: ids });
      setOk(resp);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function sendVendor(vendorName: string, vendorInvoices: Invoice[]) {
    setErr(null); setOk(null);
    const ids = vendorInvoices.map(inv => inv.id);
    if (ids.length === 0) {
      setErr("No invoices found for this vendor");
      return;
    }
    try {
      const resp = await apiPost("/invoices/send", { invoice_ids: ids });
      setOk(resp);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function sendVendorSelected(vendorInvoices: Invoice[]) {
    setErr(null); setOk(null);
    const ids = vendorInvoices.filter(inv => selectedInv[inv.id]).map(inv => inv.id);
    if (ids.length === 0) {
      setErr("Select at least one invoice for this vendor");
      return;
    }
    try {
      const resp = await apiPost("/invoices/send", { invoice_ids: ids });
      setOk(resp);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  const getStatusBadge = (sent: boolean) => {
    if (sent) return { text: "Sent", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
    return { text: "Draft", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
  };

  return (
    <Shell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Invoices</h2>
          <p className="text-slate-400">Generate, approve, and send professional invoices</p>
        </div>

        {/* Generate Invoices Section */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm p-8">
          <h3 className="text-lg font-semibold text-white mb-6">Generate Invoices</h3>
          <div className="flex gap-3 items-end mb-6">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-300 mb-2">Month</label>
              <input
                className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                value={monthKey}
                onChange={e => setMonthKey(e.target.value)}
              />
            </div>
            <div className="w-64">
              <label className="block text-xs font-medium text-slate-300 mb-2">Filter by Vendor</label>
              <select
                className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                value={employeeVendorFilter}
                onChange={e => setEmployeeVendorFilter(e.target.value)}
              >
                <option value="all">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id.toString()}>{v.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={generate}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
            >
              Generate PDFs
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-300">Select employees:</p>
              <div className="flex gap-2">
                <button
                  onClick={selectAllEmployees}
                  className="text-xs rounded-lg border border-slate-600 px-3 py-1.5 hover:bg-slate-800/60 text-slate-200 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllEmployees}
                  className="text-xs rounded-lg border border-slate-600 px-3 py-1.5 hover:bg-slate-800/60 text-slate-200 transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {activeEmployees
                .filter(e => employeeVendorFilter === "all" || e.preferred_vendor_id?.toString() === employeeVendorFilter)
                .map(e => (
                <label
                  key={e.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/20 hover:bg-slate-800/40 cursor-pointer transition-all"
                >
                  <input
                    type="checkbox"
                    checked={!!selectedEmp[e.id]}
                    onChange={ev => setSelectedEmp({ ...selectedEmp, [e.id]: ev.target.checked })}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{e.name}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Invoices List Section */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">All Invoices</h3>
            <div className="flex gap-2 flex-wrap items-center">
              <select
                className="rounded-lg bg-slate-950/50 border border-slate-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                value={invoiceVendorFilter}
                onChange={e => setInvoiceVendorFilter(e.target.value)}
              >
                <option value="all">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
              </select>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "/api"}/invoices/download_all${token ? `?token=${encodeURIComponent(token)}` : ""}`}
                className="rounded-lg border border-slate-600 hover:border-slate-500 hover:bg-slate-800/50 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                Download All
              </a>
              <button
                onClick={selectAllInvoices}
                className="rounded-lg border border-slate-600 hover:border-slate-500 hover:bg-slate-800/50 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAllInvoices}
                className="rounded-lg border border-slate-600 hover:border-slate-500 hover:bg-slate-800/50 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                Deselect All
              </button>
              <button
                onClick={send}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                Send Selected
              </button>
              <button
                onClick={refresh}
                className="rounded-lg border border-slate-600 hover:border-slate-500 hover:bg-slate-800/50 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {loading ? (
              <div className="px-8 py-8 text-center text-slate-400">Loading...</div>
            ) : invoices.length === 0 ? (
              <div className="px-8 py-8 text-center text-slate-400">No invoices yet. Generate one above.</div>
            ) : (
              Object.entries(
                invoices.reduce<Record<string, Invoice[]>>((acc, inv) => {
                  const emp = employees.find(e => e.id === inv.employee_id);
                  const vendorName = vendors.find(v => v.id === emp?.preferred_vendor_id)?.name || "Unassigned Vendor";
                  if (invoiceVendorFilter !== "all" && vendorName !== invoiceVendorFilter) {
                    return acc;
                  }
                  acc[vendorName] = acc[vendorName] || [];
                  acc[vendorName].push(inv);
                  return acc;
                }, {})
              ).map(([vendorName, vendorInvoices]) => (
                <div key={vendorName} className="border border-slate-700/40 rounded-xl overflow-hidden">
                  <div className="px-6 py-3 bg-slate-800/40 text-sm font-semibold text-slate-200 flex items-center justify-between">
                    <span>{vendorName}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => sendVendorSelected(vendorInvoices)}
                        className="text-xs rounded-lg border border-emerald-500/40 text-emerald-300 px-3 py-1.5 hover:bg-emerald-500/10 transition-colors"
                      >
                        Send Selected
                      </button>
                      <button
                        onClick={() => sendVendor(vendorName, vendorInvoices)}
                        className="text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 transition-colors"
                      >
                        Send Vendor
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800/50 border-b border-slate-700/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 w-12">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={vendorInvoices.length > 0 && vendorInvoices.every(inv => selectedInv[inv.id])}
                              onChange={ev => {
                                const checked = ev.target.checked;
                                const next = { ...selectedInv };
                                vendorInvoices.forEach(inv => { next[inv.id] = checked; });
                                setSelectedInv(next);
                              }}
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Invoice #</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Employee</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Month</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Hours</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {vendorInvoices.map(inv => {
                          const emp = employees.find(e => e.id === inv.employee_id);
                          const status = getStatusBadge(inv.sent);
                          const pdfUrl = `${process.env.NEXT_PUBLIC_API_URL || "/api"}/invoices/${inv.id}/pdf${token ? `?token=${encodeURIComponent(token)}` : ""}`;
                          return (
                            <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={!!selectedInv[inv.id]}
                                  onChange={ev => setSelectedInv({ ...selectedInv, [inv.id]: ev.target.checked })}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-6 py-4 text-sm font-mono text-blue-400">{inv.invoice_number}</td>
                              <td className="px-6 py-4 text-sm font-medium text-white">{emp?.name || "Unknown"}</td>
                              <td className="px-6 py-4 text-sm text-slate-300">{inv.month_key}</td>
                              <td className="px-6 py-4 text-sm text-slate-300">{inv.hours.toFixed(2)}h</td>
                              <td className="px-6 py-4 text-sm font-semibold text-white text-right">${inv.amount.toFixed(2)}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${status.color}`}>
                                  {status.text}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-right flex items-center gap-2 justify-end">
                                <a
                                  href={pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs rounded-lg border border-slate-600 px-3 py-1.5 hover:bg-slate-800/60 text-slate-200 transition-colors"
                                >
                                  Download
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Feedback Messages */}
        {err && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <strong>Error:</strong> {err}
          </div>
        )}
        {ok && (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <strong>Success!</strong>
            <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(ok, null, 2)}</pre>
          </div>
        )}
      </div>
    </Shell>
  );
}
