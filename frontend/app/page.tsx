"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { apiGet, apiPost, apiPut } from "@/app/api";

type Vendor = { id: number; name: string; email: string };
type Company = { id: number; name: string; address?: string | null };
type Employee = { id: number; name: string; hourly_rate: number };
type PairSheet = {
  id: number;
  vendor_id: number;
  company_id: number;
  vendor_name: string;
  company_name: string;
  month_total: number;
  row_count: number;
  invoice_id?: number | null;
  invoice_sent: boolean;
  invoice_paid: boolean;
};
type SheetRow = {
  id?: number;
  employee_id?: number | null;
  employee_name: string;
  role?: string | null;
  hours: number;
  rate: number;
  comments?: string | null;
  invoice_status: string;
  paid_status: string;
};
type CombinedInvoice = {
  id: number;
  pair_sheet_id: number;
  month_key: string;
  invoice_number: string;
  total_amount: number;
  sent: boolean;
  paid: boolean;
  manual_recipients?: string | null;
};
type WorkbookDetail = {
  sheet: PairSheet;
  month_key: string;
  rows: Array<{
    id: number;
    employee_id: number;
    employee_name: string;
    role?: string | null;
    hours: number;
    rate: number;
    amount: number;
    comments?: string | null;
    invoice_status: string;
    paid_status: string;
  }>;
  invoice?: CombinedInvoice | null;
};
type SummaryCard = { label: string; value: number };

const editableColumns = ["employee_name", "role", "hours", "rate", "comments"] as const;
type EditableColumn = (typeof editableColumns)[number];

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function blankRow(order: number): SheetRow {
  return {
    employee_name: "",
    role: "",
    hours: 0,
    rate: 0,
    comments: "",
    invoice_status: "draft",
    paid_status: "open",
  };
}

