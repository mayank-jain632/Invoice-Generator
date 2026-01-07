"use client";
import { useRouter } from "next/navigation";

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Navigation Bar */}
      <nav className="border-b border-slate-800/50 bg-slate-950/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-12">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <h1 className="text-xl font-bold tracking-tight text-white">InvoiceFlow</h1>
              </div>
              <div className="hidden md:flex gap-1">
                <a href="/" className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors">Home</a>
                <a href="/employees" className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors">Employees</a>
                <a href="/timesheets" className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors">Timesheets</a>
                <a href="/invoices" className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors">Invoices</a>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-8 py-12">
        {children}
      </div>
    </div>
  );
}
