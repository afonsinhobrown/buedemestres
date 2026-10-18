# Relatório de Pendentes — Bué de Mestres

Data: 2026-10-18
Sessão: correções de pedidos, pagamentos, geofence, APK mestre e páginas brancas da web.

## Estado atual da base de dados

Restam apenas 2 pedidos:

| Pedido | Valor | Estado | Pagamento |
|---|---|---|---|
| `ec24bf93…` (Vila Olímpica) | 5 MT | `completed` | `released` (4,50 MT) e já sacado |
| `a57a91d8…` (Matola) | 10 MT | `en_route` | `held` — 9,00 MT retidos em escrow |

- Carteira do mestre (`mestre@teste.com`): **0,00 MT disponíveis** — correto, porque o valor do serviço de 10 MT está retido.
- Backup da limpeza: `C:\Users\Acer\AppData\Local\Temp\opencode\buedemestres-backup-1792309029326.json`
- Backup da reversão da conta cliente: `C:\Users\Acer\AppData\Local\Temp\opencode\revert-cliente-1792317545767.json`

## O que foi feito nesta sessão

1. **Limpeza de pedidos antigos** — mantidos apenas os pedidos de 5 e 10 MT; removidos pedidos, jobs, pagamentos, propostas e notificações antigas.
2. **Geofence de chegada** — o mestre só consegue tocar em "Já Cheguei" se estiver a ≤ 200 m do cliente (`apps/pro/app/trabalho/a-caminho.tsx`).
3. **Pagamento do 10 MT** — a PaySuite confirmava `completed`, mas localmente estava `failed`. Corrigida a corrida entre confirmação e falha (`apps/web/src/lib/job-payment.ts`) e reconciliado o pagamento para `held`.
4. **Regressão de estado** — a tela `a-caminho` passou a carregar o estado real do job e deixou de voltar para `en_route` depois de chegar/iniciar.
5. **APK mestre** — pedidos passam a aparecer para todas as categorias do mestre (2, 8, 10, 11, 13, 31) e a home tem scroll.
6. **Escrow na home do mestre** — novo cartão "Retido em escrow" com o valor que será libertado.
7. **Contas** — a conta `cliente@teste.com` tinha sido promovida a `provider` e ganhou perfil de mestre; foi revertida para `client` e o perfil de mestre errado foi removido. A app mestre deixou de promover automaticamente contas existentes.
8. **Web (Next 16)** — corrigidos `params`/`searchParams` que causavam erro em `/resultados`, `/pedidos/[id]`, `/tickets` e `/tickets/[numero]`. O tracker de pedidos passou a consultar `jobs` em vez da tabela inexistente `service_jobs`.

Commits: `6b6a847`, `8b9f2d0`, `d995bde`, `3e7fcd0`, `0953db6` e o commit desta sessão.

## Implementado (código, nesta sessão)

- **`service_jobs` removido** — o formulário "Chamar Agora" cria agora `service_requests` (fluxo atual) com `target_provider_id`, notificação persistente e event Pusher. O tracker aceita `service_requests` e `jobs`.
- **Estados do trabalho** — `updateJobStatus` passou a atualizar `jobs` com validação de transições; "marcar concluído" pelo mestre passa por `awaiting_confirmation`, deixando a confirmação final para o cliente.
- **Testes** — `npm test` cobre geofence (200 m), corrida confirmação/falha do pagamento e transições de estado (11 testes).
- **Realtime** — migração `0230_realtime_service_requests.sql` aplicada; `service_requests`, `jobs`, `job_payments` e `notifications` estão na publicação `supabase_realtime`.
- **Web** — `/notificacoes` passou a ser rota protegida no `proxy.ts`; dados demo ("Provedor 1", António Cuamba, Maria José) removidos.
- **Repositório** — APK de 96 MB deixou de estar versionado; scripts/actions mortos que usavam `service_jobs` foram removidos.

## O que falta fazer (por prioridade)

### 1. Rebuild do APK mestre (bloqueante)
As correções de categorias, scroll, geofence, estado do job e cartão de escrow **só chegam ao telemóvel com um novo APK**.

```bash
cd apps/pro
npx eas build -p android --profile preview
```

Testar com a conta `mestre@teste.com`:
- ver pedidos de categorias diferentes de Mecânico;
- fazer scroll até aos botões inferiores;
- ver "Retido em escrow: MT 9,00";
- abrir o trabalho de 10 MT e confirmar que o estado é "A caminho" (não volta a "Pronto para partir").

### 2. Confirmar deploy da web
A Vercel deve redeployar o `master`. Verificar em produção:
- `/notificacoes` abre sem branco;
- clicar numa notificação leva a `/pedidos/[id]` sem branco;
- `/resultados?q=mecanico` abre;
- `/tickets` e `/tickets/[numero]` abrem.

Se a página branca de "iniciar serviço" persistir, guardar o **URL exato** e o erro do **Console (F12)**.

### 3. Concluir o fluxo do pedido de 10 MT (teste)
- O mestre tem de estar a ≤ 200 m do ponto em Matola para confirmar chegada.
- Depois: iniciar trabalho → concluir → cliente confirma → pagamento libertado (9,00 MT para a carteira).
- Não marcar como concluído manualmente no banco.

### 4. Código legado de `service_jobs` — resolvido
Migrado para `service_requests`/`jobs`. O tracker `/pedidos/[id]` agora mostra os estados `pending`, em curso, `awaiting_confirmation`, `completed` e cancelado/disputa.

### 5. Robustez e testes — resolvido
- Testes adicionados em `tests/` (geofence, corrida confirmação/falha, transições de estado) e executados com `npm test`.
- `service_requests` adicionado à publicação `supabase_realtime` pela migração `0230_realtime_service_requests.sql` (já aplicada).
- Divergências em que a PaySuite confirma um pagamento localmente `failed` passam a ser registadas com `[payment-divergence]` nos logs.
- Facultativo: configurar um alerta externo sobre esses logs.

### 6. APK cliente
- Validar instalação em 2–3 telemóveis reais (o APK atual verifica assinatura e tem todas as ABIs; falha anterior era conflito com versão antiga).
- Se necessário, subir `versionCode` e gerar build de produção assinado.

### 7. Pequenas melhorias — resolvido
- `/notificacoes` adicionado às rotas protegidas do `proxy.ts`.
- Textos "Provedor 1" e dados de demonstração removidos das apps e da web.
- APK de 96 MB deixou de estar versionado (o diretório `apk/` continua no `.gitignore`).

## Notas de risco
- A limpeza da base de dados é irreversível sem o backup JSON indicado acima.
- O job de 10 MT foi mantido em `en_route` de propósito; o pagamento está `held`, não `released`.
- Não voltar a iniciar sessão na app mestre com a conta de cliente: agora a conta não é promovida, mas também não verá dados de mestre.
