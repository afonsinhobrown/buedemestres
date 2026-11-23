import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Resultados da pesquisa',
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  const q = first(params.q).trim()
  const place = first(params.l).trim()
  if (q) query.set('q', q)
  if (place) query.set('onde', place)
  const suffix = query.toString()
  redirect(`/resultados${suffix ? `?${suffix}` : ''}`)
}
