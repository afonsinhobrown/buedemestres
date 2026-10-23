# Relatório de Estado e Pendentes — BueDeMestres

## O que foi Feito Hoje (Sessão Atual)
1. **Identidade Visual ("Placa de Oficina")** + Supabase unificado (sessão anterior).
2. **Código em falta fechado (esta sessão):**
   - `accept_offer` ligado na app Pro (`oferta/[offerId].tsx` e preferência no aceite da home).
   - Libertação automática do escrow após 24 h (`migrations/0244_auto_release_and_dispatch.sql`).
   - Robô de despacho: cria `request_offers` para mestres perto (trigger + cron).

## O que Falta Fazer (não é código urgente)
1. **Aplicar a migração 0244** na BD Supabase nova (`run_all_migrations` ou SQL Editor).
2. **Testar o fluxo end-to-end** cliente → mestre (realtime + aceite).
3. **Gerar novos APKs** se for para telemóvel (`eas build`).
4. **Commit/push** do visual + destas correções (se ainda não estiver no remoto).

## Ainda por codar (produto / negócio — não bloqueia piloto)
- Chat e orçamentos na web ligados à BD (ainda demo em partes).
- Multicaixa; KYC com fornecedor real; contrato M-Pesa/e-Mola.
- Moderação de avaliações; reembolso parcial.

*Quando quiseres testar: "Podemos começar os testes!"*
