# TERMOS DE REFERÊNCIA
## Plataforma Bué de Mestres — conclusão até piloto

**Documento de especificação de âmbito, requisitos, entregáveis e critérios de aceitação**
Versão 1.0 · Outubro de 2026 · Elaborado a partir da análise do código-fonte e da documentação existente do projecto

> **Nota:** este documento traduz o estado real do projecto (fases 0–4 concluídas, pendências identificadas) em Termos de Referência executáveis. Os montantes e datas exactas são fixados em contrato; aqui ficam âmbito, requisitos e critérios objectivos de aceitação.

---

## 1. Identificação e enquadramento

### 1.1 Identificação

| Elemento | Descrição |
|---|---|
| Projecto | Bué de Mestres — marketplace de prestadores de serviços em Moçambique |
| Entidade promotora | [A designar — proprietário do projecto] |
| Objecto dos presentes ToR | Conclusão da plataforma até fase de piloto numa cidade |
| Estado na data | Fases 0–4 concluídas; monorepo, base de dados, site e 2 apps nativas existentes |
| Enquadramento | Documentos de referência do projecto: plano de implementação, adenda on-demand, especificação de tickets/superadmin, especificação de design e relatório de estado |

### 1.2 Objectivo geral

Disponibilizar uma plataforma de contratação de serviços (cliente ↔ mestre) com **pesquisa por proximidade, verificação de identidade, pagamento protegido (escrow) e back-office de gestão**, pronta para operação piloto controlada numa primeira cidade.

### 1.3 Objectivos específicos

1. Eliminar as fragilidades críticas de segurança e consistência identificadas na análise de código (Anexo A).
2. Ligar as funcionalidades actualmente em modo demonstração (chat, orçamentos, pesquisa) à base de dados real.
3. Implementar o despacho on-demand automático (atribuição por proximidade).
4. Integrar pagamentos mobile money (M-Pesa / e-Mola) e fornecedor de verificação de identidade (KYC).
5. Garantir cobertura mínima de testes automatizados, documentação operacional e conformidade legal.
6. Preparar a publicação das aplicações nas lojas e o arranque do piloto.

---

## 2. Âmbulo

### 2.1 Inclui

| # | Âmbito |
|---|---|
| 1 | Correcção das 3 ocorrências críticas de segurança/visual (rota `/`, protecção do back-office, `globals.css`) |
| 2 | Verificação de sessão em todas as *server actions* e protecção de rotas staff |
| 3 | Unificação das tabelas de trabalhos e conclusão do modelo de dados (enums de papéis, tabela de push tokens) |
| 4 | Ligação de chat, orçamentos e pesquisa à base de dados na web |
| 5 | Worker de despacho on-demand (invocação de `nearby_providers`, rondas de oferta, expiração de 60 s) |
| 6 | Integração de pagamentos (PaySuite/M-Pesa/e-Mola) com webhook assinado + modo manual mantido |
| 7 | Integração de KYC (OCR, selfie, prova de vida, comparação facial) com revisão humana no back-office |
| 8 | Row Level Security completa nas tabelas sensíveis |
| 9 | Testes automatizados (unidade/integração + ponta-a-ponta críticas) |
| 10 | SEO/PWA mínimos, páginas legais, correção do push notifications mobile |
| 11 | Documentação: API, decisões técnicas, manual operacional do back-office |
| 12 | Acompanhamento do piloto: instrumentação de KPIs e correcções em contracto de garantia |

### 2.2 Exclui

- Custos de licenças, contratos de pagamento e quotas de serviços externos (Neon, Supabase, Pusher, Vercel, EAS) — são da entidade promotora.
- Desenvolvimento de apps nativas para tablet/wearables.
- Marketing, aquisição de utilizadores e operação comercial do piloto.
- Constituição jurídica da entidade e abertura de contas comerciais (dependência externa, ver §7).

### 2.3 Pressupostos

