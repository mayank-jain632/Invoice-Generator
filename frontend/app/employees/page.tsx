"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { apiDelete, apiGet, apiPost, apiPut } from "@/app/api";

type Employee = {
  id: number;
  name: string;
  hourly_rate: number;
  email?: string | null;
  start_date?: string | null;
  notes?: string | null;
};

type Vendor = {
  id: number;
  name: string;
  email: string;
};

type Company = {
  id: number;
  name: string;
  address?: string | null;
};

export default function DirectoryPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [employeeForm, setEmployeeForm] = useState({ name: "", hourly_rate: "", email: "", start_date: "", notes: "" });
  const [vendorForm, setVendorForm] = useState({ name: "", email: "" });
  const [companyForm, setCompanyForm] = useState({ name: "", address: "" });

  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);

  const [draftEmployee, setDraftEmployee] = useState(employeeForm);
  const [draftVendor, setDraftVendor] = useState(vendorForm);
  const [draftCompany, setDraftCompany] = useState(companyForm);

  const employeeNameValid = employeeForm.name.trim().length > 0;
  const vendorNameValid = vendorForm.name.trim().length > 0;
  const companyNameValid = companyForm.name.trim().length > 0;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [employeesData, vendorsData, companiesData] = await Promise.all([
        apiGet<Employee[]>("/employees"),
        apiGet<Vendor[]>("/vendors"),
        apiGet<Company[]>("/companies"),
      ]);
      setEmployees(employeesData);
      setVendors(vendorsData);
      setCompanies(companiesData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createEmployee() {
    if (!employeeNameValid) {
      setError("Employee name is required");
      return;
    }
    try {
      await apiPost("/employees", {
        name: employeeForm.name.trim(),
        hourly_rate: Number(employeeForm.hourly_rate || 0),
        email: employeeForm.email || null,
        start_date: employeeForm.start_date || null,
        notes: employeeForm.notes || null,
      });
      setEmployeeForm({ name: "", hourly_rate: "", email: "", start_date: "", notes: "" });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createVendor() {
    if (!vendorNameValid) {
      setError("Vendor name is required");
      return;
    }
    try {
      await apiPost("/vendors", { ...vendorForm, name: vendorForm.name.trim() });
      setVendorForm({ name: "", email: "" });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createCompany() {
    if (!companyNameValid) {
      setError("Company name is required");
      return;
    }
    try {
      await apiPost("/companies", { name: companyForm.name.trim(), address: companyForm.address || null });
      setCompanyForm({ name: "", address: "" });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveEmployee(id: number) {
    if (!draftEmployee.name.trim()) {
      setError("Employee name is required");
      return;
    }
    try {
      await apiPut(`/employees/${id}`, {
        name: draftEmployee.name.trim(),
        hourly_rate: Number(draftEmployee.hourly_rate || 0),
        email: draftEmployee.email || null,
        start_date: draftEmployee.start_date || null,
        notes: draftEmployee.notes || null,
      });
      setEditingEmployeeId(null);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveVendor(id: number) {
    if (!draftVendor.name.trim()) {
      setError("Vendor name is required");
      return;
    }
    try {
      await apiPut(`/vendors/${id}`, { ...draftVendor, name: draftVendor.name.trim() });
      setEditingVendorId(null);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveCompany(id: number) {
    if (!draftCompany.name.trim()) {
      setError("Company name is required");
      return;
    }
    try {
      await apiPut(`/companies/${id}`, { name: draftCompany.name.trim(), address: draftCompany.address || null });
      setEditingCompanyId(null);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(path: string) {
    try {
      await apiDelete(path);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="rounded-[28px] border border-[var(--line)] bg-[rgba(20,28,39,0.9)] p-7">
          <div className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Directory</div>
          <h1 className="mt-3 text-4xl font-semibold text-white">Master records for workbook sheets.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Maintain the employees, vendors, and companies that workbook rows reference. Sheets stay lightweight because the master data lives here.
          </p>
        </div>

        {error && (
          <div className="rounded-[20px] border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
            <h2 className="text-xl font-semibold text-white">Employees</h2>
            <div className="mt-4 space-y-3">
              <input value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} placeholder="Full name" className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]" />
              <input value={employeeForm.hourly_rate} onChange={(e) => setEmployeeForm({ ...employeeForm, hourly_rate: e.target.value })} placeholder="Hourly rate" className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]" />
              <input value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} placeholder="Email" className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]" />
              <input value={employeeForm.start_date} onChange={(e) => setEmployeeForm({ ...employeeForm, start_date: e.target.value })} type="date" className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]" />
              <textarea value={employeeForm.notes} onChange={(e) => setEmployeeForm({ ...employeeForm, notes: e.target.value })} placeholder="Notes" className="min-h-[84px] w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]" />
              <button onClick={createEmployee} disabled={!employeeNameValid} className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Add Employee</button>
            </div>
            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="text-sm text-[var(--muted)]">Loading...</div>
              ) : (
                employees.map((employee) => (
                  <div key={employee.id} className="rounded-2xl border border-[var(--line)] bg-[rgba(20,28,39,0.72)] p-4">
                    {editingEmployeeId === employee.id ? (
                      <div className="space-y-2">
                        <input value={draftEmployee.name} onChange={(e) => setDraftEmployee({ ...draftEmployee, name: e.target.value })} className="w-full rounded-xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-3 py-2 text-white outline-none focus:border-[var(--accent)]" />
                        <input value={draftEmployee.hourly_rate} onChange={(e) => setDraftEmployee({ ...draftEmployee, hourly_rate: e.target.value })} className="w-full rounded-xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-3 py-2 text-white outline-none focus:border-[var(--accent)]" />
                        <input value={draftEmployee.email} onChange={(e) => setDraftEmployee({ ...draftEmployee, email: e.target.value })} className="w-full rounded-xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-3 py-2 text-white outline-none focus:border-[var(--accent)]" />
                        <input value={draftEmployee.start_date} onChange={(e) => setDraftEmployee({ ...draftEmployee, start_date: e.target.value })} type="date" className="w-full rounded-xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-3 py-2 text-white outline-none focus:border-[var(--accent)]" />
                        <textarea value={draftEmployee.notes} onChange={(e) => setDraftEmployee({ ...draftEmployee, notes: e.target.value })} className="min-h-[68px] w-full rounded-xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-3 py-2 text-white outline-none focus:border-[var(--accent)]" />
                        <div className="flex gap-2">
                          <button onClick={() => saveEmployee(employee.id)} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">Save</button>
                          <button onClick={() => setEditingEmployeeId(null)} className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm text-[var(--muted)]">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-white">{employee.name}</div>
                          <div className="mt-1 text-sm text-[var(--muted)]">${employee.hourly_rate.toFixed(2)}/hr</div>
                          {employee.email && <div className="mt-1 text-sm text-[var(--muted)]">{employee.email}</div>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingEmployeeId(employee.id);
                              setDraftEmployee({
                                name: employee.name,
                                hourly_rate: employee.hourly_rate.toString(),
                                email: employee.email || "",
                                start_date: employee.start_date || "",
                                notes: employee.notes || "",
                              });
                            }}
                            className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm text-[var(--muted)]"
                          >
                            Edit
                          </button>
                          <button onClick={() => remove(`/employees/${employee.id}`)} className="rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-200">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
            <h2 className="text-xl font-semibold text-white">Vendors</h2>
            <div className="mt-4 space-y-3">
              <input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} placeholder="Vendor name" className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]" />
              <textarea value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} placeholder="recipient1@vendor.com, recipient2@vendor.com" className="min-h-[84px] w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]" />
              <button onClick={createVendor} disabled={!vendorNameValid} className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Add Vendor</button>
            </div>
            <div className="mt-5 space-y-3">
              {vendors.map((vendor) => (
                <div key={vendor.id} className="rounded-2xl border border-[var(--line)] bg-[rgba(20,28,39,0.72)] p-4">
                  {editingVendorId === vendor.id ? (
                    <div className="space-y-2">
                      <input value={draftVendor.name} onChange={(e) => setDraftVendor({ ...draftVendor, name: e.target.value })} className="w-full rounded-xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-3 py-2 text-white outline-none focus:border-[var(--accent)]" />
                      <textarea value={draftVendor.email} onChange={(e) => setDraftVendor({ ...draftVendor, email: e.target.value })} className="min-h-[84px] w-full rounded-xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-3 py-2 text-white outline-none focus:border-[var(--accent)]" />
                      <div className="flex gap-2">
                        <button onClick={() => saveVendor(vendor.id)} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">Save</button>
                        <button onClick={() => setEditingVendorId(null)} className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm text-[var(--muted)]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-white">{vendor.name}</div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">{vendor.email}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingVendorId(vendor.id);
                            setDraftVendor({ name: vendor.name, email: vendor.email });
                          }}
                          className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm text-[var(--muted)]"
                        >
                          Edit
                        </button>
                        <button onClick={() => remove(`/vendors/${vendor.id}`)} className="rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-200">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
            <h2 className="text-xl font-semibold text-white">Companies</h2>
            <div className="mt-4 space-y-3">
              <input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="Company name" className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]" />
              <textarea value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} placeholder="Address for combined invoices" className="min-h-[84px] w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-4 py-3 text-white outline-none focus:border-[var(--accent)]" />
              <button onClick={createCompany} disabled={!companyNameValid} className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Add Company</button>
            </div>
            <div className="mt-5 space-y-3">
              {companies.map((company) => (
                <div key={company.id} className="rounded-2xl border border-[var(--line)] bg-[rgba(20,28,39,0.72)] p-4">
                  {editingCompanyId === company.id ? (
                    <div className="space-y-2">
                      <input value={draftCompany.name} onChange={(e) => setDraftCompany({ ...draftCompany, name: e.target.value })} className="w-full rounded-xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-3 py-2 text-white outline-none focus:border-[var(--accent)]" />
                      <textarea value={draftCompany.address} onChange={(e) => setDraftCompany({ ...draftCompany, address: e.target.value })} className="min-h-[84px] w-full rounded-xl border border-[var(--line)] bg-[rgba(8,12,18,0.92)] px-3 py-2 text-white outline-none focus:border-[var(--accent)]" />
                      <div className="flex gap-2">
                        <button onClick={() => saveCompany(company.id)} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">Save</button>
                        <button onClick={() => setEditingCompanyId(null)} className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm text-[var(--muted)]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-white">{company.name}</div>
                        {company.address && <div className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">{company.address}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingCompanyId(company.id);
                            setDraftCompany({ name: company.name, address: company.address || "" });
                          }}
                          className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm text-[var(--muted)]"
                        >
                          Edit
                        </button>
                        <button onClick={() => remove(`/companies/${company.id}`)} className="rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-200">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
