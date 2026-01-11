"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { apiGet, apiPost } from "@/app/api";

type Employee = {
  id: number;
  name: string;
  hourly_rate: number;
  email?: string | null;
  start_date?: string | null;
  company?: string | null;
  preferred_vendor_id?: number | null;
  lifetime_hours: number;
};

type Vendor = {
  id: number;
  name: string;
  email: string;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null);
  const [editVendorName, setEditVendorName] = useState("");
  const [editVendorEmail, setEditVendorEmail] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState("");
  const [preferredVendor, setPreferredVendor] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editPreferredVendor, setEditPreferredVendor] = useState("");
  const [monthKey, setMonthKey] = useState("2025-12");
  const [monthlyHours, setMonthlyHours] = useState<Record<number, number>>({});

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const emps = await apiGet<Employee[]>("/employees");
      const vends = await apiGet<Vendor[]>("/vendors");
      setEmployees(emps);
      setVendors(vends);
      
      // Fetch monthly hours for each employee
      const hours: Record<number, number> = {};
      for (const emp of emps) {
        try {
          const res = await apiGet<any>(`/employees/${emp.id}/monthly_hours/${monthKey}`);
          hours[emp.id] = res.hours || 0;
        } catch {
          hours[emp.id] = 0;
        }
      }
      setMonthlyHours(hours);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [monthKey]);

  async function addEmployee() {
    setErr(null);
    if (!name || !rate || !company || !startDate || !preferredVendor) {
      setErr("Name, hourly rate, company, start date, and preferred vendor are required");
      return;
    }
    try {
      await apiPost("/employees", {
        name,
        hourly_rate: Number(rate),
        email: email || null,
        company,
        start_date: startDate,
        preferred_vendor_id: Number(preferredVendor),
      });
      setName(""); setRate(""); setEmail(""); setCompany(""); setStartDate(""); setPreferredVendor("");
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function deleteEmployee(id: number) {
    setErr(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "/api";
      await fetch(`${API}/employees/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function startEdit(emp: Employee) {
    setEditingId(emp.id);
    setEditName(emp.name);
    setEditRate(emp.hourly_rate.toString());
    setEditEmail(emp.email || "");
    setEditCompany(emp.company || "");
    setEditStartDate(emp.start_date || "");
    setEditPreferredVendor(emp.preferred_vendor_id ? emp.preferred_vendor_id.toString() : "");
  }

  async function saveEdit(id: number) {
    setErr(null);
    if (!editName || !editRate || !editCompany || !editStartDate || !editPreferredVendor) {
      setErr("Name, hourly rate, company, start date, and preferred vendor are required");
      return;
    }
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "/api";
      await fetch(`${API}/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          hourly_rate: Number(editRate),
          email: editEmail || null,
          company: editCompany,
          start_date: editStartDate,
          preferred_vendor_id: Number(editPreferredVendor),
        }),
      });
      setEditingId(null);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function cancelEdit() {
    setEditingId(null);
  }

  async function addVendor() {
    setErr(null);
    if (!vendorName || !vendorEmail) {
      setErr("Vendor name and email are required");
      return;
    }
    try {
      await apiPost("/vendors", { name: vendorName, email: vendorEmail });
      setVendorName(""); setVendorEmail("");
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  function startVendorEdit(vendor: Vendor) {
    setEditingVendorId(vendor.id);
    setEditVendorName(vendor.name);
    setEditVendorEmail(vendor.email);
  }

  async function saveVendorEdit(id: number) {
    setErr(null);
    if (!editVendorName || !editVendorEmail) {
      setErr("Vendor name and email are required");
      return;
    }
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "/api";
      await fetch(`${API}/vendors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editVendorName, email: editVendorEmail }),
      });
      setEditingVendorId(null);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  function cancelVendorEdit() {
    setEditingVendorId(null);
  }

  return (
    <Shell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Employees</h2>
          <p className="text-slate-400">Manage your contractors and set hourly rates</p>
        </div>

        {/* Month Selector */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm p-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">View Monthly Hours For:</label>
          <input
            className="w-full md:w-48 rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
            type="month"
            value={monthKey}
            onChange={e => setMonthKey(e.target.value)}
          />
        </div>

        {/* Add Employee Form */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm p-8">
          <h3 className="text-lg font-semibold text-white mb-6">Add New Employee</h3>
          <div className="space-y-4">
            <div className="grid md:grid-cols-7 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Full Name</label>
                <input
                  className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                  placeholder="John Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Hourly Rate ($)</label>
                <input
                  className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                  placeholder="50.00"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  type="number"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Company</label>
                <input
                  className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                  placeholder="Swift Bot Technologies"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  list="company-options-add"
                />
                <datalist id="company-options-add">
                  <option value="Swift Bot Technologies" />
                  <option value="ORM" />
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Preferred Vendor</label>
                <select
                  className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                  value={preferredVendor}
                  onChange={e => setPreferredVendor(e.target.value)}
                >
                  <option value="">Select vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Start Date</label>
                <input
                  className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  type="date"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Email (Optional)</label>
                <input
                  className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                  placeholder="john@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addEmployee}
                  className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
                >
                  Add Employee
                </button>
              </div>
            </div>
            {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{err}</div>}
          </div>
        </div>

        {/* Vendors */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm p-8">
          <h3 className="text-lg font-semibold text-white mb-6">Preferred Vendors</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Company Name</label>
              <input
                className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                placeholder="Vendor Co."
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Vendor Email</label>
              <input
                className="w-full rounded-lg bg-slate-950/50 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                placeholder="billing@vendor.com"
                value={vendorEmail}
                onChange={e => setVendorEmail(e.target.value)}
                type="email"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={addVendor}
                className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                Add Vendor
              </button>
            </div>
          </div>
          <div className="mt-6 space-y-2 text-sm text-slate-300">
            {vendors.length === 0 ? "No vendors yet." : vendors.map(v => (
              <div key={v.id} className="flex items-center justify-between border border-slate-700/40 rounded-lg px-4 py-2">
                {editingVendorId === v.id ? (
                  <div className="flex flex-1 flex-wrap items-center gap-3">
                    <input
                      className="rounded bg-slate-950/50 border border-slate-600 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                      value={editVendorName}
                      onChange={e => setEditVendorName(e.target.value)}
                    />
                    <input
                      className="rounded bg-slate-950/50 border border-slate-600 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none w-56"
                      value={editVendorEmail}
                      onChange={e => setEditVendorEmail(e.target.value)}
                    />
                  </div>
                ) : (
                  <>
                    <span>{v.name}</span>
                    <span className="text-slate-400">{v.email}</span>
                  </>
                )}
                <div className="flex items-center gap-2">
                  {editingVendorId === v.id ? (
                    <>
                      <button
                        onClick={() => saveVendorEdit(v.id)}
                        className="text-xs rounded-lg border border-green-500/40 text-green-300 px-3 py-1.5 hover:bg-green-500/10 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelVendorEdit}
                        className="text-xs rounded-lg border border-slate-500/40 text-slate-300 px-3 py-1.5 hover:bg-slate-500/10 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startVendorEdit(v)}
                      className="text-xs rounded-lg border border-blue-500/40 text-blue-300 px-3 py-1.5 hover:bg-blue-500/10 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Employees List */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-700/50">
            <h3 className="text-lg font-semibold text-white">Active Employees</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Name</th>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Hourly Rate</th>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Company</th>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Preferred Vendor</th>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Start Date</th>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Month Hours</th>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Lifetime Hours</th>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Email</th>
                  <th className="px-8 py-3 text-right text-xs font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {loading ? (
                  <tr><td colSpan={9} className="px-8 py-6 text-center text-slate-400">Loading...</td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={9} className="px-8 py-6 text-center text-slate-400">No employees yet. Add one above.</td></tr>
                ) : (
                  employees.map(e => (
                    <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-8 py-4 text-sm font-medium text-white">
                        {editingId === e.id ? (
                          <input
                            className="rounded bg-slate-950/50 border border-slate-600 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                            value={editName}
                            onChange={ev => setEditName(ev.target.value)}
                          />
                        ) : (
                          e.name
                        )}
                      </td>
                      <td className="px-8 py-4 text-sm text-slate-300">
                        {editingId === e.id ? (
                          <div className="flex items-center">
                            <span className="mr-1">$</span>
                            <input
                              className="w-16 rounded bg-slate-950/50 border border-slate-600 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                              type="number"
                              step="0.01"
                              value={editRate}
                              onChange={ev => setEditRate(ev.target.value)}
                            />
                            <span className="ml-1">/hr</span>
                          </div>
                        ) : (
                          `$${e.hourly_rate.toFixed(2)}/hr`
                        )}
                      </td>
                      <td className="px-8 py-4 text-sm text-slate-300">
                        {editingId === e.id ? (
                          <>
                            <input
                              className="rounded bg-slate-950/50 border border-slate-600 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none w-40"
                              value={editCompany}
                              onChange={ev => setEditCompany(ev.target.value)}
                              list="company-options"
                            />
                            <datalist id="company-options">
                              <option value="Swift Bot Technologies" />
                              <option value="ORM" />
                            </datalist>
                          </>
                        ) : (
                          e.company || "—"
                        )}
                      </td>
                      <td className="px-8 py-4 text-sm text-slate-300">
                        {editingId === e.id ? (
                          <select
                            className="rounded bg-slate-950/50 border border-slate-600 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none w-40"
                            value={editPreferredVendor}
                            onChange={ev => setEditPreferredVendor(ev.target.value)}
                          >
                            <option value="">Select vendor</option>
                            {vendors.map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        ) : (
                          vendors.find(v => v.id === Number(e.preferred_vendor_id))?.name || "—"
                        )}
                      </td>
                      <td className="px-8 py-4 text-sm text-slate-300">
                        {editingId === e.id ? (
                          <input
                            className="rounded bg-slate-950/50 border border-slate-600 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                            type="date"
                            value={editStartDate}
                            onChange={ev => setEditStartDate(ev.target.value)}
                          />
                        ) : (
                          e.start_date || "—"
                        )}
                      </td>
                      <td className="px-8 py-4 text-sm text-slate-300">{(monthlyHours[e.id] || 0).toFixed(1)}h</td>
                      <td className="px-8 py-4 text-sm text-slate-300">{e.lifetime_hours.toFixed(1)}h</td>
                      <td className="px-8 py-4 text-sm text-slate-400">
                        {editingId === e.id ? (
                          <input
                            className="rounded bg-slate-950/50 border border-slate-600 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none w-40"
                            type="email"
                            value={editEmail}
                            onChange={ev => setEditEmail(ev.target.value)}
                          />
                        ) : (
                          e.email || "—"
                        )}
                      </td>
                      <td className="px-8 py-4 text-right">
                        {editingId === e.id ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => saveEdit(e.id)}
                              className="text-xs rounded-lg border border-green-500/40 text-green-300 px-3 py-1.5 hover:bg-green-500/10 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-xs rounded-lg border border-slate-500/40 text-slate-300 px-3 py-1.5 hover:bg-slate-500/10 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => startEdit(e)}
                              className="text-xs rounded-lg border border-blue-500/40 text-blue-300 px-3 py-1.5 hover:bg-blue-500/10 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteEmployee(e.id)}
                              className="text-xs rounded-lg border border-red-500/40 text-red-300 px-3 py-1.5 hover:bg-red-500/10 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
