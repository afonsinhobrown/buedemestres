# Plano de Migração Incremental — Pagamentos, Preços e Fluxo Operacional

**Data:** 26 Nov 2026  
**Objectivo:** evoluir o sistema existente para suportar pagamento por pedido, escrow, split, catálogo fixo, orçamento variável, reclassificação e saques em lote — **sem criar uma plataforma paralela**.

## Estado da execução

- ✅ `0254_payment_split_foundation.sql` — aplicada.
- ✅ `0255_payout_batches.sql` — aplicada.
- ✅ `0256_catalog_and_symptoms.sql` — aplicada.
- ✅ `0257_payment_functions.sql` — aplicada.
- ✅ `0258_compatibility.sql` — aplicada.
- ✅ Teste transaccional de split, PIN, deslocação e aditamento — passou e foi revertido.
- ⏭ Próximo: adaptar APIs e apps v2 para usar os campos/funções novos.
- ⏭ Ainda não há dados de catálogo/sintomas; as tabelas estão vazias para configuração.

---

## 0. Princípio

Não substituir o que já funciona. A base actual é:

`service_requests` → `jobs` → `job_payments` / `job_addenda` → `wallets` / `wallet_transactions` → `payouts`

O que falta é acrescentado por `ALTER TABLE` ou por tabelas novas apenas para conceitos que ainda não existem. As apps v1 continuam a ler as tabelas antigas; as apps v2 usam os campos novos.

**Não vamos:**
- criar um segundo sistema de pagamento em paralelo;
- substituir `job_payments` por outro ledger;
- substituir `job_status` por outro enum;
- introduzir contabilidade de partidas dobradas agora;
- trocar o gateway PaySuite;
- obrigar o cliente a carregar saldo.

---

## 1. Inventário actual relevante

| Tabela | Estado actual | Limitação |
|---|---|---|
| `service_requests` | `mode`, `urgency`, `location`, `vehicle`, `status` | Não tem sintoma, catálogo, preço fixo ou taxa de deslocação |
| `jobs` | `status`, `agreed_amount`, GPS, negociação | Não separa mão de obra/peças/deslocação; não tem PIN nem fase detalhada |
| `job_payments` | **um pagamento por job**, com comissão e payout | Não permite deslocação, diferença de reclassificação ou pagamento separado |
| `job_addenda` | aditamentos com valor único, comissão e checkout | Não separa mão de obra/peças; não distingue tipo de encargo |
| `job_price_proposals` | valor único e descrição | Não tem breakdown nem faixa sugerida |
| `job_qr_tokens` | QR de `start`/`finish` | Não tem PIN de 4 dígitos |
| `payouts` | um payout por job | Multiplica transferências e taxas |
| `wallets` | operação + ganhos + dívida | Bom; manter |
| `wallet_transactions` | ledger simples | Bom para o piloto; manter |
| `platform_revenue` | receita por job | Falta referência ao encargo que gerou a receita |
| `provider_services` | preços do próprio prestador (`fixed/hourly/from/quote`) | Não é catálogo global da plataforma |
| `request_media` | apenas `url` | Não distingue foto/vídeo/áudio nem transcrição |
| `job_refunds` | reembolso por job | Falta indicar se é serviço, deslocação, reclassificação ou aditamento |

**Funções existentes:** `release_job_payment`, `release_job_addenda`, `request_job_payout`, `wallet_apply`, `wallet_apply_earnings`, `complete_payment`, `cancel_job_by_client`, `refund_held_job_payment`, `hold_job_payment`.

**Migrações registadas:** apenas 12 em `_migrations`, embora o schema tenha migrações até `0253`. Isto tem de ser corrigido antes de usar o runner antigo (ver §8).

---

## 2. Decisões de compatibilidade

