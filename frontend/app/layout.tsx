import './globals.css'
import type { Metadata } from 'next'
import AuthGuard from '@/components/AuthGuard'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'InvoiceFlow',
  description: 'Spreadsheet-first contractor invoicing workspace',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[var(--bg-0)] text-[var(--text)]">
        <AuthGuard>{children}</AuthGuard>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#141c27',
              color: '#e8edf5',
              border: '1px solid #3d4d60'
            },
            success: {
              iconTheme: {
                primary: '#2f7dff',
                secondary: '#e8edf5',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#e8edf5',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