- Acesso permanente a: repositório Git, variáveis de ambiente, bases de dados (Neon e Supabase), contas Vercel/Supabase/Neon, konta de desenvolvedor Google Play/Apple (quando aplicável).
- Decisões de negócio em aberto (Anexo B) tomadas até ao início das fases correspondentes.
- Nenhuma reestruturação de identidade visual, salvo indicação em contrato.

---

## 3. Requisitos funcionais

> Legenda: **[R1]** Prioridade 1 — bloqueante para o piloto · **[R2]** Prioridade 2 — importante · **[R3]** Prioridade 3 — desejável

### 3.1 Módulo Plataforma/Segurança

| ID | Requisito | Critério de aceitação | Prior. |
|---|---|---|---|
| RF-SEG-01 | Corrigir conflito de rota `/` | Existe uma única página inicial; build limpo | R1 |
| RF-SEG-02 | Proteger áreas admin/superadmin | Visitante anónimo redirecionado de qualquer rota staff; resposta 401/redirect testada | R1 |
| RF-SEG-03 | Repor `globals.css` completo | Todos os tokens de cor/radius/tipografia usados pelos componentes definidos; sem marcadores de truncamento | R1 |
| RF-SEG-04 | Verificação de sessão em todas as actions | Nenhuma *server action* sensível executa sem sessão válida (teste automatizado) | R1 |
| RF-SEG-05 | RLS completa | `wallets`, `payments`, `job_payments`, `payouts`, `verification_documents`, `messages` com RLS activa e políticas testadas | R1 |
| RF-SEG-06 | Webhook de pagamento assinado | Pagamento confirmado apenas por payload válido; replays rejeitados; idempotente | R1 |
| RF-SEG-07 | Rate limiting e protecção contra abuso | Limites por IP/conta em registo, entrada, mensagens e pedidos | R2 |
| RF-SEG-08 | Remover/condicionar rota `/dev/design` | Indisponível em produção | R2 |
| RF-SEG-09 | Papéis staff no enum e na sessão | `superadmin`/`finance` existem no enum; guarda de rotas usa o papel real | R1 |
| RF-SEG-10 | Auditoria de ações sensíveis | Todos os ajustes de carteira e moderações registados em `audit_logs` | R2 |

### 3.2 Módulo Cliente

| ID | Requisito | Critério de aceitação | Prior. |
|---|---|---|---|
| RF-CLI-01 | Registo, entrada e recuperação de password | Fluxo completo com validação e mensagens claras | R1 |
| RF-CLI-02 | Publicar pedido (modo agendado) | Pedido guardado com media, categoria e localização; aparece no back-office | R1 |
| RF-CLI-03 | Modo imediato com despacho | Pedido dispara rondas aos mestres próximos; expira se ninguém aceitar em prazo definido | R1 |
| RF-CLI-04 | Chat com o mestre | Mensagens persistidas na BD, entrega em tempo real, histórico acessível | R1 |
| RF-CLI-05 | Seguir mestre a caminho | Mapa com posição actualizada e estado do trabalho | R1 |
| RF-CLI-06 | Confirmar preço e conclusão | Escrow passa `held` → `released` apenas por confirmação do cliente | R1 |
| RF-CLI-07 | Avaliar e responder a avaliações | Só com estado `completed`; nota única por trabalho | R1 |
| RF-CLI-08 | Favoritos, denúncias e notificações | Operacionais e ligados à BD | R2 |
| RF-CLI-09 | Centros de ajuda (tickets) | Abertura, acompanhamento e fecho com SLA | R2 |

### 3.3 Módulo Mestre (profissional)