1. **`job_payments` continua a ser o pagamento do serviço** — um por job. Não passa a ter várias linhas.
2. **`job_charges` é novo, mas só para encargos que não existem hoje:** taxa de deslocação e diferença de reclassificação. Não substitui `job_payments`.
3. **`job_addenda` continua a ser para trabalho adicional.** Recebe apenas `kind='extra'` e breakdown; não é usado para deslocação/reclassificação.
4. **`jobs.status` mantém-se.** É acrescentado `job_phase` para o fluxo novo; as apps v1 continuam a ler `status`.
5. **As apps v1 ignoram `job_charges`.** Continuam a ver o pagamento do serviço e os aditamentos como hoje.
6. **As apps v2 são as únicas que criam o fluxo novo** (deslocação, catálogo, PIN, reclassificação).
7. **`wallets` e `wallet_transactions` mantêm-se.** Não há ledger de partidas dobradas no piloto.
8. **PaySuite mantém-se.** O split é interno; o gateway cobra o total e a plataforma paga ao prestador.

---

## 3. Diff do schema

### 3.1 `jobs` — acrescentar

```sql
alter table jobs
  add column pricing_mode text,              -- fixed | diagnostic | quote
  add column catalog_id uuid,                -- FK para service_catalog
  add column travel_fee numeric,
  add column travel_distance_km numeric,
  add column travel_credit numeric default 0,
  add column labor_amount numeric,
  add column parts_amount numeric,
  add column job_phase text,                 -- requested, searching, arrived, diagnosing, quote_sent, ...
  add column completion_pin_hash text,       -- hash, nunca o PIN em texto
  add column pin_expires_at timestamptz,
  add column pin_attempts smallint default 0,
  add column quote_sent_at timestamptz,
  add column service_paid_at timestamptz,
  add column pricing_snapshot jsonb default '{}'::jsonb,
  add column settled_at timestamptz,
  add column provider_payout_final numeric;
```

- `status` não é alterado.
- Os valores antigos ficam `null`; as apps v1 ignoram-nos.
- `pricing_snapshot` guarda o cálculo no momento (distância, multiplicadores, regras).

### 3.2 `service_requests` — acrescentar

```sql
alter table service_requests
  add column pricing_mode text,              -- fixed | diagnostic | quote
  add column symptom_id uuid,                -- FK para symptoms
  add column triage_summary text,            -- resumo para o técnico
  add column safety_ack boolean default false;
```

- `mode` e `urgency` existentes são mantidos.

### 3.3 `job_payments` — acrescentar breakdown

```sql
alter table job_payments
  add column labor_amount numeric,
  add column parts_amount numeric,
  add column travel_credit numeric default 0,
  add column pricing_snapshot jsonb default '{}'::jsonb;
```

- **Não** remover `job_payments_job_id_key` (um serviço por job).
- Backfill:
  ```sql
  update job_payments
     set labor_amount = coalesce(labor_amount, amount),
         parts_amount = coalesce(parts_amount, 0);
  ```
- A comissão passa a ser calculada sobre `labor_amount`, não sobre o total.

### 3.4 `job_price_proposals` — acrescentar breakdown

```sql
alter table job_price_proposals
  add column labor_amount numeric,
  add column parts_amount numeric,
  add column catalog_id uuid,
  add column range_min numeric,
  add column range_max numeric,
  add column within_range boolean,
  add column travel_credit numeric default 0;
```

- `amount` continua a ser o total para compatibilidade.
- `labor_amount + parts_amount` deve bater certo com `amount`; validação na aplicação.
- Backfill: `labor_amount = amount`, `parts_amount = 0`.

### 3.5 `job_addenda` — acrescentar tipo e breakdown

```sql
alter table job_addenda
  add column kind text not null default 'extra',  -- extra | (futuro)
  add column labor_amount numeric,
  add column parts_amount numeric,
  add column evidence_url text,
  add column review_status text;
```

- O fluxo de aditamento existente continua igual.
- `kind='extra'` é o default; as apps v1 não precisam de mudar.
- A reclassificação **não** é um aditamento; vai para `job_charges`.

### 3.6 `job_charges` — nova tabela (só deslocação/reclassificação)

