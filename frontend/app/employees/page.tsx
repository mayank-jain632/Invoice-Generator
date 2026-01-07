"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { apiGet, apiPost } from "@/app/api";

type Employee = {
  id: number;
  name: string;
  hourly_rate: number;
  email?: string | null;
  lifetime_hours: number;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [monthKey, setMonthKey] = useState("2025-12");
  const [monthlyHours, setMonthlyHours] = useState<Record<number, number>>({});

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const emps = await apiGet<Employee[]>("/employees");
      setEmployees(emps);
      
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
    if (!name || !rate) {
      setErr("Name and hourly rate are required");
      return;
    }
    try {
      await apiPost("/employees", { name, hourly_rate: Number(rate), email: email || null });
      setName(""); setRate(""); setEmail("");
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
  }

  async function saveEdit(id: number) {
    setErr(null);
    if (!editName || !editRate) {
      setErr("Name and hourly rate are required");
      return;
    }
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "/api";
      await fetch(`${API}/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, hourly_rate: Number(editRate), email: editEmail || null }),
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
            <div className="grid md:grid-cols-4 gap-4">
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
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Month Hours</th>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Lifetime Hours</th>
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-300">Email</th>
                  <th className="px-8 py-3 text-right text-xs font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {loading ? (
                  <tr><td colSpan={6} className="px-8 py-6 text-center text-slate-400">Loading...</td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={6} className="px-8 py-6 text-center text-slate-400">No employees yet. Add one above.</td></tr>
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