| ID | Requisito | Critério de aceitação | Prior. |
|---|---|---|---|
| RF-MES-01 | Activação de perfil profissional | Perfil público publicável com serviços, categorias e portefólio | R1 |
| RF-MES-02 | Presença online/offline | Estado reflectido no despacho em < 5 s | R1 |
| RF-MES-03 | Ofertas com contagem de 60 s | Notificação recebida; aceitação/correção registadas; expiração automática | R1 |
| RF-MES-04 | Propor e acordar preço | Proposta enviada ao cliente; aceitação origina pagamento retido | R1 |
| RF-MES-05 | Carteira, carregamentos e payouts | Saldos coerentes; extrato completo; transferência para M-Pesa/e-Mola (ou manual em piloto) | R1 |
| RF-MES-06 | Planos, destaques e afiliados | Assinatura, renovação, efeito na pesquisa, comissão de 10% por 90 dias | R2 |
| RF-MES-07 | Verificação KYC guiada | Documento + selfie + dados confirmados; estados `pending/approved/rejected` visíveis | R1 |
| RF-MES-08 | Notificações push mobile | Token registado na tabela correcta; entrega em dispositivo físico | R1 |

### 3.4 Módulo Administração

| ID | Requisito | Critério de aceitação | Prior. |
|---|---|---|---|
| RF-ADM-01 | Validação de pagamentos manuais | Aprovação credita carteira de forma idempotente | R1 |
| RF-ADM-02 | Revisão de verificações (KYC) | Fila de pendentes com documentos, decisão e registo de auditoria | R1 |
| RF-ADM-03 | Gestão de tickets com SLA | Escalonamento, macros, CSAT, cron de prazos operacionais | R2 |
| RF-ADM-04 | Relatórios operacionais | Métricas de pedidos, trabalhos, receita e mestres por categoria/zona | R2 |
| RF-ADM-05 | Equipa, permissões e MFA | Matriz de 30 permissões, convites, MFA, “ver como”, dupla aprovação | R2 |
| RF-ADM-06 | Moderação de perfis e conteúdo | Suspender/reativar mestre, remover conteúdo, com registo | R1 |

### 3.5 Módulo Despacho (on-demand)

| ID | Requisito | Critério de aceitação | Prior. |
|---|---|---|---|
| RF-DES-01 | Worker de despacho | `nearby_providers()` invocada em cada pedido imediato; rondas ordenadas por distância e nota | R1 |
| RF-DES-02 | Raio e escalonamento | Raio inicial e alargamento configuráveis (`feature_flags`) | R2 |
| RF-DES-03 | Expiração e re-oferta | Pedido reencaminhado ou expirado conforme política configurada | R1 |
| RF-DES-04 | Registo de presença e posições | `provider_presence` e `job_location_log` actualizados | R2 |
| RF-DES-05 | Crons operacionais | SLA de tickets, expirações e agendamentos a correr e monitorizados | R2 |

---

## 4. Requisitos não funcionais

| Área | Requisito | Critério |
|---|---|---|
| Desempenho | Páginas públicas < 2,5 s em 4G; pesquisa < 1,5 s | Medição em Lighthouse/medida real |
| Disponibilidade | 99,5% mensal no piloto | Monitorização activa |
| Escalabilidade | Suportar crescimento do piloto sem reengenharia (indexes, pool de ligações) | Revisão de plano de capacidade |
| Segurança | OWASP Top 10 coberto; secrets só em variáveis de ambiente; HTTPS | Auditoria leve + checklist |
| Privacidade | Dados pessoais minimizados; GPS partilhado apenas com o mestre aceite; direitos de acesso/eliminação | Política de dados + funcionalidade de exportação/apagamento |
| Acessibilidade | Navegação por teclado, contraste e labels em formulários | Checklist WCAG AA nos fluxos críticos |
| Localização | Interface em português de Moçambique; formatação MT; 11 províncias | Sem texto por traduzir nos fluxos críticos |
| Compatibilidade | Android 10+ (app), iOS 15+ (app), Chrome/Safari/Firefox actuais (web) | Teste nos dispositivos-alvo |
| Manutenção | `lint` e `typecheck` verdes no CI; sem erros de build | Pipeline obrigatório |
| Observabilidade | Erros capturados (Sentry ou equivalente) + métricas de negócio | Alertas configurados |

---

## 5. Entregáveis