```sql
create table job_charges (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  kind text not null check (kind in ('travel','reclassification')),
  amount numeric not null check (amount > 0),
  labor_amount numeric,
  parts_amount numeric,
  commission_rate numeric,
  commission_amount numeric,
  provider_payout numeric,
  status escrow_status not null default 'pending_payment',
  method payment_method not null default 'manual',
  msisdn text,
  provider_ref text unique,
  provider_payment_id text,
  checkout_url text,
  original_amount numeric,
  new_total numeric,
  evidence_url text,
  review_status text,             -- none | required | approved | rejected
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  held_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz
);
```

- `travel`: `commission_rate=0`, `provider_payout=amount`.
- `reclassification`: `amount` = diferença a pagar; `original_amount` e `new_total` guardam o contexto; `labor_amount/parts_amount` são os valores finais.
- As apps v1 não conhecem esta tabela e não são afectadas.

### 3.7 `job_refunds` — identificar a origem

```sql
alter table job_refunds
  add column source text default 'service',  -- service | travel | reclassification | addendum
  add column source_id uuid;                 -- job_payment_id / job_charge_id / job_addenda_id
```

- Backfill: `source='service'`.
- O worker de reembolso passa a usar `source_id` para saber qual pagamento estornar.
- Nunca estornar a deslocação depois do check-in, excepto no-show.

### 3.8 `payouts` — lote diário

```sql
alter table payouts add column batch_id uuid;

create table payout_batches (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id),
  amount numeric not null check (amount > 0),
  method payment_method not null,
  status payout_status not null default 'pending',
  provider_ref text unique,
  failure_reason text,
  scheduled_for timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
```

- Mantêm-se os `payouts` por job para rastreabilidade.
- O gateway recebe **uma transferência por lote**, não uma por job.
- `payouts.batch_id` liga os itens ao lote.

### 3.9 `platform_revenue` — referência ao encargo

```sql
alter table platform_revenue
  add column job_charge_id uuid,
  add column job_addenda_id uuid;
```

- `job_id` continua.
- A comissão de um serviço fica ligada ao `job_payment`/`job_charge` que a gerou.

### 3.10 `request_media` — foto/vídeo/áudio

```sql
alter table request_media
  add column kind text default 'photo',      -- photo | video | audio
  add column duration_s smallint,
  add column transcript text,
  add column metadata jsonb default '{}'::jsonb;
```

- `url` continua.
- O áudio de 15 s e o vídeo curto passam a ter tipo e duração.
- O técnico vê os anexos antes de aceitar.

### 3.11 Novas tabelas de produto

Estas não substituem nada; são funcionalidades que ainda não existem.

```sql
create table service_catalog (
  id uuid primary key default gen_random_uuid(),
  category_id integer not null references categories(id),
  slug text not null unique,
  name text not null,
  description text,
  pricing_mode text not null check (pricing_mode in ('fixed','quote','hybrid')),
  fixed_labor_amount numeric,
  min_labor numeric,
  max_labor numeric,
  duration_min smallint,
  parts_included boolean not null default false,
  variants jsonb default '[]'::jsonb,
  active boolean not null default true,
  sort_order smallint default 0,
  created_at timestamptz not null default now()
);

create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null,                -- global | category | district | catalog
  category_id integer references categories(id),
  district_id integer references districts(id),
  catalog_id uuid references service_catalog(id),
  kind text not null,                 -- travel | night | weekend | urgency | hourly_rate
  base_fee numeric,
  per_km numeric,
  included_km numeric,
  min_fee numeric,
  max_fee numeric,
  multiplier numeric default 1,
  priority smallint default 0,
  active boolean not null default true,
  effective_from timestamptz default now(),
  effective_to timestamptz
);

create table symptoms (
  id uuid primary key default gen_random_uuid(),
  category_id integer not null references categories(id),
  slug text not null unique,
  label text not null,
  icon text,
  pricing_mode text not null check (pricing_mode in ('fixed','diagnostic')),
  catalog_id uuid references service_catalog(id),
  diagnostic_catalog_id uuid references service_catalog(id),
  urgency urgency_level default 'today',
  safety_level text default 'normal', -- normal | urgent | emergency
  safety_message text,
  follow_up_schema jsonb default '[]'::jsonb,
  sort_order smallint default 0,
  active boolean not null default true
);

create table price_benchmarks (
  id uuid primary key default gen_random_uuid(),
  category_id integer not null references categories(id),
  district_id integer references districts(id),
  problem_type text,
  p25_labor numeric,
  p75_labor numeric,
  avg_parts numeric,
  sample_size integer default 0,
  updated_at timestamptz default now()
);
```