export default function WorkbookPage() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sheets, setSheets] = useState<PairSheet[]>([]);
  const [summary, setSummary] = useState<SummaryCard[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [sheetDetail, setSheetDetail] = useState<WorkbookDetail | null>(null);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [recipients, setRecipients] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [newVendorId, setNewVendorId] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");
  const [activeCell, setActiveCell] = useState<{ row: number; column: EditableColumn } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

  const filteredSheets = useMemo(() => {
    return sheets.filter((sheet) => {
      if (vendorFilter !== "all" && sheet.vendor_id.toString() !== vendorFilter) return false;
      if (companyFilter !== "all" && sheet.company_id.toString() !== companyFilter) return false;
      return true;
    });
  }, [sheets, vendorFilter, companyFilter]);

  async function loadWorkspace() {
    setError(null);
    setLoading(true);
    try {
      const [vendorsData, companiesData, employeesData, sheetsData, summaryData] = await Promise.all([
        apiGet<Vendor[]>("/vendors"),
        apiGet<Company[]>("/companies"),
        apiGet<Employee[]>("/employees"),
        apiGet<PairSheet[]>(`/workbook/sheets?month_key=${encodeURIComponent(monthKey)}`),
        apiGet<SummaryCard[]>(`/analytics/summary?month_key=${encodeURIComponent(monthKey)}`),
      ]);
      setVendors(vendorsData);
      setCompanies(companiesData);
      setEmployees(employeesData);
      setSheets(sheetsData);
      setSummary(summaryData);
      if (!selectedSheetId && sheetsData.length > 0) {
        setSelectedSheetId(sheetsData[0].id);
      } else if (selectedSheetId && !sheetsData.some((sheet) => sheet.id === selectedSheetId)) {
        setSelectedSheetId(sheetsData[0]?.id ?? null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSheet(sheetId: number) {
    setError(null);
    try {
      const detail = await apiGet<WorkbookDetail>(`/workbook/sheets/${sheetId}?month_key=${encodeURIComponent(monthKey)}`);
      setSheetDetail(detail);
      setRows(
        detail.rows.map((row) => ({
          id: row.id,
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          role: row.role || "",
          hours: row.hours,
          rate: row.rate,
          comments: row.comments || "",
          invoice_status: row.invoice_status,
          paid_status: row.paid_status,
        }))
      );
      setRecipients(detail.invoice?.manual_recipients || "");
      setDirty(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [monthKey]);

  useEffect(() => {
    if (selectedSheetId) {
      loadSheet(selectedSheetId);
    } else {
      setSheetDetail(null);
      setRows([]);
      setRecipients("");
      setDirty(false);
    }
  }, [selectedSheetId, monthKey]);

  function matchEmployee(name: string) {
    return employees.find((employee) => employee.name.trim().toLowerCase() === name.trim().toLowerCase());
  }

  function patchRow(rowIndex: number, key: EditableColumn, value: string) {
    setRows((current) =>
      current.map((row, idx) => {
        if (idx !== rowIndex) return row;
        if (key === "employee_name") {
          const employee = matchEmployee(value);
          return {
            ...row,
            employee_name: value,
            employee_id: employee?.id ?? null,
            rate: employee && (!row.rate || row.rate === 0) ? employee.hourly_rate : row.rate,
          };
        }
        if (key === "hours" || key === "rate") {
          const numeric = value === "" ? 0 : Number(value);
          return {
            ...row,
            [key]: Number.isFinite(numeric) ? numeric : row[key],
          };
        }
        return { ...row, [key]: value };
      })
    );
    setDirty(true);
  }

  function addRow() {
    setRows((current) => [...current, blankRow(current.length)]);
    setDirty(true);
  }

  function removeRow(rowIndex: number) {
    setRows((current) => current.filter((_, idx) => idx !== rowIndex));
    setDirty(true);
  }

  async function saveSheet() {
    if (!selectedSheetId) return null;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        rows: rows.map((row, idx) => ({
          id: row.id,
          employee_id: row.employee_id || undefined,
          employee_name: row.employee_name || undefined,
          role: row.role || undefined,
          hours: row.hours || 0,
          rate: row.rate || 0,
          comments: row.comments || undefined,
          sort_order: idx,
        })),
      };
      const detail = await apiPut<WorkbookDetail>(`/workbook/sheets/${selectedSheetId}?month_key=${encodeURIComponent(monthKey)}`, payload);
      setSheetDetail(detail);
      setRows(
        detail.rows.map((row) => ({
          id: row.id,
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          role: row.role || "",
          hours: row.hours,
          rate: row.rate,
          comments: row.comments || "",
          invoice_status: row.invoice_status,
          paid_status: row.paid_status,
        }))
      );
      setDirty(false);
      setMessage("Sheet saved");
      await loadWorkspace();
      return detail;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createSheet() {
    if (!newVendorId || !newCompanyId) {
      setError("Choose both a vendor and a company");
      return;
    }
    try {
      const created = await apiPost<PairSheet>("/workbook/sheets", {
        vendor_id: Number(newVendorId),
        company_id: Number(newCompanyId),
      });
      setNewVendorId("");
      setNewCompanyId("");
      await loadWorkspace();
      setSelectedSheetId(created.id);
      setMessage("Sheet created");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function generateInvoice() {
    if (!selectedSheetId) return;
    if (dirty) {
      const saved = await saveSheet();
      if (!saved) return;
    }
    try {
      await apiPost<CombinedInvoice>(`/workbook/sheets/${selectedSheetId}/invoice/generate?month_key=${encodeURIComponent(monthKey)}`);
      await loadSheet(selectedSheetId);
      await loadWorkspace();
      setMessage("Combined invoice generated");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function sendInvoice() {
    if (!selectedSheetId) return;
    let invoice = sheetDetail?.invoice || null;
    if (dirty) {
      const saved = await saveSheet();
      if (!saved) return;
    }
    if (!invoice) {
      try {
        invoice = await apiPost<CombinedInvoice>(`/workbook/sheets/${selectedSheetId}/invoice/generate?month_key=${encodeURIComponent(monthKey)}`);
      } catch (err: any) {
        setError(err.message);
        return;
      }
    }
    const recipientsList = recipients
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (recipientsList.length === 0) {
      setError("Enter at least one recipient");
      return;
    }
    try {
      await apiPost<CombinedInvoice>(`/combined-invoices/${invoice.id}/send`, { recipients: recipientsList });
      await loadSheet(selectedSheetId);
      await loadWorkspace();
      setMessage("Combined invoice sent");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function copyGrid() {
    const lines = rows.map((row) =>
      [
        row.employee_name,
        row.role || "",
        `${row.hours || 0}`,
        `${row.rate || 0}`,
        `${(row.hours || 0) * (row.rate || 0)}`,
        row.invoice_status,
        row.paid_status,
        row.comments || "",
      ].join("\t")
    );
    await navigator.clipboard.writeText(lines.join("\n"));
    setMessage("Grid copied");
  }

  function focusCell(row: number, column: EditableColumn) {
    setActiveCell({ row, column });
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-cell-key="${row}:${column}"]`
      );
      target?.focus();
      target?.select?.();
    });
  }

  function handleCellKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, rowIndex: number, column: EditableColumn) {
    const columnIndex = editableColumns.indexOf(column);
    if (event.key === "ArrowRight" && columnIndex < editableColumns.length - 1) {
      event.preventDefault();
      focusCell(rowIndex, editableColumns[columnIndex + 1]);
    }
    if (event.key === "ArrowLeft" && columnIndex > 0) {
      event.preventDefault();
      focusCell(rowIndex, editableColumns[columnIndex - 1]);
    }
    if (event.key === "ArrowDown" && rowIndex < rows.length - 1) {
      event.preventDefault();
      focusCell(rowIndex + 1, column);
    }
    if (event.key === "ArrowUp" && rowIndex > 0) {
      event.preventDefault();
      focusCell(rowIndex - 1, column);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (rowIndex === rows.length - 1) {
        addRow();
      }
      focusCell(Math.min(rowIndex + 1, rows.length), column);
    }
  }

  function handlePaste(rowIndex: number, column: EditableColumn, text: string) {
    const startColumnIndex = editableColumns.indexOf(column);
    const nextRows = rows.slice();
    const pastedRows = text.trimEnd().split(/\r?\n/).map((line) => line.split("\t"));
    pastedRows.forEach((cells, pastedRowIndex) => {
      const targetRowIndex = rowIndex + pastedRowIndex;
      while (nextRows.length <= targetRowIndex) {
        nextRows.push(blankRow(nextRows.length));
      }
      cells.forEach((cell, cellIndex) => {
        const targetColumn = editableColumns[startColumnIndex + cellIndex];
        if (!targetColumn) return;
        const currentRow = nextRows[targetRowIndex];
        if (targetColumn === "employee_name") {
          const employee = matchEmployee(cell);
          currentRow.employee_name = cell;
          currentRow.employee_id = employee?.id ?? null;
          if (employee && (!currentRow.rate || currentRow.rate === 0)) {
            currentRow.rate = employee.hourly_rate;
          }
        } else if (targetColumn === "hours" || targetColumn === "rate") {
          const numeric = Number(cell);
          currentRow[targetColumn] = Number.isFinite(numeric) ? numeric : 0;
        } else {
          currentRow[targetColumn] = cell;
        }
      });
    });
    setRows(nextRows);
    setDirty(true);
  }

  return (
    <Shell>
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-[var(--line)] bg-[rgba(20,28,39,0.9)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Workbook-first Ops</div>
            <h1 className="mt-3 text-4xl font-semibold text-white">Vendor x Company sheets instead of form friction.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Edit staffing rows directly in cells, paste from Excel, generate one dense statement per sheet, and keep billing status tied to the exact vendor-company pairing your client cares about.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {summary.map((card) => (
              <div key={card.label} className="rounded-[24px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-5">
                <div className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">{card.label}</div>
                <div className="mt-3 text-3xl font-semibold text-white">${card.value.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--line)] bg-[rgba(20,28,39,0.88)] p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Month</label>
              <input
                type="month"
                value={monthKey}
                onChange={(event) => setMonthKey(event.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.9)] px-4 py-3 text-white outline-none transition focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Vendor Filter</label>
              <select
                value={vendorFilter}
                onChange={(event) => setVendorFilter(event.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.9)] px-4 py-3 text-white outline-none transition focus:border-[var(--accent)]"
              >
                <option value="all">All vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id.toString()}>{vendor.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Company Filter</label>
              <select
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.9)] px-4 py-3 text-white outline-none transition focus:border-[var(--accent)]"
              >
                <option value="all">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id.toString()}>{company.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadWorkspace}
              className="self-end rounded-2xl border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-white transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <select
              value={newVendorId}
              onChange={(event) => setNewVendorId(event.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.9)] px-4 py-3 text-white outline-none transition focus:border-[var(--accent)]"
            >
              <option value="">New sheet vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id.toString()}>{vendor.name}</option>
              ))}
            </select>
            <select
              value={newCompanyId}
              onChange={(event) => setNewCompanyId(event.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.9)] px-4 py-3 text-white outline-none transition focus:border-[var(--accent)]"
            >
              <option value="">New sheet company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id.toString()}>{company.name}</option>
              ))}
            </select>
            <button
              onClick={createSheet}
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Create Sheet
            </button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-[var(--line)] bg-[rgba(12,17,24,0.82)] p-4">
            <div className="mb-4 text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Pair Sheets</div>
            <div className="space-y-3">
              {filteredSheets.map((sheet) => {
                const active = sheet.id === selectedSheetId;
                return (
                  <button
                    key={sheet.id}
                    onClick={() => setSelectedSheetId(sheet.id)}
                    className={`w-full rounded-[22px] border p-4 text-left transition ${
                      active
                        ? "border-[rgba(47,125,255,0.5)] bg-[rgba(47,125,255,0.12)]"
                        : "border-[var(--line)] bg-[rgba(20,28,39,0.64)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{sheet.vendor_name}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{sheet.company_name}</div>
                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
                      <span>{sheet.row_count} rows</span>
                      <span>${sheet.month_total.toFixed(2)}</span>
                    </div>
                  </button>
                );
              })}
              {!loading && filteredSheets.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--line-strong)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                  No sheets match the current filters.
                </div>
              )}
            </div>
          </aside>

          <div className="rounded-[28px] border border-[var(--line)] bg-[rgba(20,28,39,0.88)] p-5">
            {!sheetDetail ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-[24px] border border-dashed border-[var(--line-strong)] text-[var(--muted)]">
                Select a vendor-company sheet to start editing.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Active Sheet</div>
                    <h2 className="mt-2 text-3xl font-semibold text-white">
                      {sheetDetail.sheet.vendor_name} x {sheetDetail.sheet.company_name}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-[var(--muted)]">{monthKey}</span>
                      <span className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-[var(--muted)]">
                        {rows.length} row{rows.length === 1 ? "" : "s"}
                      </span>
                      {sheetDetail.invoice && (
                        <>
                          <span className={`rounded-full px-3 py-1 ${sheetDetail.invoice.sent ? "bg-[rgba(47,125,255,0.16)] text-[#7fb0ff]" : "bg-[rgba(255,255,255,0.06)] text-[var(--muted)]"}`}>
                            {sheetDetail.invoice.sent ? "Sent" : "Draft"}
                          </span>
                          <span className={`rounded-full px-3 py-1 ${sheetDetail.invoice.paid ? "bg-[rgba(16,185,129,0.16)] text-[#86efac]" : "bg-[rgba(255,255,255,0.06)] text-[var(--muted)]"}`}>
                            {sheetDetail.invoice.paid ? "Paid" : "Open"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={addRow} className="rounded-2xl border border-[var(--line-strong)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                      Add Row
                    </button>
                    <button onClick={copyGrid} className="rounded-2xl border border-[var(--line-strong)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                      Copy Grid
                    </button>
                    <button onClick={saveSheet} disabled={saving} className="rounded-2xl border border-[var(--line-strong)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-60">
                      {saving ? "Saving..." : "Save Sheet"}
                    </button>
                    <button onClick={generateInvoice} className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110">
                      Generate Invoice
                    </button>
                    {sheetDetail.invoice && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || "/api"}/combined-invoices/${sheetDetail.invoice.id}/pdf${token ? `?token=${encodeURIComponent(token)}` : ""}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-[var(--line-strong)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                      >
                        Preview PDF
                      </a>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--line)] bg-[rgba(8,12,18,0.8)] p-4">
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Manual Recipients</label>
                  <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
                    <textarea
                      value={recipients}
                      onChange={(event) => setRecipients(event.target.value)}
                      placeholder="finance@client.com, billing@client.com"
                      className="min-h-[80px] rounded-2xl border border-[var(--line)] bg-[rgba(8,12,18,0.95)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                    />
                    <button
                      onClick={sendInvoice}
                      className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
                    >
                      Send Combined Invoice
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-[var(--line)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[rgba(255,255,255,0.03)] text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        <tr>
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Role / Notes</th>
                          <th className="px-4 py-3">Hours</th>
                          <th className="px-4 py-3">Rate</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Invoice</th>
                          <th className="px-4 py-3">Paid</th>
                          <th className="px-4 py-3">Comments</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)] bg-[rgba(10,15,22,0.92)]">
                        {rows.map((row, rowIndex) => (
                          <tr key={row.id ?? `row-${rowIndex}`} className="align-top">
                            <td className="px-3 py-3">
                              <input
                                data-cell-key={`${rowIndex}:employee_name`}
                                value={row.employee_name}
                                onFocus={() => setActiveCell({ row: rowIndex, column: "employee_name" })}
                                onChange={(event) => patchRow(rowIndex, "employee_name", event.target.value)}
                                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "employee_name")}
                                onPaste={(event) => {
                                  event.preventDefault();
                                  handlePaste(rowIndex, "employee_name", event.clipboardData.getData("text"));
                                }}
                                list="employee-options"
                                className="w-52 rounded-xl border border-[var(--line)] bg-[rgba(20,28,39,0.86)] px-3 py-2 text-white outline-none transition focus:border-[var(--accent)]"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                data-cell-key={`${rowIndex}:role`}
                                value={row.role || ""}
                                onFocus={() => setActiveCell({ row: rowIndex, column: "role" })}
                                onChange={(event) => patchRow(rowIndex, "role", event.target.value)}
                                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "role")}
                                onPaste={(event) => {
                                  event.preventDefault();
                                  handlePaste(rowIndex, "role", event.clipboardData.getData("text"));
                                }}
                                className="w-48 rounded-xl border border-[var(--line)] bg-[rgba(20,28,39,0.86)] px-3 py-2 text-white outline-none transition focus:border-[var(--accent)]"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                data-cell-key={`${rowIndex}:hours`}
                                value={row.hours}
                                onFocus={() => setActiveCell({ row: rowIndex, column: "hours" })}
                                onChange={(event) => patchRow(rowIndex, "hours", event.target.value)}
                                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "hours")}
                                onPaste={(event) => {
                                  event.preventDefault();
                                  handlePaste(rowIndex, "hours", event.clipboardData.getData("text"));
                                }}
                                className="w-24 rounded-xl border border-[var(--line)] bg-[rgba(20,28,39,0.86)] px-3 py-2 text-white outline-none transition focus:border-[var(--accent)]"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                data-cell-key={`${rowIndex}:rate`}
                                value={row.rate}
                                onFocus={() => setActiveCell({ row: rowIndex, column: "rate" })}
                                onChange={(event) => patchRow(rowIndex, "rate", event.target.value)}
                                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "rate")}
                                onPaste={(event) => {
                                  event.preventDefault();
                                  handlePaste(rowIndex, "rate", event.clipboardData.getData("text"));
                                }}
                                className="w-28 rounded-xl border border-[var(--line)] bg-[rgba(20,28,39,0.86)] px-3 py-2 text-white outline-none transition focus:border-[var(--accent)]"
                              />
                            </td>
                            <td className="px-4 py-5 font-semibold text-white">
                              ${(row.hours * row.rate).toFixed(2)}
                            </td>
                            <td className="px-4 py-5">
                              <span className={`rounded-full px-3 py-1 text-xs ${row.invoice_status === "sent" ? "bg-[rgba(47,125,255,0.16)] text-[#7fb0ff]" : "bg-[rgba(255,255,255,0.06)] text-[var(--muted)]"}`}>
                                {row.invoice_status}
                              </span>
                            </td>
                            <td className="px-4 py-5">
                              <span className={`rounded-full px-3 py-1 text-xs ${row.paid_status === "paid" ? "bg-[rgba(16,185,129,0.16)] text-[#86efac]" : "bg-[rgba(255,255,255,0.06)] text-[var(--muted)]"}`}>
                                {row.paid_status}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <input
                                data-cell-key={`${rowIndex}:comments`}
                                value={row.comments || ""}
                                onFocus={() => setActiveCell({ row: rowIndex, column: "comments" })}
                                onChange={(event) => patchRow(rowIndex, "comments", event.target.value)}
                                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "comments")}
                                onPaste={(event) => {
                                  event.preventDefault();
                                  handlePaste(rowIndex, "comments", event.clipboardData.getData("text"));
                                }}
                                className="w-48 rounded-xl border border-[var(--line)] bg-[rgba(20,28,39,0.86)] px-3 py-2 text-white outline-none transition focus:border-[var(--accent)]"
                              />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                onClick={() => removeRow(rowIndex)}
                                className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/10"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                        {rows.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-4 py-14 text-center text-[var(--muted)]">
                              This sheet is empty for {monthKey}. Add rows manually or paste a tabular block starting in the first employee cell.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <datalist id="employee-options">
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.name} />
                  ))}
                </datalist>
              </div>
            )}
          </div>
        </section>

        {(message || error) && (
          <section className={`rounded-[24px] border px-5 py-4 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-[rgba(47,125,255,0.3)] bg-[rgba(47,125,255,0.12)] text-[#cddcff]"}`}>
            {error || message}
          </section>
        )}
      </div>
    </Shell>
  );
}
