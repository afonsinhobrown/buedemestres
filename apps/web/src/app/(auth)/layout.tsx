import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Autenticação',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}
