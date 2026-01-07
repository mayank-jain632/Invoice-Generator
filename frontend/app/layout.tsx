import './globals.css'
import type { Metadata } from 'next'
import AuthGuard from '@/components/AuthGuard'

export const metadata: Metadata = {
  title: 'InvoiceFlow',
  description: 'Automate your contractor invoicing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-100">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
