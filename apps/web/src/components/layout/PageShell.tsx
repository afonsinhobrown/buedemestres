import React from 'react'

interface PageShellProps {
  children: React.ReactNode
  noNav?: boolean
}

export function PageShell({ children }: PageShellProps) {
  return <main className="app-page-shell">{children}</main>
}
