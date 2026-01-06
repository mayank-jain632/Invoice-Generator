"use client";

import Shell from "@/components/Shell";

export default function Page() {
  return (
    <Shell>
      <div className="space-y-12">
        {/* Hero Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-white mb-2">Welcome to InvoiceFlow</h2>
            <p className="text-lg text-slate-400">Automate your contractor invoicing in minutes</p>
          </div>
        </div>

        {/* Workflow Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm p-8 hover:border-slate-600/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📋</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">The Workflow</h3>
                <ol className="space-y-2">
                  <li className="flex gap-3 text-sm text-slate-300">
                    <span className="text-blue-400 font-semibold min-w-6">1</span>
                    <span>Send reminder emails for timesheets</span>
                  </li>
                  <li className="flex gap-3 text-sm text-slate-300">
                    <span className="text-blue-400 font-semibold min-w-6">2</span>
                    <span>Record hours worked (name, hours)</span>
                  </li>
                  <li className="flex gap-3 text-sm text-slate-300">
                    <span className="text-blue-400 font-semibold min-w-6">3</span>
                    <span>Auto-generate invoice PDFs</span>
                  </li>
                  <li className="flex gap-3 text-sm text-slate-300">
                    <span className="text-blue-400 font-semibold min-w-6">4</span>
                    <span>Review and approve invoices</span>
                  </li>
                  <li className="flex gap-3 text-sm text-slate-300">
                    <span className="text-blue-400 font-semibold min-w-6">5</span>
                    <span>Send to billing instantly</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm p-8 hover:border-slate-600/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">✨</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Features</h3>
                <ul className="space-y-2">
                  <li className="flex gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400">✓</span>
                    <span>Clean, intuitive dashboard</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400">✓</span>
                    <span>Professional PDF invoices</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400">✓</span>
                    <span>Flexible SMTP integration</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400">✓</span>
                    <span>Manual approval gate</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400">✓</span>
                    <span>SQLite database (upgradeable)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-r from-blue-500/5 to-purple-500/5 backdrop-blur-sm p-8">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Start</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <a href="/employees" className="group p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all">
              <div className="text-2xl mb-2">👥</div>
              <h4 className="font-semibold text-white text-sm mb-1">Add Employees</h4>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Set up your contractor list with rates</p>
            </a>
            <a href="/timesheets" className="group p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-semibold text-white text-sm mb-1">Submit Hours</h4>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Ingest timesheet data and send reminders</p>
            </a>
            <a href="/invoices" className="group p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all">
              <div className="text-2xl mb-2">📄</div>
              <h4 className="font-semibold text-white text-sm mb-1">Generate Invoices</h4>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Create and send professional invoices</p>
            </a>
          </div>
        </div>
      </div>
    </Shell>
  );
}
