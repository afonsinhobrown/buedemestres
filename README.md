# BUÉ DE MESTRES — Estado do Projecto
**Última actualização:** 30 Set 2026

## Estrutura
```
buedemestres/
├─ apps/
│  ├─ web/       → Next.js (site público, admin, superadmin)
│  ├─ cliente/   → Expo React Native (app do cliente)
│  └─ pro/       → Expo React Native (app do mestre)
├─ packages/
│  ├─ domain/    → regras partilhadas (estados, comissões, formatação MT)
│  └─ providers/ → interfaces PaymentProvider, KycProvider, MapProvider
├─ migrations/   → SQL 0001–0200 (Neon, já aplicadas)
└─ turbo.json
```

## Fases Concluídas
- **Fase 0:** Monorepo, DB, tokens de design, PostGIS
- **Fase 1:** Auth (JWT, proxy, middleware)
- **Fase 2:** Catálogo, pesquisa, perfil público do mestre
- **Fase 3:** Pedidos, orçamentos, chat
- **Fase 4:** Trabalhos, avaliações, carteira, planos

## Próximos ficheiros a criar (por ordem)
1. `apps/pro/app/trabalho/propor-preco.tsx`
2. `apps/pro/app/trabalho/aguardar-pagamento.tsx`
3. `apps/pro/lib/location-task.ts` (background location)
4. `apps/pro/app/verificacao/` (fluxo KYC 9 passos)
5. `apps/web/src/app/(admin)/verificacoes/page.tsx`
6. `apps/web/src/app/(admin)/pagamentos/page.tsx`
7. Worker de despacho (Edge Function)

## Comandos para retomar
```bash
git pull origin master
pnpm install          # na raiz
cd apps/web && npm run dev
cd apps/cliente && npx expo start
cd apps/pro && npx expo start
```

## Variáveis de ambiente necessárias (.env.local)
```
DATABASE_URL=postgresql://neondb_owner:***@ep-small-rain-***.neon.tech/buedemestres?sslmode=require
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
```
