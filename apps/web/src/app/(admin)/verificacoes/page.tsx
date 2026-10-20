import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { VerificacoesList } from './VerificacoesList'
import { Toaster } from 'sonner'
import { redirect } from 'next/navigation'

function deriveSupabaseUrl(): string | null {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return null
  const match = databaseUrl.match(/postgres\.([a-z0-9]+)\./)
  if (!match) return null
  return `https://${match[1]}.supabase.co`
}

type VerificationRow = {
  id: string
  doc_type: string
  doc_number: string | null
  front_path: string
  back_path: string | null
  selfie_path: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  provider_name: string
  front_url?: string | null
  back_url?: string | null
  selfie_url?: string | null
}

async function withSignedUrls(rows: VerificationRow[]): Promise<VerificationRow[]> {
  const url = deriveSupabaseUrl()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return rows

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const paths = new Set<string>()
  const pathKeys = ['front_path', 'back_path', 'selfie_path'] as const
  for (const row of rows) {
    for (const key of pathKeys) {
      const value = row[key]
      if (value && !String(value).startsWith('http')) paths.add(value)
    }
  }

  if (paths.size === 0) return rows

  const { data, error } = await supabase.storage
    .from('verification-documents')
    .createSignedUrls([...paths], 60 * 60)

  if (error || !data) {
    console.error('Erro ao gerar URLs assinadas dos documentos:', error)
    return rows
  }

  const signed = new Map<string, string>()
  for (const item of data) {
    if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl)
  }

  return rows.map((row) => ({
    ...row,
    front_url: row.front_path?.startsWith('http') ? row.front_path : signed.get(row.front_path) || null,
    back_url: !row.back_path
      ? null
      : row.back_path.startsWith('http')
      ? row.back_path
      : signed.get(row.back_path) || null,
    selfie_url: row.selfie_path?.startsWith('http') ? row.selfie_path : signed.get(row.selfie_path) || null,
  }))
}

export default async function VerificacoesAdminPage() {
  const session = await verifySession()
  
  if (session.role !== 'admin') {
    redirect('/entrar')
  }

  const res = await db.query(`
    SELECT 
      v.id, v.doc_type, v.doc_number, v.front_path, v.back_path, v.selfie_path, v.status, v.created_at,
      p.full_name as provider_name
    FROM verification_documents v
    JOIN profiles p ON p.id = v.provider_id
    WHERE v.status = 'pending'
    ORDER BY v.created_at ASC
  `)

  const items = (await withSignedUrls(res.rows as VerificationRow[])).map((item) => ({
    ...item,
    front_url: item.front_url ?? null,
    back_url: item.back_url ?? null,
    selfie_url: item.selfie_url ?? null,
  }))

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fila de Verificações (KYC)</h1>
          <p className="text-gray-500">Avalie os documentos submetidos pelos profissionais (SLA: 48h).</p>
        </div>
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold">
          {res.rows.length} Pendentes
        </div>
      </div>
      
      <VerificacoesList items={items} />
    </div>
  )
}
