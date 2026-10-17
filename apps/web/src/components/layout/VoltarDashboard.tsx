import Link from 'next/link'

export function VoltarDashboard({ href = '/superadmin' }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm transition-colors"
    >
      <span aria-hidden="true">←</span>
      Voltar ao Dashboard
    </Link>
  )
}