| # | Entregável | Formato |
|---|---|---|
| E1 | Código-fonte corrigido e funcional em `master`, com histórico de commits | Repositório Git |
| E2 | Migrações SQL novas/alteradas, aplicadas e documentadas | `migrations/` + registo |
| E3 | APKs e binários de piloto (Android) + configuração EAS | Artefacto + `eas.json` |
| E4 | Suíte de testes automatizados (unidade, integração, E2E dos fluxos críticos) | Código + relatório de execução |
| E5 | Documentação técnica: API, decisões arquitectónicas, runbook de operação | Markdown em `docs/` |
| E6 | Manual operacional do back-office (admin/superadmin) | Markdown/PDF |
| E7 | Relatórios de aceitação por fase (contra os critérios da secção 3 e 6) | Documento por fase |
| E8 | Plano de instrumentação de KPIs do piloto | Documento + dashboards |
| E9 | Relatório final de entrega e transferência de conhecimento | Documento + sessão |

---

## 6. Cronograma e fases

| Fase | Conteúdo | Entregas ligadas | Prazo indicativo |
|---|---|---|---|
| **F1 — Emergência** | RF-SEG-01, 02, 03, 04, 09; remoção de rotas mortas | E1, E7 | Semanas 1–2 |
| **F2 — Consolidação** | RF-SEG-05, 06, 10; chat/orçamentos/pesquisa ligados; unificação de tabelas; push mobile corrigido | E1, E2, E4 (parcial), E7 | Semanas 3–5 |
| **F3 — Operação** | Despacho on-demand (RF-DES-01…05); crons; relatórios e moderação (RF-ADM-04, 06) | E1, E2, E7 | Semanas 6–8 |
| **F4 — Dinheiro** | Integração de pagamentos e webhook; payouts; planos/destaques/afiliados validados ponta-a-ponta | E1, E2, E7 | Semanas 9–10 |
| **F5 — Confiança** | KYC integrado + revisão humana no back-office; denúncias e auditoria | E1, E2, E7 | Semanas 11–12 |
| **F6 — Qualidade** | Testes E2E, acessibilidade, observabilidade, segurança, SEO/PWA, páginas legais | E4, E5, E7 | Semanas 13–14 |
| **F7 — Entrega** | APKs finais, manual operacional, formação, relatório final | E3, E5, E6, E8, E9 | Semana 15 |
| **F8 — Garantia** | Acompanhamento do piloto e correcções | Relatórios semanais | 8 semanas após entrega |

**Marcos de pagamento associados** (a detalhar em contrato): conclusão de F1, F3, F5, F7 e conclusão da garantia F8.

---

## 7. Dependências e decisões externas

| # | Dependência | Bloqueia | Responsável |
|---|---|---|---|
| D1 | Fornecedor de KYC escolhido e contratado | F5 | Promotor |
| D2 | Contrato de pagamentos M-Pesa/e-Mola (ou validação do modo manual para piloto) | F4 | Promotor |
| D3 | Definição de comissões e preços finais | F4 | Promotor |
| D4 | Enquadramento legal da retenção de valores (entidade/conta de custódia) | Piloto com escrow real | Promotor + jurídico |
| D5 | Contas Google Play / Apple Developer | F7 | Promotor |
| D6 | Decisão sobre aceitação de dinheiro em mão no piloto | F3 | Promotor |
| D7 | Acesso a contas e secrets (Neon, Supabase, Vercel, Pusher) | F1 | Promotor |

> **Risco regulatório:** reter dinheiro de terceiros pode exigir entidade legal autorizada e conta de custódia em Moçambique. Enquanto D4 não estiver resolvida, manter `PAYMENT_PROVIDER=manual` e limitar o piloto a montantes baixos.

---

## 8. Governança e reportagem

| Aspecto | Regra |
|---|---|
| Cadência | Reunião semanal de estado (15 min) + relatório escrito por fase |
| Repositório | Commits pequenos e descritivos; `master` sempre compilável |
| Qualidade | `lint`, `typecheck` e testes obrigatórios antes de cada merge |
| Mudanças | Pedidos de alteração de âmbito registados com impacto em prazo/âmbito, aprovados por escrito |
| Aceitação | Cada fase só é aceite com relatório contra os critérios da secção 3 |
| Escalação | Bloqueios de dependências (secção 7) escalados em 48 h |

