"use client";

import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Workbook" },
  { href: "/employees", label: "Directory" },
  { href: "/analytics", label: "Analytics" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <div className="min-h-screen text-[var(--text)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(8,12,18,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-[var(--accent)] shadow-[0_0_16px_rgba(47,125,255,0.9)]" />
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">InvoiceFlow</div>
                <div className="text-lg font-semibold text-white">Workbook Ops</div>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-[var(--accent-soft)] text-white ring-1 ring-[rgba(47,125,255,0.38)]"
                        : "text-[var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
