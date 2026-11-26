# Pendentes — Bué de Mestres

**Actualizado:** 26 Nov 2026

## Estado actual

- Apps v2 (cliente/pro) criadas e a correr em paralelo com as v1.
- Home, login, conta e tabs principais das v2 com layout novo.
- Migrações `0254`–`0259` aplicadas (pagamentos, split, catálogo, sintomas, lotes).
- Auth das APIs fechada: cookie web ou Bearer Supabase JWT.
- Apps v1 e v2 passaram a enviar o JWT (`apiFetch`).
- APKs v1/v2 reconstruídos com a auth nova.
- Links web das v2 publicados para iPhone.

## P0 — antes de produção

1. **RLS/grants da base de dados** — continua aberta via chave `anon`:
   - 39 tabelas sem RLS;
   - `user_passwords`, `payments`, `wallet_transactions`, `app_settings`, `staff_profiles`, etc.;
   - funções `SECURITY DEFINER` executáveis por `anon`.
2. **Remover/rodar contas de teste** `@teste.com` e `password123`.
3. **Remover o top-up automático da web** (`createTopUpPayment` chama `complete_payment` sem pagamento).
4. **Rate limiting** em login e endpoints públicos.

## P1 — fluxo novo

5. Adaptar endpoints de pagamento para:
   - deslocação (`job_charges kind='travel'`);
   - diferença de reclassificação;
   - PIN de conclusão;
   - `settle_job` no release.
6. Implementar reclassificação no local (criar/aceitar/recusar/segunda opinião).
7. Implementar lotes de saque diários (`payout_batches`).
8. Activar catálogo e preços por categoria (os itens actuais estão `active=false`).
9. Preencher sintomas e regras de preço por categoria/distrito.
10. Actualizar UI v2: sintomas, catálogo, orçamento, reclassificação, PIN.
11. Migrar ecrãs secundários das v2 para o visual novo.
12. Canais Pusher privados com autorização.

## P2 — lançamento

13. Criar projectos EAS e Firebase/FCM novos.
14. Gerar APK universal/32-bit e builds de produção com keystore próprio.
15. Preparar iOS/TestFlight (conta Apple Developer).
16. Testes em telemóveis reais: GPS background, câmara/KYC, push, QR, pagamentos.
17. Testes E2E dos fluxos e excepções (cancelamento, no-show, recusa de PIN).
18. Actualizar README/docs e limpar artefactos antigos.

## Links web temporários

- Cliente v2: https://buedemestres.vercel.app/apps/cliente-v2
- Pro v2: https://buedemestres.vercel.app/apps/pro-v2

São links web (Safari/Chrome), não App Store/TestFlight. Para iPhone nativo é necessário Apple Developer/TestFlight.