- `payout_batches` já foi definido em §3.8.
- Não é criada uma tabela de reclassificação: usa-se `job_charges(kind='reclassification')`.
- Não é criada uma tabela de sintomas por pergunta: `follow_up_schema` é JSONB.

---

## 4. Funções a alterar/criar

### Alterar

| Função | Alteração |
|---|---|
| `release_job_payment(job)` | Split na fonte: prestador recebe peças + mão de obra - comissão; plataforma regista comissão; deixa de debitar o saldo de operação do mestre |
| `release_job_addenda(job)` | Comissão apenas sobre mão de obra do aditamento; peças passam 100% |
| `request_job_payout(job)` | Mantém-se para compatibilidade, mas cria/entra num lote diário em vez de transferência imediata |
| `wallet_apply_earnings` | Mantém-se; recebe o payout final |
| `wallet_apply` | Mantém-se para operação, planos, multas e ajustes |
| `complete_payment` | Continua apenas para carregamentos de carteira; não é o fluxo principal do cliente |

### Criar

| Função | Objectivo |
|---|---|
| `calculate_travel_fee(request, provider)` | Calcula deslocação por distância + regras |
| `confirm_job_charge(reference, payment_id, status)` | Confirma deslocação/reclassificação de forma idempotente |
| `release_job_charge(charge)` | Liberta deslocação (100% prestador) ou diferença de reclassificação |
| `reclassify_job(job, new_labor, new_parts, evidence)` | Cria a diferença e bloqueia execução |
| `accept_reclassification(job)` / `reject_reclassification(job)` | Decisão do cliente; pagamento/estorno |
| `verify_completion_pin(job, pin)` | Valida PIN com hash, expiração e tentativas |
| `request_provider_payout(provider)` | Cria lote diário com todos os ganhos disponíveis |
| `settle_job(job)` | Consolida serviço + deslocação + aditamentos e faz o split final |
| `refund_job_charge(charge, destination)` | Reembolso por encargo (serviço, deslocação, reclassificação) |

---

## 5. Ordem das migrações

### `0254_payment_split_foundation.sql`
- `alter table jobs` (campos de preço/PIN/fase).
- `alter table service_requests` (pricing mode/symptom).
- `alter table job_payments` (labor/parts/travel credit).
- `alter table job_price_proposals` (breakdown/range).
- `alter table job_addenda` (kind/breakdown/evidence).
- `alter table job_refunds` (source/source_id).
- `create table job_charges`.
- `alter table platform_revenue`.
- `alter table request_media`.

### `0255_payout_batches.sql`
- `alter table payouts add batch_id`.
- `create table payout_batches`.

### `0256_catalog_and_symptoms.sql`
- `create table service_catalog`.
- `create table pricing_rules`.
- `create table symptoms`.
- `create table price_benchmarks`.
- Seeds iniciais (opcional, separado).

### `0257_functions.sql`
- Reescrever `release_job_payment`/`release_job_addenda`.
- Criar as funções de §4.
- Backfill de `job_payments.labor_amount` e `job_addenda.labor_amount`.
- Nenhuma função antiga é removida; as assinaturas existentes mantêm-se.

### `0258_compatibility.sql`
- Garantir defaults (`job_addenda.kind='extra'`, `job_refunds.source='service'`).
- Criar views de leitura se for necessário para apps v1:
  - `v_job_payments_service` (filtra o pagamento do serviço);
  - `v_job_addenda_extra` (filtra `kind='extra'`).
- As views são opcionais; o objectivo é as apps antigas continuarem a ler o que já liam.

---

## 6. Compatibilidade com apps

