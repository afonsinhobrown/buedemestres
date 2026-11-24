import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Autenticação',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-72px)] flex items-center justify-center bg-[#f5f7fa] px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}
