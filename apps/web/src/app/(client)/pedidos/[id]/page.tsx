import { PageShell } from '@/components/layout/PageShell'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatMT } from '@/lib/utils/format-mzn'
import { CaretLeft, PaperPlaneRight, WhatsappLogo } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

export default async function PedidoChatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  // Exemplo de orçamentos (Rascunho de UI)
  const quotes = [
    { providerName: 'Oficina Mabunda', amount: 1500, status: 'sent', id: 'q1' },
    { providerName: 'Auto Central', amount: 2000, status: 'sent', id: 'q2' }
  ]

  const messages = [
    { sender: 'client', text: 'Bom dia, o carro não arranca. Faz um clique mas o motor não roda.', time: '09:00' },
    { sender: 'provider', name: 'Oficina Mabunda', text: 'Bom dia chefe. Parece o motor de arranque. Consigo passar aí às 14h para ver.', time: '09:15' },
    { sender: 'system', text: 'Oficina Mabunda enviou um orçamento de 1.500 MT', time: '09:16' }
  ]

  return (
    <PageShell noNav>
      <div className="flex flex-col h-screen max-h-screen bg-[var(--color-cal)]">
        
        {/* Topbar */}
        <header className="flex items-center p-4 bg-[var(--color-papel)] border-b border-[var(--color-zinco-200)] shrink-0 gap-3">
          <Link href="/pedidos" className="p-2 -ml-2 text-[var(--color-tinta)]">
            <CaretLeft size={24} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-[var(--color-tinta)] truncate">Motor não liga</h1>
            <p className="text-xs text-[var(--color-zinco)]">Aberto · 2 orçamentos</p>
          </div>
        </header>

        {/* Zona Scrollable - Divisão em Orçamentos e Chat */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
          
          {/* Coluna Orçamentos */}
          <aside className="w-full md:w-80 bg-[var(--color-papel)] border-b md:border-b-0 md:border-r border-[var(--color-zinco-200)] p-4 shrink-0">
            <h2 className="font-bold text-sm text-[var(--color-zinco)] uppercase mb-4 tracking-wider">Orçamentos recebidos</h2>
            <div className="space-y-3">
              {quotes.map(q => (
                <div key={q.id} className="p-3 rounded-[var(--radius-controlo)] border border-[var(--color-zinco-200)] bg-[var(--color-cal)]">
                  <div className="font-bold text-sm text-[var(--color-tinta)] truncate">{q.providerName}</div>
                  <div className="flex justify-between items-end mt-2">
                    <span className="font-bold text-lg text-[var(--color-cobalto)]">{formatMT(q.amount)}</span>
                    <button className="text-xs font-bold text-white bg-[var(--color-tinta)] px-3 py-1.5 rounded-sm">Aceitar</button>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Coluna Chat */}
          <main className="flex-1 flex flex-col bg-[var(--color-cal)] relative">
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              
              <div className="text-center py-4">
                <span className="bg-[var(--color-zinco-200)] text-[var(--color-tinta)] text-xs px-2 py-1 rounded-sm">Hoje</span>
              </div>

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                  
                  {m.sender === 'system' ? (
                    <div className="w-full text-center my-2">
                      <div className="inline-block bg-[var(--color-amarelo)]/20 text-[var(--color-tinta)] border border-[var(--color-amarelo)] text-xs font-bold px-3 py-2 rounded-[var(--radius-controlo)]">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div className={`max-w-[85%] md:max-w-[70%] p-3 rounded-[var(--radius-controlo)] ${
                      m.sender === 'client' 
                        ? 'bg-[var(--color-cobalto)] text-white rounded-br-none'
                        : 'bg-[var(--color-papel)] border border-[var(--color-zinco-200)] text-[var(--color-tinta)] rounded-bl-none'
                    }`}>
                      {m.name && <div className="text-xs font-bold opacity-70 mb-1">{m.name}</div>}
                      <div className="text-sm prose-mz">{m.text}</div>
                      <div className={`text-[10px] mt-1 text-right ${m.sender === 'client' ? 'text-white/70' : 'text-[var(--color-zinco)]'}`}>
                        {m.time}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>

            {/* Input Área */}
            <div className="p-3 bg-[var(--color-papel)] border-t border-[var(--color-zinco-200)] pb-safe">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Escreve uma mensagem..." 
                  className="flex-1 h-12 rounded-full border border-[var(--color-zinco-200)] bg-[var(--color-cal)] px-4 text-sm"
                />
                <button className="w-12 h-12 rounded-full bg-[var(--color-cobalto)] text-white flex items-center justify-center shrink-0">
                  <PaperPlaneRight size={20} weight="fill" />
                </button>
              </div>
            </div>
          </main>
        </div>

      </div>
    </PageShell>
  )
}