---

## 9. Propriedade intelectual, confidencialidade e garantia

1. **Propriedade:** todo o código, documentação e design produzidos pertencem integralmente à entidade promotora, com entrega contínua no repositório desde o primeiro commit.
2. **Confidencialidade:** informações de negócio, métricas, credenciais e acessos são confidenciais; acesso mínimo necessário; credenciais nunca em código.
3. **Garantia:** 8 semanas de garantia sobre defeitos das entregas, com correcção sem custo e prazos acordados por severidade (crítico 24 h, alto 3 dias, médio 10 dias úteis).
4. **Terceiros:** bibliotecas de código aberto usadas sob licenças compatíveis com a exploração comercial (ver `package.json`).

---

## 10. Critérios gerais de aceitação (Definition of Done)

Uma entrega é aceite quando **todos** os pontos se verificam:

- [ ] Requisito verificado com o critério objectivo da secção 3.
- [ ] `lint`, `typecheck` e build de produção verdes.
- [ ] Testes automatizados correspondentes a passar.
- [ ] Sem regressão nos fluxos críticos (registo, pedido, despacho, pagamento, conclusão, avaliação).
- [ ] Migrações aplicadas de forma reproduzível em ambiente limpo.
- [ ] Documentação actualizada (`docs/`, README, runbook).
- [ ] Revisão de código aprovada e registada no repositório.

---

# Anexo A — Pendências críticas herdados da análise de código

| # | Severidade | Pendência | Fase |
|---|---|---|---|
| 1 | Crítica | Conflito de rota `/` (`app/page.tsx` vs `(superadmin)/page.tsx`) | F1 |
| 2 | Crítica | Área admin acessível a anónimos (prefixos de `proxy.ts` ≠ rotas reais) | F1 |
| 3 | Crítica | `globals.css` truncado (tokens em falta) | F1 |
| 4 | Alta | `jobs.ts` e `payments.ts` sem verificação de sessão | F1 |
| 5 | Alta | RLS só em 5 tabelas de tickets | F2 |
| 6 | Alta | Tabelas concorrentes `jobs` vs `service_jobs` | F2 |
| 7 | Média | Enum `user_role` sem papéis staff; push escreve em tabela inexistente | F1/F2 |
| 8 | Média | Chat/orçamentos/pesquisa em modo demonstração | F2 |
| 9 | Média | Zero testes automatizados | F2/F6 |
| 10 | Média | Worker de despacho inexistente; crus não confirmados | F3 |
| 11 | Baixa | Páginas legais, SEO/PWA, rota `/dev/design` exposta | F6 |

# Anexo B — Decisões de negócio em aberto

1. Fornecedor de KYC (D1).
2. Provedor de mapas e política de raio do piloto.
3. Comissões finais por plano (12/8/5% actualmente especificados) e preços dos planos (500/1.500 MZN).
4. Aceitação de dinheiro em mão durante o piloto (D6).
5. Constituição da entidade e contas comerciais M-Pesa/e-Mola (D2/D4).
6. Contas Google Play e Apple (D5).

# Anexo C — Glossário

| Termo | Significado |
|---|---|
| **Mestre** | Profissional registado com perfil activo na plataforma |
| **Pedido** | Manifestação de necessidade do cliente (imediato ou com orçamentos) |
| **Trabalho (job)** | Contratação em execução entre cliente e mestre |
| **Escrow** | Retenção do valor do serviço até a conclusão confirmada |
| **KYC** | Verificação de identidade (documento, selfie, comparação facial) |
| **Carteira** | Saldo do mestre na plataforma |
| **Boost/destaque** | Pagamento para prioridade em pesquisa/categorias |
| **Ronda** | Sequência de ofertas enviadas a mestres próximos num pedido imediato |

---

*Elaborado sem alterar qualquer ficheiro preexistente. Fontes: análise de código do repositório, README.md, plano de implementação, adenda on-demand, especificação de tickets/superadmin e relatório de estado. Este documento não substitui revisão jurídica.*
