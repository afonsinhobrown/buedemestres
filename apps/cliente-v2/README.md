# Bué de Mestres — Cliente v2

Nova geração visual da app do cliente. A app antiga (`apps/cliente`) continua intacta e funcional.

## O que é

- Mesma base funcional: Supabase, API web, pedidos, propostas, chat, notificações, avaliações e pagamentos.
- Novo shell visual: tema claro, cartões, navegação inferior e novos ecrãs de entrada/conta.
- Ecrãs principais redesenhados: início, pedidos, notificações e conta.
- Os restantes ecrãs foram clonados da v1 e continuam acessíveis; serão migrados para o novo visual de forma incremental.

## Correr localmente

```bash
pnpm --filter cliente-v2 start
pnpm --filter cliente-v2 web     # http://localhost:8091
```

O script já define `EXPO_NO_METRO_WORKSPACE_ROOT=1`, necessário para o Metro resolver a entrada correctamente neste monorepo.

## Build

- Bundle ID: `mz.buedemestres.cliente.v2`
- Scheme: `buedemestrescliente2`
- EAS: ainda sem `projectId` próprio. Criar um projeto EAS novo antes do primeiro build (`eas init`), para não misturar com a app v1.
- O `google-services.json` da v1 não foi copiado; é preciso criar uma app Firebase/EAS própria para push Android.

## Variáveis

As mesmas da v1. Se não existirem, o código usa os fallbacks já existentes (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`).
