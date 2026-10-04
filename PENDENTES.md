# Pendentes — BueDeMestres (retomar após reiniciar)

## Feito (último build OK)
- APK cliente com Firebase (Supabase removido do cliente):
  - Build: c3878d02-a965-468b-a2f5-d57710c09448
  - APK: https://expo.dev/artifacts/eas/dYCIKqLPGFy5N8ALW9BBm-o2lV-KrGPmC7dtfi6sWqE.apk
- apps/cliente/lib/firebase.ts — init Firebase (projeto `buedemestres`) + `auth`
- apps/cliente/lib/useAuthStore.ts — reescrito para Firebase Auth (User, onAuthStateChanged, signOut)
- apps/cliente/lib/supabase.ts — eliminado
- apps/cliente/package.json — `firebase ^11.0.0`; sem `@supabase/supabase-js`
- pnpm-lock.yaml — atualizado (`pnpm install --lockfile-only`; firebase@11.10.0)
- .npmrc (raiz) — `node-linker=hoisted` (indispensável para o build cloud; NÃO está gitignored, por isso o EAS envia-o)

## Pendentes
1. App cliente é esqueleto: home estático; botões apontam para `/pesquisar` e `/categorias` (rotas INEXISTENTES); sem ecrã de login (`entrar.tsx` não existe); `useAuthStore.initialize()` nunca é chamado; Firebase ligado mas não usado por nenhuma tela.
2. Criar telas: `app/(auth)/entrar.tsx` (login email/senha Firebase), `app/pesquisar.tsx`, `app/categorias.tsx`.
3. Chamar `useAuthStore.initialize()` no `_layout.tsx`.
4. apps/pro AINDA usa Supabase (`@supabase/supabase-js ^2.46.1`, `pro/lib/supabase.ts`, `pro/lib/useAuthStore.ts`) — migrar só se quiser.
5. node_modules local partido (Windows `ERR_PNPM_EPERM`). Após reiniciar: tentar `pnpm install`; se falhar, `pnpm install --lockfile-only`. O build cloud (Linux) não é afetado.
6. Nada está commitado (git status com alterações por commitar).

## Comandos
- Build: `cd apps/cliente; eas build -p android --profile preview --non-interactive`
- Logs (EAS CLI 24.x não tem `eas build:logs`): `eas build:view <id> --json` → `logFiles[0]` (URL GCS, expira 900s) → conteúdo Brotli → descomprimir com Node `zlib.brotliDecompressSync`
- Lockfile sem linkar: `pnpm install --lockfile-only`

## Notas
- EAS: projeto `@afonsinhobrown/bue-de-mestres-cliente`, projectId `62e05d63-f796-43e7-bd5d-574419f7d502`; conta `afonsinhobrown`; keystore `zovVKizTq8` (default).
- `react-native-maps` está no package.json mas não é usado (só comentário) — não precisa de chave Google Maps.
- Disco C: tinha 0,05 GB; foram libertados ~8,26 GB (caches .gradle, npm, Temp).
- Utilizador NÃO quer Supabase (quota esgotada). Não mencionar Supabase além da migção do `pro`.