| App | O que lê/escreve | Impacto |
|---|---|---|
| v1 cliente | `service_requests`, `jobs`, `job_payments`, `job_addenda` | Continua a funcionar; não vê `job_charges` |
| v1 mestre | `jobs`, `job_payments`, `job_addenda`, `payouts` | Continua a funcionar; não vê deslocação/reclassificação |
| v2 cliente | Campos novos + `job_charges` | Fluxo novo: sintomas, catálogo, deslocação, reclassificação |
| v2 mestre | Campos novos + `job_charges` | Vê a taxa de deslocação, prova e PIN |
| Backoffice | `payouts`, `platform_revenue` | Passa a ver lotes e encargos |

**Regra de ouro:** `jobs.status` não muda de significado. `job_phase` é adicional. Nenhuma query antiga deixa de encontrar o pagamento do serviço.

---

## 7. Backfill (dados existentes)

Após a limpeza de trabalhos, as tabelas operacionais estão vazias. Ainda assim, a migração deve ser segura para dados futuros:

```sql
update job_payments
   set labor_amount = coalesce(labor_amount, amount),
       parts_amount = coalesce(parts_amount, 0);

update job_addenda
   set kind = coalesce(kind, 'extra'),
       labor_amount = coalesce(labor_amount, amount),
       parts_amount = coalesce(parts_amount, 0);

update job_refunds
   set source = coalesce(source, 'service');
```

---

## 8. Runner de migrações

Problema actual: `_migrations` só tem 12 registos, mas o schema já tem migrações até `0253`. Se correres `scripts/apply-migrations.mjs`, ele tenta aplicar `0001`–`0230` outra vez e falha.

Antes de aplicar `0254+`:

1. Fazer backup do schema (`pg_dump --schema-only`) e dos dados.
2. Confirmar que todas as migrações antigas estão aplicadas.
3. Backfill de `_migrations` com os ficheiros já aplicados **ou** criar um runner novo que só execute `0254+`.
4. Aplicar as novas migrações numa transacção.
5. Nunca usar o runner antigo sem `_migrations` corrigido.

---

## 9. Testes mínimos

- Cálculo de deslocação: base, km, mínimo, máximo, noite.
- Split: peças e deslocação sem comissão; comissão só sobre mão de obra.
- Reclassificação: aceitar, recusar, valor menor, valor maior, expiração.
- Reembolso: serviço, deslocação, carteira vs PaySuite, idempotência.
- PIN: expirado, errado, tentativas, sucesso.
- Payout: lote diário, falha, retry, reconciliação.
- Compatibilidade: v1 continua a ler `job_payments`/`job_addenda` sem alterações.
- Webhook: evento duplicado, pagamento falhado, referência desconhecida.

---

## 10. Decisões em aberto

1. A taxa de deslocação é paga **depois do match** (recomendado, permite km real) ou antes (taxa por zona)?
2. O `travel_credit` é total, parcial ou não existe?
3. A comissão incide sobre a mão de obra base ou inclui multiplicadores de urgência/noite? Recomendação: base.
4. O multiplicador nocturno aplica-se só à mão de obra ou também à deslocação?
5. No serviço fixo, o cliente paga tudo no início ou só a deslocação?
6. Qual o mínimo e a periodicidade do saque? Recomendação: lote diário, mínimo 500 MT.
7. Quais categorias entram no piloto?
8. As apps v1 continuam disponíveis durante quanto tempo após o lançamento da v2?

---

## 11. Resumo

- **Melhoria incremental**, não plataforma nova.
- `job_payments` fica como pagamento do serviço.
- `job_charges` só para deslocação e reclassificação.
- `job_addenda` continua para trabalho adicional.
- `jobs.status` fica; `job_phase` é adicional.
- `wallets` ficam; sem ledger novo.
- PaySuite fica; split é interno.
- Catálogo, sintomas e regras de preço são tabelas novas de produto.
- Saques passam a lote diário.
- Primeiro migração: `0254`, depois `0255`, `0256`, `0257`, `0258`.
