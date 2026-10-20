# Bué de Mestres — Regras Implementadas no Sistema

**Documento de referência funcional e financeira**
Data: 20 de outubro de 2026
Âmbito: regras efetivamente implementadas no código (`apps/web`, `apps/pro`, `apps/cliente`) e nas migrations Supabase (`migrations/0001` a `0237`).

> **Critério de leitura:** este documento descreve o que o sistema **faz hoje**, não o que os documentos comerciais prometem. Quando existe divergência entre documentação e código, a regra indicada é a do código e a divergência é assinalada. Valores em **MT (MZN)**.

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Atores e permissões](#2-atores-e-permissões)
3. [Pedidos: criação, ofertas e aceitação](#3-pedidos-criação-ofertas-e-aceitação)
4. [Estados e transições](#4-estados-e-transições)
5. [Negociação de preço](#5-negociação-de-preço)
6. [Execução do serviço, tracking e QR](#6-execução-do-serviço-tracking-e-qr)
7. [Aditamentos (trabalho adicional)](#7-aditamentos-trabalho-adicional)
8. [Cancelamentos e abandono](#8-cancelamentos-e-abandono)
9. [Disputas](#9-disputas)
10. [Punições, multas e anti-abuso](#10-punições-multas-e-anti-abuso)
11. [Reputação e avaliações](#11-reputação-e-avaliações)
12. [Pagamentos e escrow](#12-pagamentos-e-escrow)
13. [Taxas, comissões e fidelidade](#13-taxas-comissões-e-fidelidade)
14. [Reembolsos](#14-reembolsos)
15. [Saques e payouts](#15-saques-e-payouts)
16. [Receita da plataforma e sócios](#16-receita-da-plataforma-e-sócios)
17. [Todas as formas de entrada de dinheiro](#17-todas-as-formas-de-entrada-de-dinheiro)
18. [Planos, créditos e subscrições](#18-planos-créditos-e-subscrições)
19. [Carteira e carregamentos](#19-carteira-e-carregamentos)
20. [Referidos e afiliados](#20-referidos-e-afiliados)
21. [Destaques e publicidade](#21-destaques-e-publicidade)
22. [Sandbox e mestres de teste](#22-sandbox-e-mestres-de-teste)
23. [KYC, empresas e termos](#23-kyc-empresas-e-termos)
24. [Prazos, timers e cron jobs](#24-prazos-timers-e-cron-jobs)
25. [Divergências e limitações conhecidas](#25-divergências-e-limitações-conhecidas)
26. [Resumo rápido de valores](#26-resumo-rápido-de-valores)

---

## 1. Visão geral

O sistema é um marketplace de serviços em Moçambique com três apps:

| App | Função |
|---|---|
| `apps/cliente` | Cliente cria pedidos, negocia, paga, acompanha e confirma serviços |
| `apps/pro` | Mestre/profissional recebe pedidos, negoceia, executa e recebe |
| `apps/web` | Painel web, APIs, backoffice (admin, superadmin, finance, support) e site |

Modelo económico central:

1. O **cliente paga** para um **escrow** (valor retido), via PaySuite.
2. O **mestre executa** o serviço e marca a conclusão.
3. O **cliente confirma**; só então o escrow liberta o valor para a carteira do mestre.
4. A **plataforma retém uma comissão** sobre o serviço.
5. O mestre pede **saque** da carteira para M-Pesa, e-Mola ou banco.

Fonte de verdade: migrations SQL e rotas de `apps/web/src/app/api`. As apps móveis chamam diretamente o Supabase em vários fluxos.

---

## 2. Atores e permissões

### 2.1 Papéis

| Papel | Origem |
|---|---|
| `client` | `migrations/0001_extensions_enums.sql:8` |
| `provider` (mestre) | idem |
| `admin` | idem |
| `superadmin`, `finance`, `support`, `moderator` | `migrations/0215_user_role_staff.sql:2-5` |

Papéis de staff não substituem automaticamente `admin`: cada ecrã valida papéis específicos. Exemplo: o KYC só pode ser revisto por `admin` (`apps/web/src/app/(admin)/verificacoes/actions.ts:7-9`).

### 2.2 Regras de acesso por ação

| Ação | Cliente | Mestre | Staff/Admin |
|---|---|---|---|
| Criar pedido | Sim, próprio | Não | Não |
| Ver pedido | Próprio, dirigido a si, ou `open` | Se for alvo ou `open` | Via backoffice/service role |
| Aceitar pedido | Não | Sim, com verificações | Não |
| Propor preço | Não | Sim | Não |
| Contrapropor | Sim | Sim (aceitando contraproposta) | Não |
| Pagar | Sim | Não | Não |
| Iniciar deslocação/chegada/serviço | Não | Sim | Não |
| Marcar conclusão | Não | Sim | Não |
| Confirmar e libertar pagamento | Sim | Não | Sim (via disputa) |
| Cancelar pedido não pago | Sim (`open`/`in_negotiation`) | Não existe fluxo | Não |
| Cancelar pedido pago | Sim (`price_agreed`/`en_route`/`arrived`) | Não existe fluxo | Sim (via disputa) |
| Abrir disputa | Sim, com pagamento `held` | Não | — |
| Resolver disputa | Não | Não | `admin`, `superadmin`, `finance`, `support` |
| Avaliar | Sim, job `completed` | Responde uma vez | Moderação não implementada |
| Rever KYC | Não | Submete o próprio | Apenas `admin` |
| Aprovar empresa | Não | Cria empresa | `admin`/`superadmin` |
| Aprovar payout de mestre | Não | Pede saque | `superadmin` |
| Gerir sócios/saques da plataforma | Não | Não | `superadmin` |

Referências principais: `migrations/0210_rls_policies.sql:43-70`; `apps/pro/app/index.tsx:339-433`; `apps/web/src/app/(admin)/tickets/actions.ts:46-50`.

### 2.3 Suspensão

- `profiles.is_active` existe (`migrations/0002_base_tables.sql:41`).
- O login web recusa contas inativas com “Conta suspensa” (`apps/web/src/app/actions/auth.ts:150-152`).
- Staff pode ser suspenso pelo superadmin (`apps/web/src/app/(superadmin)/superadmin/equipa/actions.ts:94-102`).
- **Limitação:** `is_active` não é verificado pelas RLS, pelas apps móveis nem em sessões já emitidas. A suspensão de um utilizador comum não invalida sessões móveis.

---

## 3. Pedidos: criação, ofertas e aceitação

### 3.1 Criação de pedidos

- `service_requests` suporta `mode` (`quote` por omissão), `urgency` (`scheduled` por omissão), localização, `search_radius_m` (5000 m por omissão) e `expires_at` = `now() + 14 dias` (`migrations/0200_on_demand.sql:10-16`; `migrations/0003_requests_jobs_chat.sql:17`).
- Pedido dirigido a um mestre usa `target_provider_id` (`migrations/0003_requests_jobs_chat.sql:8`).
- O fluxo web “chamar mestre” cria pedido `open` com `target_provider_id`, localização Maputo e modo implícito `quote` (`apps/web/src/app/actions/jobs.ts:63-78`).
- O fluxo móvel urgente cria `mode='on_demand'`, `urgency='sos'`, raio 5000 m, após validar `client_can_open_request` (`apps/cliente/app/pedido/a-procurar.tsx:117-159`).
- O fluxo web de pedido normal não define modo, urgência nem localização: fica `quote`/`scheduled` (`apps/web/src/app/actions/requests.ts:45-63`).

### 3.2 Ofertas on-demand

- `request_offers` guarda uma oferta por pedido/mestre, com `round`, distância, ETA, `expires_at` obrigatório e unicidade `(request_id, provider_id)` (`migrations/0200_on_demand.sql:32-46`).
- A UI mostra uma contagem de **60 segundos** para aceitar (`apps/pro/app/oferta/[offerId].tsx:7,20-29`).
- Só são elegíveis para oferta mestres que cumpram **todas** as condições (`migrations/0200_on_demand.sql:162-183`):
  - online com presença atualizada nos últimos 90 s;
  - sem `active_job_id`;
  - da categoria do pedido;
  - dentro do raio;
  - perfil publicado e disponível;
  - verificação `approved`.
- A RPC `accept_offer` exige oferta do próprio mestre, não expirada, pedido `open`, mestre sem job ativo; aceita, cancela as restantes ofertas, cria job e ocupa a presença (`migrations/0200_on_demand.sql:185-213`).
- **Limitação:** `accept_offer` não é usado pelo fluxo móvel real (há um `TODO`), e o fluxo atual não marca `active_job_id` (`apps/pro/app/oferta/[offerId].tsx:31-35`; `apps/pro/app/index.tsx:435-488`).

### 3.3 Condições para o mestre aceitar um pedido

No fluxo móvel, a aceitação só ocorre se, por esta ordem (`apps/pro/app/index.tsx:339-420`):

1. `provider_can_accept` = verdadeiro:
   - não estar em cooldown;
   - `master_can_operate` = saldo ≥ 200 MT (0 em sandbox).
   Referência: `migrations/0231_escrow_guard_and_fines.sql:52-63`.
2. Trial válido (se aplicável): menos de 5 serviços desde o início do trial e `trial_ends_at > now()`.
3. Plano ativo com serviços mensais disponíveis (`max_services`).
4. Quota da empresa disponível (`company_can_accept`), quando aplicável.
5. Consumir **1 crédito de serviço**.

**Importante:** a ordem consome o crédito antes de tentar atualizar o pedido. Se o aceite falhar (pedido já atribuído), o crédito não é devolvido automaticamente (`apps/pro/app/index.tsx:409-443`).

### 3.4 Limites de pedidos do cliente

- Máximo de **2 pedidos ativos** (`open`/`in_negotiation`) por cliente (`migrations/0204_anti_abuse_reliability.sql:11-12,84-95`).
- O trigger de limite aplica-se **apenas** a pedidos `mode='on_demand'` (`migrations/0204_anti_abuse_reliability.sql:103-116`). Pedidos `quote` não são limitados.

---

## 4. Estados e transições

### 4.1 Estados de `service_requests`

`open`, `in_negotiation`, `accepted`, `in_progress`, `completed`, `cancelled`, `expired`, `price_proposed`, `puxado` (`migrations/0001_extensions_enums.sql:11`; `migrations/0199_enums.sql:13-14`; `migrations/0224_negotiation_enum_values.sql:6-7`).

Estados efetivamente escritos pelo código:

| Estado | Quando |
|---|---|
| `open` | Criação |
| `accepted` | Mestre aceita; pagamento confirmado |
| `price_proposed` | Mestre propõe preço |
| `puxado` | Cliente faz contraproposta |
| `in_progress` | Serviço iniciado |
| `completed` | Pagamento libertado |
| `cancelled` | Cancelamento |
| `in_negotiation` / `expired` | Existem no enum, mas não foram encontrados escritores |

### 4.2 Estados de `jobs`

`requested`, `scheduled`, `accepted`, `in_progress`, `completed`, `cancelled`, `disputed`, `en_route`, `arrived`, `price_proposed`, `price_agreed`, `in_service`, `puxado`, `awaiting_confirmation`, `expired` (`migrations/0001_extensions_enums.sql:13`; `migrations/0199_enums.sql:2-11`; `migrations/0224_negotiation_enum_values.sql:9-11`).

### 4.3 Transições permitidas

Tabela implementada em `apps/web/src/lib/job-flow.ts:4-25`:

| De | Para |
|---|---|
| `requested` | `accepted`, `cancelled`, `expired` |
| `scheduled` | `accepted`, `in_progress`, `awaiting_confirmation`, `cancelled`, `expired` |
| `accepted` | `price_proposed`, `puxado`, `price_agreed`, `en_route`, `cancelled`, `expired` |
| `price_proposed` | `puxado`, `price_agreed`, `cancelled`, `expired` |
| `puxado` | `price_proposed`, `price_agreed`, `cancelled`, `expired` |
| `price_agreed` | `en_route`, `cancelled`, `expired` |
| `en_route` | `arrived`, `in_service`, `cancelled`, `expired` |
| `arrived` | `in_service`, `cancelled`, `expired` |
| `in_service` | `awaiting_confirmation`, `cancelled`, `disputed` |
| `in_progress` | `awaiting_confirmation`, `completed`, `cancelled`, `disputed` |
| `awaiting_confirmation` | `completed`, `disputed`, `in_service` |
| `disputed` | `completed`, `cancelled`, `in_service` |
| `completed`, `cancelled`, `expired` | Terminais |

**Limitações:**
- A tabela não é imposta pela base de dados; é validada apenas na server action `updateJobStatus` (`apps/web/src/app/actions/jobs.ts:137-139`).
- As RLS permitem updates de estado pelos participantes (`migrations/0210_rls_policies.sql:67-70`).
- O fluxo real usa `price_agreed -> in_service` diretamente (`apps/pro/app/trabalho/a-caminho.tsx:334`), transição não prevista na tabela.

### 4.4 Estados financeiros

- `job_payments`/`job_addenda`: `pending_payment`, `held`, `released`, `refunded`, `partially_refunded`, `disputed`, `failed` (`migrations/0200_on_demand.sql:6`; `migrations/0205_payment_failure_status.sql:4`).
- `payments` (carregamentos): `pending`, `completed`, `failed`, `expired`.
- `job_refunds`: `pending`, `processing`, `completed`, `failed` (`migrations/0232_paysuite_refunds.sql:41-44`).
- `payouts`: `pending`, `processing`, `completed`, `failed`.
- `platform_withdrawals`: `pending_approval`, `processing`, `completed`, `failed`, `cancelled`.

---

## 5. Negociação de preço

### 5.1 Como funciona

1. Mestre envia proposta: job passa a `price_proposed`, pedido guarda `price_proposed`/`budget_max`, é criada proposta `pending` e o turno passa ao cliente (`apps/pro/app/trabalho/propor-preco.tsx:269-339`).
2. Cliente escolhe:
   - **Concordar** → paga via PaySuite. A proposta só fica `accepted` após confirmação do pagamento (`apps/cliente/app/pedido/proposta-preco.tsx:203-291`).
   - **“Está puxado”** → contraproposta. Chama `set_negotiation_turn` com o turno para o mestre; job e pedido passam a `puxado` (`apps/cliente/app/pedido/proposta-preco.tsx:309-406`).
   - **Não concordar** → pode pagar apenas deslocação/diagnóstico de **250 MT** ou rejeitar (`apps/cliente/app/pedido/proposta-preco.tsx:442-505,783-830`).
3. Mestre pode aceitar a contraproposta, inserindo nova proposta e repondo `price_proposed` (`apps/pro/app/trabalho/aguardar-pagamento.tsx:166-222`).

### 5.2 Regras e prazos

Configuração (`migrations/0202_negotiation_lifecycle.sql:9-20`):

| Regra | Valor |
|---|---|
| Rondas máximas | **3** |
| Turno em `sos` / `today` | **10 minutos** |
| Turno em `scheduled` | **1440 minutos (24 h)** |

- `set_negotiation_turn` valida o dono do turno (`client`/`provider`), conta rondas apenas em contraproposta e define `negotiation_state` e `turn_expires_at` (`migrations/0202_negotiation_lifecycle.sql:53-84`).
- `close_negotiation` limpa o turno e marca `negotiation_state='acordado'` (`migrations/0202_negotiation_lifecycle.sql:87-97`).
- O fecho por pagamento é feito fora da RPC: pagamento confirmado → job `price_agreed`, `negotiation_state='acordado'`, `agreed_amount`, pedido `accepted` (`apps/web/src/lib/job-payment.ts:118-136`).

### 5.3 Expiração do turno

Um cron corre a cada **1 minuto** (`migrations/0202_negotiation_lifecycle.sql:173-181`). Quando o turno expira:

- propostas `pending` passam a `withdrawn`;
- job passa a `cancelled` com `cancel_reason` `expirado_mestre` ou `expirado_cliente`;
- pedido volta a `open` e `target_provider_id=null`;
- presença do mestre é libertada;
- é registado abandono e possível cooldown;
- o responsável é notificado.

Referências: `migrations/0202_negotiation_lifecycle.sql:100-159`; `migrations/0204_anti_abuse_reliability.sql:119-201`.

### 5.4 Pagamento de “apenas deslocação/diagnóstico” — 250 MT

- O cliente pode atualizar a proposta do mestre para **250 MT**, marcar job e pedido como `completed`, **sem criar `job_payments` nem pagar ao mestre** (`apps/cliente/app/pedido/proposta-preco.tsx:442-487`).
- Esta é uma regra de produto implementada de forma incompleta: não há escrow nem payout associado.

---

## 6. Execução do serviço, tracking e QR

### 6.1 Deslocação e chegada

- O mestre inicia a deslocação: job → `en_route`, com `transport_mode` (`apps/pro/app/trabalho/a-caminho.tsx:198-249`).
- A chegada só é aceite a **200 metros** do ponto do cliente (`apps/pro/lib/geo.ts:3-5,39-45`; `apps/pro/app/trabalho/a-caminho.tsx:251-300`).
- Início do serviço: job → `in_service`, `started_at` preenchido, pedido → `in_progress` (`apps/pro/app/trabalho/a-caminho.tsx:326-371`).

### 6.2 Tracking

- O mestre atualiza `provider_lat`, `provider_lng`, `provider_heading` e `location_updated_at` a cada **8 s / 10 m** (`apps/pro/app/trabalho/a-caminho.tsx:149-179`; `migrations/0208_tracking_and_addenda.sql:2-5`).
- O cliente faz polling a cada **2 s** (`apps/cliente/app/pedido/mestre-a-caminho.tsx:70-179`).
- `/api/tracking` existe, mas não persiste nada e não tem autenticação (`apps/web/src/app/api/tracking/route.ts:4-25`).
- `job_location_log` existe, mas não foram encontradas escritas (`migrations/0200_on_demand.sql:69-75`).

### 6.3 QR de início/fim

- O mestre gera um token de 24 bytes, válido **10 minutos**; o código manual são os últimos 6 caracteres (`apps/web/src/app/api/jobs/qr/route.ts:37-58`).
- QR de início exige job `arrived` ou `price_agreed`; QR de conclusão exige `in_service` (`apps/web/src/app/api/jobs/qr/validate/route.ts:78-84`).
- O QR pertence ao cliente do job e ao mestre atribuído, não pode ser reutilizado nem estar expirado (`apps/web/src/app/api/jobs/qr/validate/route.ts:63-76`).

### 6.4 Conclusão

- O mestre marca o fim: job → `awaiting_confirmation`; pedido permanece `in_progress`; o cliente é notificado (`apps/pro/app/trabalho/em-curso.tsx:87-130`; `apps/web/src/app/actions/jobs.ts:120,141-169`).
- O mestre **não** recebe diretamente: precisa da confirmação do cliente (ou de um QR de fim, que também coloca `awaiting_confirmation`).

---

## 7. Aditamentos (trabalho adicional)

- `job_addenda` tem valor > 0, comissão, payout, descrição, método, estado de escrow e referência PaySuite (`migrations/0208_tracking_and_addenda.sql:7-24`).
- Só pode existir **um aditamento ativo** por job (`pending_payment` ou `held`) — índice único parcial (`migrations/0208_tracking_and_addenda.sql:27-29`).
- O mestre cria via `/api/payments/addendum`:
  - valor > 0;
  - descrição ≥ 3 caracteres;
  - respeita o intervalo de sandbox;
  - comissão = taxa do pagamento principal ou **20%** por omissão.
  Referência: `apps/web/src/app/api/payments/addendum/route.ts:9-60`.
- O cliente paga; o aditamento passa a `held` quando a PaySuite confirma (`apps/web/src/lib/job-payment.ts:174-219`).
- Não há aceitação explícita separada: pagar é aceitar.
- Em disputa, aditamentos `held` passam a `disputed` (`apps/web/src/app/api/payments/dispute/route.ts:47-50`).
- Em estorno, o valor do aditamento é somado ao reembolso (`migrations/0231_escrow_guard_and_fines.sql:145-156`).
- **Limitação:** o aditamento não é considerado no pedido de saque, que usa apenas `job_payments.provider_payout` (`migrations/0226_payout_accounts.sql:70`).

---

## 8. Cancelamentos e abandono

### 8.1 Cancelamento de pedido não pago

- O cliente pode atualizar diretamente o pedido para `cancelled` se estiver `open` ou `in_negotiation` (`apps/cliente/app/pedido/a-procurar.tsx:327-340`).
- Não há penalização do cliente.

### 8.2 Cancelamento de pedido pago pelo cliente

RPC `cancel_job_by_client_as` (`migrations/0231_escrow_guard_and_fines.sql:244-264`):

- só o próprio cliente;
- apenas jobs em `price_agreed`, `en_route` ou `arrived`;
- aplica **multa ao mestre** se o estado for `en_route` ou `arrived`;
- estorna o valor retido + aditamentos para **carteira** ou **PaySuite** (escolha do cliente).

Efeitos completos (`migrations/0231_escrow_guard_and_fines.sql:183-238`):

- job e pedido → `cancelled`;
- presença libertada;
- aditamentos estornados;
- se aplicável, multa de **150 MT** + registo de abandono;
- notificações a ambos.

O cliente **não pode** cancelar depois de `in_service`, `awaiting_confirmation` ou `disputed`; nesses casos só pode confirmar ou abrir disputa.

### 8.3 Mestre não arranca (no-show)

- Job pago (`held`) em `price_agreed`, `en_route` ou `arrived`, sem atualização há mais de **2 horas**:
  - cancelamento automático;
  - estorno ao cliente;
  - **multa de 150 MT** ao mestre;
  - registo de abandono.
- Referência: `migrations/0231_escrow_guard_and_fines.sql:287-298`.
- O relógio usa `greatest(jobs.updated_at, held_at)`; **não** é renovado pelos pings de localização, apesar do comentário da migration.

### 8.4 Serviço estagnado

- Job em `in_service`/`in_progress`, pago (`held`), sem atualização há mais de **6 horas**:
  - pagamento e aditamentos → `disputed`;
  - job → `disputed`;
  - abre ticket de disputa (prioridade `high`);
  - ambos são notificados.
- Referência: `migrations/0231_escrow_guard_and_fines.sql:300-338`.

### 8.5 Cancelamento pelo mestre

- Não existe RPC/fluxo explícito de cancelamento iniciado pelo mestre.
- O caminho implementado é **deixar o turno expirar**, o que conta como abandono (`migrations/0202_negotiation_lifecycle.sql:100-159`).
- Recusar uma oferta apenas grava `request_offers.status='declined'`; a UI avisa que “recusas reduzem a fiabilidade”, mas **não** há atualização de `reliability_stats` (`apps/pro/app/oferta/[offerId].tsx:37-60`).

### 8.6 Abandono de negociação

- Janela: **24 horas**;
- limiar: **3 abandonos**;
- cooldown: **30 minutos**.
- Configuração: `migrations/0204_anti_abuse_reliability.sql:11-16`.
- `register_abandon` reinicia a contagem fora da janela e ativa o cooldown quando atinge o limiar (`migrations/0204_anti_abuse_reliability.sql:34-70`).
- Efeitos: cliente em cooldown não abre pedidos `on_demand`; mestre em cooldown não aceita pedidos.

---

## 9. Disputas

### 9.1 Abertura

- Só o cliente abre disputa;
- motivo com **≥ 10 caracteres**;
- exige pagamento `held`.
- Referência: `apps/web/src/app/api/payments/dispute/route.ts:11-51`.

Efeitos:

- `job_payments` e `job_addenda` → `disputed`;
- job → `disputed`;
- ticket de categoria `disputa`, prioridade `high`, SLA de primeira resposta **480 min** e resolução **7200 min (5 dias)**;
- ambos notificados.
- Referência: `apps/web/src/app/api/payments/dispute/route.ts:42-90`; `migrations/0101_tickets_core.sql:266`.

### 9.2 Resolução pelo backoffice

Apenas `admin`, `superadmin`, `finance` ou `support` (`apps/web/src/app/(admin)/tickets/actions.ts:46-50`).

**Ação “libertar”:**
- repõe pagamento e aditamentos em `held`;
- chama `release_job_payment`;
- paga aditamentos;
- pedido → `completed`.
Referência: `apps/web/src/app/(admin)/tickets/actions.ts:83-144`.

**Ação “reembolsar”:**
- marca pagamento e aditamentos como `refunded`;
- job/pedido → `cancelled`;
- liberta presença;
- **não cria `job_refunds`, não credita a carteira e não chama o worker PaySuite**.
Referência: `apps/web/src/app/(admin)/tickets/actions.ts:145-181`.

> **Regra efetiva:** o reembolso decidido numa disputa não movimenta dinheiro. O cliente pode ficar sem valor creditado.

### 9.3 Reembolso parcial

- O estado `partially_refunded` existe no enum, mas não é usado. Não há reembolso parcial implementado.

---

## 10. Punições, multas e anti-abuso

### 10.1 Multa ao mestre

- Valor por omissão: **150 MT** (`migrations/0231_escrow_guard_and_fines.sql:19`).
- `charge_master_fine` (`migrations/0231_escrow_guard_and_fines.sql:92-120`):
  - debita `least(saldo, multa)`;
  - a carteira **nunca fica negativa**;
  - o valor não coberto **não é registado como dívida**;
  - registra transação `fine` e receita `platform_revenue(kind='fine')`.

**Quando é aplicada:**

| Situação | Multa |
|---|---|
| Cliente cancela após deslocação (`en_route`/`arrived`) | 150 MT |
| Job pago parado 2 h sem arrancar | 150 MT |
| Recusa de oferta | Não |
| Abandono de negociação | Não (apenas cooldown) |
| Identidade divergente (“mestre diferente”) | Não (apenas registo) |
| Cancelamento explícito do mestre | Não existe fluxo |

### 10.2 Saldo mínimo para operar

- Mínimo: **200 MT** (`migrations/0231_escrow_guard_and_fines.sql:17`).
- `master_can_operate` exige saldo ≥ mínimo, salvo:
  - exigência desligada em `app_settings`;
  - sandbox ativo (mínimo 0);
  - mestre de teste isento.
- Referências: `migrations/0231_escrow_guard_and_fines.sql:51-56`; `migrations/0235_sandbox_min_balance_zero.sql:10-30`.
- **Limitação:** a verificação só é usada no aceite móvel. `accept_offer` não a usa, nem há verificação na inserção/atualização de jobs.

### 10.3 Cooldown

- 3 abandonos em 24 h → **30 minutos** de bloqueio.
- Cliente em cooldown: não abre pedidos `on_demand`.
- Mestre em cooldown: não aceita pedidos.
- Referências: `migrations/0204_anti_abuse_reliability.sql:13-15,72-100`; `migrations/0231_escrow_guard_and_fines.sql:59-63`.

### 10.4 Limites anti-abuso

| Regra | Valor |
|---|---|
| Pedidos ativos `on_demand` por cliente | 2 |
| Abandonos para cooldown | 3 em 24 h |
| Duração do cooldown | 30 min |
| Tickets abertos por utilizador | 5 (`migrations/0101_tickets_core.sql:105-108`) |
| Aprovações financeiras | expiram em 48 h; ninguém aprova o próprio pedido (`migrations/0100_staff_tickets.sql:88-101`) |
| Preços sandbox | 1 a 10 MT |
| Tentativas de KYC | campo `attempts` existe, sem limite aplicado |

### 10.5 Identidade divergente

- Denúncia de “mestre diferente do atribuído” cria `provider_penalties(kind='identity_mismatch')` e ticket urgente de disputa (`apps/web/src/app/api/reports/provider/route.ts:31-62`).
- Não há multa, suspensão automática, decisão ou UI de penalizações. A tabela tem apenas leitura pelo próprio.

### 10.6 Suspensão e bloqueio

- Suspensão de conta: `profiles.is_active=false`, verificada **apenas** no login web.
- `companies.status='suspended'` existe, mas `company_can_accept` não verifica o estado da empresa.
- Não há bloqueio global de utilizadores nas apps móveis.

### 10.7 Outras consequências

- Créditos consumidos **não são devolvidos** se o job for cancelado ou abandonado.
- Escrow pode ser retido em `disputed` até decisão.
- Perda de fiabilidade: apenas o cooldown tem efeito operacional; não existe pontuação numérica.

---

## 11. Reputação e avaliações

### 11.1 Fiabilidade

- `reliability_stats` guarda apenas `abandon_count`, `last_abandon_at`, `cooldown_until` e `role` (`migrations/0204_anti_abuse_reliability.sql:24-31`).
- Não existe score de fiabilidade nem histórico de eventos.
- O mestre vê o seu contador/cooldown (`apps/pro/app/trabalhos.tsx:42,72-77,123-130`); o cliente não vê a sua reputação.

### 11.2 Avaliações

- Só o cliente avalia, apenas job `completed`, 1 por job, nota **1 a 5** (`migrations/0003_requests_jobs_chat.sql:82-92`; `migrations/0005_functions_triggers.sql:58-67`).
- `refresh_rating` recalcula `rating_avg` (2 casas) e `rating_count`, excluindo avaliações ocultas (`migrations/0005_functions_triggers.sql:44-55`).
- O mestre pode responder uma vez (`apps/web/src/app/actions/reviews.ts:53-66`).
- `jobs_completed` é incrementado quando o job passa a `completed` (`migrations/0005_functions_triggers.sql:70-79`).
- A pesquisa ordena por destaque, prioridade, relevância, rating e jobs concluídos (`migrations/0005_functions_triggers.sql:176`).
- `plans.rating_boost` existe, mas **não é aplicado** na pesquisa.
- Não há avaliação do cliente pelo mestre nem moderação de avaliações na UI.

---

## 12. Pagamentos e escrow

### 12.1 Métodos de pagamento

Métodos no código:

- **M-Pesa** (`mpesa`);
- **e-Mola** (`emola`);
- **Cartão** (`credit_card` na PaySuite, gravado como `manual` na BD).
- Referências: `apps/web/src/lib/paysuite.ts:11`; `apps/web/src/app/api/payments/charge/route.ts:9-21`.

Métodos no enum mas sem fluxo:

- `bank_transfer` — usado apenas em payouts;
- `manual` — carregamentos manuais/simulados e cartão;
- `cash` — sem fluxo;
- Multicaixa — **não implementado**.

### 12.2 Entrada em escrow

1. Cliente chama `/api/payments/charge` com `jobId`/`requestId`, `amount` e método.
2. O sistema calcula comissão/payout, cria cobrança PaySuite e grava `job_payments` em `pending_payment` (`apps/web/src/app/api/payments/charge/route.ts:49-150`).
3. Quando a PaySuite confirma:
   - `job_payments.status='held'`, `held_at` preenchido;
   - job → `price_agreed`, `agreed_amount`;
   - pedido → `accepted`, `budget_max = amount`;
   - ambos notificados.
   Referência: `apps/web/src/lib/job-payment.ts:110-149`.

**Regra crítica:** o valor cobrado vem de `body.amount`; **não é validado contra a proposta aceite nem contra `agreed_amount`**. Só o intervalo de sandbox é verificado (`apps/web/src/app/api/payments/charge/route.ts:27-58`).

### 12.3 Libertação do escrow

`/api/payments/release` exige cumulativamente (`apps/web/src/app/api/payments/release/route.ts:42-50`):

- job em `awaiting_confirmation`;
- pagamento em `held`.

Depois (`migrations/0200_on_demand.sql:251-266`; `apps/web/src/app/api/payments/release/route.ts:52-101`):

- credita `provider_payout` na carteira do mestre (`job_payout`);
- regista `platform_revenue(kind='commission')`;
- pagamento → `released`;
- job e pedido → `completed`;
- aditamentos `held` são pagos e a comissão registada;
- presença do mestre é libertada.

### 12.4 Retenção

- O dinheiro do cliente **não entra na carteira da plataforma**; fica no provider de pagamento até libertação/estorno.
- O mestre não pode forçar a libertação: só o cliente confirma.
- A UI promete libertação automática após 24 h, mas **não existe cron/função que a implemente** (`apps/cliente/app/pedido/confirmar.tsx:133`; `confirm_deadline`/`release_after` são apenas colunas).

### 12.5 Falhas

- Só é possível marcar falha a partir de `pending_payment` (`apps/web/src/lib/job-payment-state.ts:10-16`).
- Um pagamento `failed` pode ser confirmado se a PaySuite o confirmar, passando a `held` (`apps/web/src/lib/job-payment.ts:102-115`).
- `/api/payments/cancel` verifica primeiro a PaySuite; se já estiver pago, promove a `held` em vez de falhar (`apps/web/src/app/api/payments/cancel/route.ts:16-35`).
- Não há retry automático de pagamento falhado; o cliente inicia nova cobrança.

### 12.6 Webhooks PaySuite

- Assinatura HMAC SHA-256, aceitando hex/base64 e formatos `t=...v1=...`, `v1=`, `sha256=`, `hmac sha256=` (`apps/web/src/lib/paysuite.ts:298-327`).
- Prefixos: `BMJOB` (serviço), `BMTOP` (carregamento), `BMPAY` (payout), `BMPRT` (payout de sócio), `RF` (reembolso).
- Estados considerados pagos: `paid`, `pago`, `succeeded`, `success`, `completed`, `confirmed`.
- Estados considerados falhados: `failed`, `falhou`, `cancelled`, `canceled`, `expired`, `declined`, `rejected`.
- Referência: `apps/web/src/lib/paysuite.ts:31-32`; `apps/web/src/app/api/webhooks/paysuite/route.ts:12-133`.

---

## 13. Taxas, comissões e fidelidade

### 13.1 Comissão normal

- **20%** do valor do contrato.
- Configuração: `app_settings.commission_rate = 0.20` (`migrations/0213_plans_credits_companies_qr_terms.sql:4-5`).
- Fallback no código: 20% (`apps/web/src/lib/rates.ts:13-21`).

### 13.2 Trial

- **10%** de comissão durante o trial.
- Trial: **15 dias** e **5 serviços**.
- Referências: `migrations/0213_plans_credits_companies_qr_terms.sql:6-8`; `apps/web/src/app/api/payments/charge/route.ts:75-84`.
- **Regra efetiva do charge:** o desconto de trial depende apenas de `trial_ends_at > now()`, não do número de serviços. Ou seja, dentro dos 15 dias todos os serviços podem pagar 10%, mesmo após 5 serviços.

### 13.3 Fidelidade do mestre

- No **10.º, 20.º, 30.º…** serviço concluído do mestre, a comissão desce para **10%** (`(providerCount + 1) % 10 === 0`).
- Referência: `apps/web/src/app/api/payments/charge/route.ts:81-84`.

### 13.4 Fidelidade do cliente

- Desconto de **10%** no **11.º, 21.º, 31.º…** serviço concluído do cliente.
- Fórmula: `nextClientService === 11` ou `(nextClientService - 11) % 10 === 0`.
- Referência: `apps/web/src/app/api/payments/charge/route.ts:86-95`.

### 13.5 Quem paga a comissão

- A comissão é suportada pelo **mestre**: o payout é `valor do contrato × (1 − taxa)`.
- Quando há desconto de fidelidade do cliente, o cliente paga menos, mas o payout do mestre continua calculado sobre o valor cheio. A diferença é absorvida pela plataforma (a comissão registada diminui).
- Se a diferença tornar a comissão negativa, a comissão fica **0** e o payout passa a ser o valor cobrado (`apps/web/src/app/api/payments/charge/route.ts:99-102`).

### 13.6 Fórmulas implementadas

```
chargedAmount = contractAmount × (1 − descontoCliente)
masterPayout  = contractAmount × (1 − taxaComissao)
commission    = chargedAmount − masterPayout
se commission < 0: commission = 0; payout = chargedAmount
taxaGravada   = commission / chargedAmount
```

- Arredondamento a 2 casas em todos os passos.
- A BD garante `commission_amount + provider_payout = amount` (`migrations/0200_on_demand.sql:98`).

### 13.7 Comissão de aditamentos

- Usa a taxa já gravada no pagamento principal ou **20%** por omissão (`apps/web/src/app/api/payments/addendum/route.ts:40-60`).
- O default da coluna em `job_addenda` é 0,12, mas o endpoint usa 0,20 quando não encontra o principal.

### 13.8 Taxas de processamento

- Não existe taxa de processamento PaySuite, IVA ou custo de operador modelado.
- O sistema só registra comissão, multa, planos/créditos e receita de payouts pelo valor nominal.

### 13.9 Divergência documental

Os documentos comerciais referem comissões de **12% / 8% / 5%** e planos antigos de 500/1500 MT. **O código aplica 20% / 10%** e planos de 1000/2500/5000 MT. Ver secção 25.

---

## 14. Reembolsos

### 14.1 Para carteira

- `refund_held_job_payment` credita imediatamente a carteira e marca `job_refunds.status='completed'`.
- Inclui pagamento principal + aditamentos `held`/`disputed`.
- Referência: `migrations/0231_escrow_guard_and_fines.sql:125-173`.

### 14.2 Via PaySuite

- Cria `job_refunds` com `destination='paysuite'`, estado `pending`, `payment_id` do pagamento original, método e msisdn (`migrations/0232_paysuite_refunds.sql:94-103`).
- Um trigger dispara o worker; cron a cada **1 minuto** (`migrations/0232_paysuite_refunds.sql:296-308`).
- Worker `/api/refunds/dispatch-pending`:
  - exige `x-push-secret`;
  - processa até 20 estornos pendentes/em processamento;
  - faz claim `pending → processing`;
  - chama a PaySuite;
  - em erro não-5xx, falha e devolve o valor à carteira;
  - em erro 5xx, deixa em `processing` para reconciliação.
  Referência: `apps/web/src/app/api/refunds/dispatch-pending/route.ts:37-124`.
- Se o estorno falhar, o valor é devolvido à **carteira** do cliente (`migrations/0232_paysuite_refunds.sql:164-191`).

### 14.3 Regras de reembolso

- Só pagamentos em `held`/`disputed` podem ser estornados.
- Cancelamento pelo cliente permite escolher carteira ou PaySuite.
- Expiração/no-show estorna automaticamente para o destino configurado (por omissão `wallet`).
- Reembolso decidido em disputa **não movimenta dinheiro** (ver 9.2).
- Não há reembolso parcial.

---

## 15. Saques e payouts

### 15.1 Conta de recebimento

- `provider_payout_accounts`: método (default `emola`), titular, msisdn, banco, conta (`migrations/0226_payout_accounts.sql:5-13`).
- A UI aceita e-Mola, M-Pesa e transferência bancária (`apps/pro/app/dados-pagamento.tsx:104-119`).
- Validação da UI: nome ≥ 3 caracteres, telefone ≥ 9 dígitos, banco ≥ 2, conta ≥ 5 (`apps/pro/app/dados-pagamento.tsx:47-59`).
- O dispatch exige:
  - telefone local com **9 dígitos** (remove `258`);
  - NIB com **exatamente 21 dígitos**.
  Referência: `apps/web/src/lib/payouts.ts:17-72`.

### 15.2 Pedido de saque

`request_job_payout` (`migrations/0226_payout_accounts.sql:43-81`; `migrations/0227_payout_dispatch.sql:72-116`):

- só o próprio mestre;
- job `completed`;
- pagamento `released`;
- um payout por job (se anterior falhou, pode repetir);
- exige conta de recebimento;
- valor = `job_payments.provider_payout`;
- debita imediatamente a carteira (`withdrawal`);
- cria payout `pending`.

**Regras efetivas:**
- aditamentos **não** entram no valor do saque;
- não há mínimo nem máximo;
- não há SLA nem expiração.

### 15.3 Aprovação

- `payout_require_approval = true` por omissão (`migrations/0228_payout_approval.sql:6-8`).
- Com aprovação ativa, o worker não envia payouts `pending`.
- O superadmin pode:
  - ligar/desligar a exigência;
  - aprovar e enviar;
  - rejeitar e devolver o valor à carteira.
- Referência: `apps/web/src/app/(superadmin)/superadmin/pagamentos-aprovacao/actions.ts:14-42`.

### 15.4 Envio

- Métodos suportados: `mpesa`, `emola`, `bank_transfer`.
- Referência `BMPAY`.
- Claim atómico `pending → processing`, grava `provider_ref`, chama a PaySuite.
- Em erro, marca `failed` e devolve o valor à carteira.
- Webhook confirma `completed`; rejeição marca `failed` e devolve à carteira.
- Referência: `apps/web/src/lib/payouts.ts:40-246`.

---

## 16. Receita da plataforma e sócios

### 16.1 O que entra em `platform_revenue`

Apenas:

- **comissão** de serviços (`kind='commission'`) — no release (`migrations/0200_on_demand.sql:260-261`);
- **multas** (`kind='fine'`) (`migrations/0231_escrow_guard_and_fines.sql:116-117`).

**Não entram** em `platform_revenue`: planos, créditos, boosts e publicidade. Os planos são contabilizados à parte em `wallet_transactions.type='plan_purchase'`.

### 16.2 Sócios

- Sócios fixos: **Afonso 40%**, **RFL 60%** (`migrations/0229_partners_platform_withdrawals.sql:20-23`).
- O `share_pct` está bloqueado por trigger (`:25-37`).
- Configuração: **50%** disponível para saque e **50%** retido (`:90-94`).
- `withdrawPct + retainPct` têm de somar 1 (`apps/web/src/lib/platform-withdrawals.ts:68-77`).
- Receita disponível = total de `platform_revenue` − saques em `pending_approval`, `processing` e `completed` (`apps/web/src/lib/platform-withdrawals.ts:97-109`).
- A aprovação exige aprovação de todos os sócios ativos (`:152-164`).
- A distribuição usa `share_pct`; o último sócio recebe o remanescente para corrigir arredondamentos (`:190-202`).
- Falha de qualquer payout de sócio marca o saque como `failed` (`:342-367`).
- O saque usa referência `BMPRT`; métodos M-Pesa, e-Mola e banco (NIB 21).

**Limitação:** como a distribuição só considera `platform_revenue`, a receita de planos/créditos/boosts não é distribuída aos sócios.

---

## 17. Todas as formas de entrada de dinheiro

### 17.1 Resumo

| # | Fonte | Como entra | Valores |
|---|---|---|---|
| 1 | Pagamento de serviço | Cliente paga para escrow via PaySuite | Valor negociado; sandbox 1–10 MT |
| 2 | Comissão de serviço | Retida do payout do mestre | 20% (10% trial / 10% no 10.º serviço) |
| 3 | Aditamentos | Cliente paga trabalho extra | Valor extra + comissão 20% (ou taxa do principal) |
| 4 | Multas | Débito na carteira do mestre | 150 MT |
| 5 | Carregamentos (topups) | Cliente/mestre carrega carteira | Mínimo 50 MT |
| 6 | Planos | Compra via saldo da carteira | 1000 / 2500 / 5000 MT e empresa 2200 / 5200 / 10200 MT |
| 7 | Créditos de serviço | Compra via saldo da carteira | 200–350 MT por crédito |
| 8 | Destaques (boosts) | Compra via saldo (função existe, sem UI) | 150–1000 MT |
| 9 | Publicidade/banners | Sem cobrança implementada | — |
| 10 | Referidos | Gera comissão de 10% para o referrer | 10% dos topups por 90 dias |
| 11 | Payout de mestres | Saída, não entrada | Valor do payout |
| 12 | Saques de sócios | Saída da receita da plataforma | 50% da receita disponível |

### 17.2 Dinheiro que efetivamente é receita da plataforma

- comissão de serviços;
- multas;
- planos;
- créditos;
- boosts (se comprados);
- (publicidade não monetizada no código).

### 17.3 Dinheiro que é passagem

- valor do serviço retido em escrow → payout do mestre;
- topups → saldo do utilizador;
- payouts → conta do mestre;
- reembolsos → cliente.

### 17.4 Nota sobre topups manuais

- O fluxo web `createTopUpPayment` cria pagamento `manual` e chama **imediatamente** `complete_payment`, creditando saldo sem confirmação externa (`apps/web/src/app/actions/wallet.ts:13-31`).
- A UI avisa que é modo de simulação, mas o código está ativo. Em produção, isto permite criar saldo sem pagamento real.

---

## 18. Planos, créditos e subscrições

### 18.1 Planos individuais

| Plano | Preço | Duração | Serviços/mês | Fotos | Categorias | Orçamentos/mês | Destaque incluído | Crédito unitário | Rating boost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Básico (`basic`) | 1000 MT | 30 dias | 5 | 3 | 1 | 5 | 0 | 300 MT | 0 |
| Standard (`standard`) | 2500 MT | 30 dias | 15 | 15 | 3 | 30 | 0 | 250 MT | 0,20 |
| Premium (`premium`) | 5000 MT | 30 dias | 40 | 40 | 5 | ilimitados | 3 dias featured | 200 MT | 0,50 |

Fonte: `migrations/0213_plans_credits_companies_qr_terms.sql:23-42`; `migrations/0006_seeds.sql:188-191`.

### 18.2 Planos empresa

| Plano | Preço | Serviços/mês | Fotos | Categorias | Orçamentos/mês | Máx. mestres | Crédito unitário | Rating boost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Básico Empresa | 2200 MT | 10 | 10 | 3 | 30 | 5 | 350 MT | 0,10 |
| Standard Empresa | 5200 MT | 30 | 30 | 5 | 60 | 15 | 300 MT | 0,30 |
| Premium Empresa | 10200 MT | 80 | 80 | 10 | ilimitados | 40 | 250 MT | 0,50 |

Fonte: `migrations/0213_plans_credits_companies_qr_terms.sql:44-54`.

### 18.3 O que é realmente aplicado

Aplicado:

- `max_services` mensal, por plano individual (`apps/pro/app/index.tsx:383-402`);
- `max_services` do plano do **owner** para a quota da empresa (`migrations/0219_company_quota.sql:18-32`);
- crédito consumido no aceite;
- trial de 15 dias / 5 serviços;
- desconto de referidos.

Não aplicado (existe na tabela/UI, mas não é verificado):

- `monthly_quotes`;
- `max_photos`;
- `max_categories`;
- `can_quote_unlimited`;
- `max_masters`;
- `weekend_priority`;
- `priority_hours`;
- `recurring_visibility`;
- `rating_boost`;
- `company_license_extra` (200 MT, definido mas não usado).

### 18.4 Compra, renovação e upgrade

- `purchase_plan` (`migrations/0212_security_hardening.sql:2-31`):
  - exige `p_provider = auth.uid()` quando há sessão;
  - aplica desconto de referidos;
  - debita a carteira;
  - cancela a subscrição ativa anterior;
  - cria nova subscrição com `ends_at = now() + duration_days`.
- **Sem pro-rata:** qualquer compra cobra o preço completo e cancela o plano anterior.
- `auto_renew` existe e é `false` por omissão, mas **não há renovação automática**.
- Não há cron que marque subscrições como `expired`.
- A app Pro considera o plano ativo apenas por `status='active'`, **sem verificar `ends_at`** (`apps/pro/app/index.tsx:384-390`). Logo, um plano pode continuar ativo após a validade.
- Não há cancelamento explícito de subscrição pelo utilizador.
- `purchase_plan` não valida a audiência (individual vs empresa); a filtragem é só na UI. Via RPC é possível comprar o plano da outra audiência.

### 18.5 Créditos

- Tabelas: `service_credits(balance >= 0)` e `credit_transactions` (`kind`: `purchase`, `consume`, `refund`, `bonus`) (`migrations/0213_plans_credits_companies_qr_terms.sql:73-88`).
- Compra (`purchase_credits`):
  - exige `p_credits > 0`;
  - preço do plano ativo;
  - sem plano ativo → preço do plano `basic` (300 MT);
  - fallback final 300 MT;
  - debita carteira e soma créditos.
  Referência: `migrations/0213_plans_credits_companies_qr_terms.sql:90-122`.
- Consumo: 1 crédito por aceite (`migrations/0213_plans_credits_companies_qr_terms.sql:124-139`).
- **Não expiram.**
- `refund` e `bonus` existem no enum, mas não há função que os use.
- Não há bónus de créditos.

### 18.6 Trial — condições efetivas

- Novo mestre na app Pro recebe `trial_started_at` e `trial_ends_at` de 15 dias (`apps/pro/lib/useAuthStore.ts:43-52`).
- A app Pro permite aceitar enquanto tiver menos de 5 serviços desde o início do trial (`apps/pro/app/index.tsx:362-381`).
- O charge aplica 10% apenas com base em `trial_ends_at`.
- **Novos mestres registados pelo site** não recebem datas de trial (`apps/web/src/app/actions/auth.ts:275-281`).

---

## 19. Carteira e carregamentos

### 19.1 Carteira

- `wallets.balance >= 0` (`migrations/0002_base_tables.sql:47-51`).
- Criada automaticamente para todos os perfis (`migrations/0206_wallet_autocreate.sql:4-21`).
- `wallet_apply` é a única porta de alteração:
  - bloqueia a linha;
  - rejeita saldo negativo;
  - registra `wallet_transactions`.
  Referência: `migrations/0005_functions_triggers.sql:82-95`.

### 19.2 Carregamentos

- Mínimo: **50 MT** (`migrations/0004_wallet_plans_boosts.sql:7`; `apps/web/src/app/api/payments/topup/route.ts:33-36`).
- Métodos: M-Pesa, e-Mola; cartão é gravado como `manual`.
- Cria `payments` `pending` e cobrança PaySuite.
- Confirmação credita exatamente o valor; **sem bónus de carregamento**.
- Presets web: 100, 500, 1500, 5000 MT.
- Não há máximo de carregamento nem de saldo.

### 19.3 Tipos de transação

Base: `topup`, `plan_purchase`, `boost_purchase`, `bonus`, `commission_payout`, `refund`, `adjustment` (`migrations/0001_extensions_enums.sql:15`).

Acrescentados: `job_payout`, `job_commission`, `withdrawal`, `verification_fee` (`migrations/0199_enums.sql:18-21`) e `fine` (`migrations/0231_escrow_guard_and_fines.sql:13`).

Sem uso efetivo: `bonus`, `verification_fee`, `job_commission`.

### 19.4 Saldo mínimo e multas

- Mestre precisa de **200 MT** para operar (0 em sandbox).
- Multa de 150 MT debita no máximo o saldo; nunca fica negativo.
- Não há dívida registada.
- Ver secção 10.

---

## 20. Referidos e afiliados

### 20.1 Comissão sobre carregamentos

- Cada referido é único (`referred_id UNIQUE`).
- Auto-referral proibido (`referrer_id <> referred_id`).
- `commission_until = now() + 90 dias`.
- Ao completar um topup, o referrer ganha **10% do valor** (`round(amount * 0.10, 2)`).
- Fica em `affiliate_commissions` com estado `pending`.
- **Nunca é marcado como `paid` nem creditado**; não há worker de pagamento.
- Referências: `migrations/0004_wallet_plans_boosts.sql:81-99`; `migrations/0005_functions_triggers.sql:107-114`.

### 20.2 Desconto em planos

- 10 referidos com role `provider` → **20% de desconto** em todos os planos.
- Contagem por `profiles.role='provider'`.
- Aplicado em `purchase_plan` enquanto o limiar estiver atingido.
- Não se aplica a créditos nem a boosts.
- Referências: `migrations/0211_sandbox_plans_referrals.sql:43-59`; `migrations/0212_security_hardening.sql:7,17-20`.

### 20.3 Anti-abuso

Existe apenas:

- unicidade do referido;
- proibição de auto-referral;
- validação do código no registo.

Não existe:

- limite de referidos;
- verificação de atividade/pagamento do referido;
- deteção de fraude;
- cap de comissão;
- janela para o desconto de 20%.

Nota: o registo web cria o perfil como `client`, pelo que referidos criados por essa via não contam para o desconto de 20% até mudarem de role.

---

## 21. Destaques e publicidade

### 21.1 Preços de destaques

| Tipo | Duração | Preço |
|---|---:|---:|
| `featured` | 3 dias | 150 MT |
| `featured` | 7 dias | 300 MT |
| `featured` | 30 dias | 1000 MT |
| `priority_search` | 7 dias | 200 MT |
| `priority_search` | 30 dias | 600 MT |

Fonte: `migrations/0006_seeds.sql:194-199`.

- `purchase_boost` procura o preço exato, debita a carteira e cria o boost (`migrations/0005_functions_triggers.sql:136-146`).
- **Não existe UI nem rota de compra de boosts.**
- `purchase_boost` não valida `auth.uid()` e não foi revogada.
- Na pesquisa: `is_featured` e `is_priority` ordenam antes de rating (`migrations/0005_functions_triggers.sql:159-176`).
- `featured` pode ser global (`category_id` nulo) ou por categoria.

### 21.2 Destaques incluídos

- Apenas o plano **Premium** individual inclui **3 dias de featured**; a compra cria um boost com `price_paid=0`.
- Planos empresa não incluem destaque.

### 21.3 Publicidade

- `banners` existe (`title`, `image`, `link`, `placement`, datas, ativo), mas **sem preço, compra ou faturação** (`migrations/0004_wallet_plans_boosts.sql:101-110`).
- A publicidade exibida é estática em `/ads/` (`apps/web/src/lib/ads.ts:24-89`).
- Não há receita de publicidade registada.

---

## 22. Sandbox e mestres de teste

### 22.1 Sandbox

- `sandbox_mode` está **ativo por omissão** (`migrations/0211_sandbox_plans_referrals.sql:2-8`).
- Intervalo de preços: **1 a 10 MT** (`migrations/0214_sandbox_max_10.sql:2-8`).
- A app impõe um máximo absoluto de **10 MT**, mesmo que a BD tenha valor superior (`apps/web/src/lib/sandbox.ts:9-10,20-26`).
- Em sandbox:
  - o charge rejeita valores fora do intervalo;
  - o aditamento também;
  - propostas de preço têm trigger de proteção;
  - o saldo mínimo do mestre é **0**.
- Referências: `apps/web/src/app/api/payments/charge/route.ts:49-57`; `apps/web/src/app/api/payments/addendum/route.ts:41-47`; `migrations/0223_sandbox_price_limit.sql:29-32`; `migrations/0235_sandbox_min_balance_zero.sql:10-30`.
- **Limitação:** o sandbox não isola a PaySuite. Não há chave/URL de teste; se o token for de produção, os pagamentos podem ser reais.

### 22.2 Mestres de teste

- Isenção de saldo mínimo apenas para emails explícitos, com match exato e perfil de mestre (`migrations/0234_test_master_explicit.sql:11-42`).
- Email por omissão: `mestre@teste.com`.
- Recarga automática até **1000 MT** a cada **10 minutos**, via `wallet_apply` tipo `refund` (`migrations/0233_test_master_balance.sql:54-99`; `migrations/0234_test_master_explicit.sql:47-78`).
- A 0234 reverte créditos automáticos indevidos a contas que deixaram de ser isentas.

---

## 23. KYC, empresas e termos

### 23.1 KYC do mestre

- `verification_status`: `none`, `pending`, `approved`, `rejected` (`migrations/0001_extensions_enums.sql:9`).
- Documentos: tipo, número, frente/verso, selfie, validade, status, revisor (`migrations/0002_base_tables.sql:115-130`).
- A 0200 acrescenta `stage`, `ocr_data`, `ocr_confidence`, `face_match_score`, `liveness_passed`, `doc_number_hash`, `face_hash`, `attempts` (`migrations/0200_on_demand.sql:124-134`).
- Fluxo móvel:
  - captura frente/verso e selfie;
  - exige número do documento;
  - validade opcional;
  - insere `status='pending'`, `stage='manual_review'`;
  - perfil do mestre → `verification='pending'`.
  Referência: `apps/pro/app/verificacao/confirmar-dados.tsx:37-81`.
- Não há OCR, liveness, face match nem verificação automática. O estado vai diretamente para revisão manual.
- O bucket `verification-documents` é privado; o utilizador só acede à sua pasta (`migrations/0236_kyc_storage_services.sql:4-56`).
- A fila admin mostra apenas `pending`, SLA declarado de **48 h**; a app diz **24 h úteis**. Não há cron de SLA.
- Apenas `admin` revê KYC.
- O mestre só fica online com `verification='approved'` (`apps/pro/app/index.tsx:45,113-121,533-543`).
- `nearby_providers` exige verificação aprovada; `search_providers` só filtra se `p_verified_only=true`.

### 23.2 Empresas

- `companies` tem `status` (`pending`, `approved`, `rejected`, `suspended`) e `verification` (`pending`, `approved`, `rejected`) (`migrations/0213_plans_credits_companies_qr_terms.sql:142-155`).
- Criação gratuita pelo owner; o owner entra automaticamente como `company_masters.role='owner'` (`apps/pro/app/empresa.tsx:87-115`).
- Documentos de empresa estão num bucket **público** (`migrations/0213_plans_credits_companies_qr_terms.sql:241-248`).
- Admin aprova/rejeita e, ao aprovar, marca **todos** os mestres da empresa como `verification='approved'` — sem validação individual (`apps/web/src/app/(admin)/empresas/actions.ts:7-46`).
- `company_can_accept` usa o plano do owner e conta jobs do mês de todos os mestres da empresa (`migrations/0219_company_quota.sql:2-33`).
- `companies.status='suspended'` não é verificado na aceitação.
- `max_masters` não é aplicado.
- A empresa não tem carteira própria: o plano é comprado com a carteira do owner.

### 23.3 Termos

- Versões por audiência `client`, `provider`, `company`, com `is_current` e unicidade `(audience, version)` (`migrations/0213_plans_credits_companies_qr_terms.sql:209-219`).
- `terms_acceptances` tem unicidade `(profile_id, terms_version_id)`, `email_opt_in`, `ip` e `user_agent` (`:221-230`).
- Termos atuais visíveis a autenticados e anónimos (`migrations/0218_terms_anon_policy.sql:2`).
- Conteúdo dos termos na BD menciona:
  - cliente: escrow, confirmação por QR, cancelamento, comissão de 20%;
  - mestre: identidade real, comparência, QR, prazos, plano/créditos, trial 15 dias/5 serviços, incumprimento com multa/suspensão/eliminação;
  - empresa: documentos verdadeiros, responsabilidade pelos mestres, substituição não autorizada punível.
  Referência: `migrations/0213_plans_credits_companies_qr_terms.sql:232-239`.
- As apps móveis exigem checkbox e registam o aceite; o **registo web não grava** `terms_acceptances`.
- `ip` e `user_agent` nunca são preenchidos no fluxo móvel.
- Não há reaceitação quando os termos mudam.

---

## 24. Prazos, timers e cron jobs

| Regra | Prazo/valor | Referência |
|---|---|---|
| Turno de negociação SOS/today | 10 min | `migrations/0202_negotiation_lifecycle.sql:16-19` |
| Turno de negociação agendado | 1440 min (24 h) | idem |
| Rondas máximas | 3 | idem |
| Expiração de negociações | cron a cada 1 min | `migrations/0202_negotiation_lifecycle.sql:173-181` |
| Job pago sem arrancar | 2 h | `migrations/0231_escrow_guard_and_fines.sql:20,287-298` |
| Serviço em curso estagnado | 6 h | `migrations/0231_escrow_guard_and_fines.sql:21,301-311` |
| Cron de escrow | a cada 15 min | `migrations/0231_escrow_guard_and_fines.sql:344-355` |
| Oferta on-demand | 60 s (UI) | `apps/pro/app/oferta/[offerId].tsx:7` |
| Pedido expira | 14 dias (sem cron) | `migrations/0003_requests_jobs_chat.sql:17` |
| QR | 10 min | `apps/web/src/app/api/jobs/qr/route.ts:37-43` |
| Tracking do mestre | 8 s / 10 m | `apps/pro/app/trabalho/a-caminho.tsx:149-155` |
| Presença online | válida 90 s; heartbeat 40 s | `migrations/0200_on_demand.sql:171`; `apps/pro/app/index.tsx:215-231` |
| Cooldown de abandono | 30 min | `migrations/0204_anti_abuse_reliability.sql:15` |
| Janela de abandono | 24 h | idem |
| Limiar de abandono | 3 | idem |
| Pedidos ativos `on_demand` | 2 | `migrations/0204_anti_abuse_reliability.sql:11-12` |
| SLA tickets — pagamento | 4 h / 48 h | `migrations/0101_tickets_core.sql:263-270` |
| SLA tickets — verificação | 24 h / 48 h | idem |
| SLA tickets — disputa | 8 h / 5 dias | idem |
| SLA tickets — denúncia | 8 h / 3 dias | idem |
| SLA tickets — conta | 8 h / 3 dias | idem |
| SLA tickets — técnico | 24 h / 7 dias | idem |
| SLA tickets — sugestão | 72 h / 14 dias | idem |
| Cron de SLA | a cada 5 min | `migrations/0102_cron_jobs.sql:5-12` |
| Auto-fecho de tickets resolvidos | 5 dias, diário às 02:00 | `migrations/0102_cron_jobs.sql:14-18` |
| Aprovações financeiras | expiram em 48 h; cron 30 min | `migrations/0100_staff_tickets.sql:88-101`; `migrations/0102_cron_jobs.sql:20-22` |
| Push | cron a cada 1 min | `migrations/0222_push_dispatch_cron.sql:31-34` |
| Estornos PaySuite | cron a cada 1 min | `migrations/0232_paysuite_refunds.sql:301-312` |
| Saques | cron a cada 1 min; aprovação ON | `migrations/0227_payout_dispatch.sql:66-69`; `migrations/0228_payout_approval.sql:6-8` |
| Recarga de mestre de teste | 10 min até 1000 MT | `migrations/0233_test_master_balance.sql:90-98` |
| Libertação automática após 24 h | **não implementada** | `apps/cliente/app/pedido/confirmar.tsx:133` |

---

## 25. Divergências e limitações conhecidas

Esta secção lista regras que **não estão totalmente implementadas** ou que divergem entre documentação e código. São relevantes para saber o que o sistema realmente garante.

### 25.1 Financeiro

1. **Comissão documentada ≠ comissão efetiva.** Documentos comerciais dizem 12%/8%/5%; o código aplica 20% (10% em trial e no 10.º serviço).
2. **Fidelidade duplicada.** `apps/web/src/lib/loyalty.ts` define 0% no 11.º serviço do mestre e desconto a partir do 10.º do cliente, mas **não é usado**. A regra efetiva é a do charge (10.º mestre a 10%; 11.º cliente a 10%).
3. **Plano não expira.** Não há cron de expiração e a app Pro ignora `ends_at`.
4. **Sem pro-rata em upgrades/downgrades.**
5. **`plans.commission_rate` é ignorado** no fluxo principal; usa-se `app_settings`.
6. **Receita de planos/créditos/boosts não entra na distribuição aos sócios.**
7. **Comissões de afiliados nunca são pagas** (ficam `pending`).
8. **Multa não coberta não gera dívida.**
9. **Aditamentos não entram no saque** e podem não ser reembolsáveis corretamente via PaySuite.
10. **Reembolso de disputa não movimenta dinheiro.**
11. **`partially_refunded` não é usado.**
12. **`payments.expired` nunca é escrito.**
13. **Topup manual web auto-confirma saldo.**
14. **NIB bancário:** a UI aceita conta com ≥ 5 dígitos, mas o dispatch exige 21. Além disso, `payouts.msisdn` é `NOT NULL`, mas a conta bancária grava `msisdn=null`, o que pode impedir o saque bancário.
15. **Sandbox não isola a PaySuite** — pode movimentar dinheiro real.

### 25.2 Pedidos e escrow

16. **A tabela de transições de jobs não é imposta pela BD.**
17. **O valor do charge é arbitrário** e não é validado contra a proposta aceite.
18. **A libertação automática após 24 h não existe.**
19. **O relógio de 2 h não é renovado pelos pings de localização.**
20. **Ofertas de 60 s não têm gerador servidor**; `accept_offer` está por ligar na UI.
21. **`active_job_id` não é marcado no aceite móvel**, permitindo ao mestre aceitar mais do que um job.
22. **“Apenas deslocação” de 250 MT** não cria pagamento nem payout.
23. **Rejeição do cliente pode não fechar o pedido** (`service_requests` fica por atualizar).
24. **Contraproposta aceite não fecha a proposta original.**
25. **Podem coexistir várias propostas `pending`** no mesmo job.

### 25.3 Punições e reputação

26. **Recusa de oferta não altera fiabilidade**, apesar do aviso na UI.
27. **`provider_penalties` é apenas registo** — não há multa/suspensão automática.
28. **Suspensão de conta só é verificada no login web.**
29. **Empresa suspensa não é bloqueada** em `company_can_accept`.
30. **Créditos consumidos não são devolvidos** em cancelamentos/abandono.
31. **Não há score de fiabilidade**, apenas contador de abandonos e cooldown.

### 25.4 KYC, termos e empresas

32. **KYC não faz OCR/liveness/face match**; vai direto para revisão manual.
33. **`doc_number_hash` não é preenchido**, pelo que o índice único de documento é ineficaz.
34. **SLA de KYC contraditório:** 24 h na app, 48 h no admin.
35. **Aprovar empresa aprova todos os mestres** sem validação individual.
36. **Documentos de empresa são públicos.**
37. **Registo web não grava aceite de termos.**
38. **Não há reaceitação de termos.**
39. **`max_masters` não é aplicado.**
40. **Registo web de mestre não cria trial.**

### 25.5 Segurança e integridade (impacto nas regras)

41. **APIs financeiras sem autenticação:** `/api/payments/charge`, `/release`, `/cancel`, `/dispute`, `/addendum` e `/api/jobs/qr` aceitam IDs do corpo e atuam diretamente na BD. Qualquer pessoa com um `jobId` pode, em princípio, libertar dinheiro.
42. **RLS permitem alterar estados e propostas alheias** (`jobs`, `job_price_proposals`).
43. **RPCs de negociação sem validação de ator:** `set_negotiation_turn`, `close_negotiation`, `register_abandon`, `expire_stale_negotiations`.
44. **Notificações spoofáveis:** insert em `notifications` com `with check (true)`.
45. **Tabelas financeiras sem RLS** em várias migrations (`payments`, `wallet_transactions`, `app_settings`, `platform_revenue`, `plans`, `subscriptions`, `boosts`, `affiliate_commissions`).
46. **`purchase_boost` sem validação de `auth.uid()`.**
47. **Webhook de refund pode não encontrar o estorno** se a PaySuite enviar apenas o ID do refund.
48. **Links PaySuite antigos continuam válidos** após nova cobrança, com risco de pagamento sem registo correspondente.
49. **Workers de payout/refund podem ter segredos desalinhados** (`app_settings.push_dispatch` vs `PUSH_DISPATCH_SECRET`).

---

## 26. Resumo rápido de valores

### Serviços e comissões

| Regra | Valor |
|---|---:|
| Comissão normal | 20% |
| Comissão durante trial | 10% |
| Trial | 15 dias / 5 serviços |
| Fidelidade mestre | 10% de comissão no 10.º, 20.º, 30.º… serviço |
| Fidelidade cliente | 10% de desconto no 11.º, 21.º, 31.º… serviço |
| Deslocação/diagnóstico sem acordo | 250 MT |

### Punições e limites

| Regra | Valor |
|---|---:|
| Multa por abandono/cancelamento após deslocação | 150 MT |
| Saldo mínimo do mestre | 200 MT (0 em sandbox) |
| Escrow sem arranque | 2 h |
| Serviço estagnado | 6 h |
| Abandonos para cooldown | 3 em 24 h |
| Cooldown | 30 min |
| Pedidos ativos on-demand | 2 |
| Tickets abertos | 5 |

### Planos

| Plano | Preço |
|---|---:|
| Básico | 1000 MT |
| Standard | 2500 MT |
| Premium | 5000 MT |
| Básico Empresa | 2200 MT |
| Standard Empresa | 5200 MT |
| Premium Empresa | 10200 MT |

### Créditos (preço unitário)

| Plano | Preço |
|---|---:|
| Básico | 300 MT |
| Standard | 250 MT |
| Premium | 200 MT |
| Básico Empresa | 350 MT |
| Standard Empresa | 300 MT |
| Premium Empresa | 250 MT |
| Fallback | 300 MT |

### Carteira e pagamentos

| Regra | Valor |
|---|---:|
| Topup mínimo | 50 MT |
| Sandbox | 1 a 10 MT |
| Piso de mestre de teste | 1000 MT / 10 min |
| Aprovação de payouts | ON por omissão |
| NIB | 21 dígitos |
| Telefone de payout | 9 dígitos locais |
| Referência fee de afiliado | 10% dos topups por 90 dias |
| Desconto por 10 referidos | 20% nos planos |

### Destaques

| Tipo | Duração | Preço |
|---|---:|---:|
| Featured | 3 dias | 150 MT |
| Featured | 7 dias | 300 MT |
| Featured | 30 dias | 1000 MT |
| Priority Search | 7 dias | 200 MT |
| Priority Search | 30 dias | 600 MT |

### Sócios e receita

| Regra | Valor |
|---|---:|
| Afonso | 40% |
| RFL | 60% |
| Saque da plataforma | 50% |
| Retenção | 50% |

### Prazos operacionais

| Regra | Valor |
|---|---:|
| Turno SOS/today | 10 min |
| Turno agendado | 24 h |
| Rondas de negociação | 3 |
| Oferta on-demand | 60 s |
| QR | 10 min |
| Tracking | 8 s / 10 m |
| Presença online | 90 s |
| Expiração de pedido | 14 dias (sem cron) |

---

## Nota final

Este documento reflete o estado do repositório na data indicada. As regras de negócio que dependem de `app_settings` (comissão, trial, fidelidade, saldo mínimo, multa, prazos de escrow, sandbox) são **configuráveis sem deploy**; os valores apresentados são os defaults implementados nas migrations.

As referências `ficheiro:linha` permitem confirmar cada regra no código. Para alterar qualquer comportamento, deve alterar-se primeiro a migration/função correspondente e só depois a UI, garantindo que a regra fica imposta na base de dados e não apenas no cliente.
