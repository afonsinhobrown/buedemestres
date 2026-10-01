# BUÉ DE MESTRES — Adenda v2: Serviços sob pedido (estilo Yango)

> Revê e **substitui em conflito** o `BUEDEMESTRES_PLANO_IMPLEMENTACAO.md` (fases 3 a 9) e estende `BUEDEMESTRES_FRONTEND_DESIGN.md` e `BUEDEMESTRES_TICKETS_SUPERADMIN.md`.
> O que não é mencionado aqui mantém-se. Idioma: português de Moçambique. Moeda: MT.

---

## 0. INSTRUÇÕES PARA O AGENTE

1. Ler primeiro o plano principal, o design e o plano de tickets/superadmin. Esta adenda só descreve **o que muda**.
2. Continua válido: toda a lógica de dinheiro em funções SQL transaccionais, RLS em todas as tabelas, validação com zod, auditoria de acções de staff, nenhuma palavra-passe em código.
3. **Ordem de trabalho:** seguir a secção 11. Não iniciar uma fase sem cumprir os critérios da anterior.
4. **Nunca assumir APIs de terceiros** (M-Pesa, e-Mola, KYC, mapas). Implementar interfaces (`PaymentProvider`, `KycProvider`, `MapProvider`) e ligar a fornecedores reais só com a documentação e credenciais fornecidas pelo proprietário.
5. Dados sensíveis (documentos, selfies, localização) seguem a secção 9. Em caso de dúvida, guardar menos, cifrar mais e expirar mais cedo.

---

## 1. O QUE MUDA

| Antes | Agora |
|---|---|
| Marketplace com pedido, orçamentos e escolha do cliente | Dois modos: **Imediato** (estilo Yango: pedido enviado ao mestre mais próximo) e **Agendado/Orçamento** (mantém o fluxo anterior) |
| Verificação simples (upload + aprovação manual) | **Cadastro rígido**: leitura do documento, selfie com prova de vida, comparação facial, revisão humana e acompanhamento em tempo real |
| Localização por bairro | **Mapa e localização** (PostGIS, presença do mestre, acompanhamento da chegada) |
| Contacto livre e pagamento fora | **Pagamento obrigatório na plataforma com retenção** até confirmação do serviço |
| PWA/web | **Apps móveis nativas** (cliente e mestre) + web (admin, SEO, cliente web) |
| Receita: planos, destaques, banners, afiliados | + **Comissão por serviço** (variável por plano) e taxa de verificação |

---

## 2. PRODUTO: DOIS MODOS

### 2.1 Modo Imediato (mecânico, socorro, electricista, chaveiro, canalizador…)

Fluxo do cliente:
1. Escolhe o ofício e descreve o problema (texto + fotos + dados do veículo, se aplicável).
2. Marca a localização (GPS + ajuste manual do pin + **ponto de referência em texto**, ex.: "junto ao mercado do Xipamanine", porque moradas formais são raras).
3. O sistema envia o pedido aos mestres elegíveis mais próximos.
4. O primeiro que aceita é confirmado. O cliente vê nome, foto, avaliação, distância e tempo estimado de chegada, e a aproximação no mapa.
5. O mestre chega, diagnostica e **propõe o preço na aplicação**. O cliente aceita e **paga**; o valor fica **retido**.
6. Serviço concluído: o cliente confirma. O valor é libertado ao mestre (menos a comissão). Ambos avaliam.

### 2.2 Modo Agendado/Orçamento (explicadores, carpinteiros, pintores, obras)

Mantém o fluxo do plano principal (pedido, orçamentos, escolha, chat), mas **o pagamento também é feito na plataforma com retenção** (pode ser por fases em trabalhos grandes: sinal + saldo).

### 2.3 Máquina de estados do trabalho (`jobs.status`)

```
requested → offered → accepted → en_route → arrived → price_proposed → price_agreed(paid/held)
   → in_service → awaiting_confirmation → completed → (paid_out)
Cancelamentos: cancelled_by_client | cancelled_by_provider | expired | disputed
```

Regras:
- **Pedido sem resposta** em 3 rondas de despacho (secção 4) → `expired` e sugestão de alargar raio ou agendar.
- **Cancelamento pelo cliente** depois de o mestre estar `en_route`: taxa de deslocação (valor por categoria, definido em `system_settings`) retida do cliente. Cancelamento pelo mestre depois de aceitar reduz o índice de fiabilidade e visibilidade.
- **Preço:** o mestre nunca cobra mais do que o acordado na aplicação. Extras exigem nova proposta aceite pelo cliente.
- **Confirmação:** o cliente confirma; sem resposta em 24 h e sem disputa, liberta-se automaticamente.
- **Disputa:** o cliente reporta antes da libertação; o valor fica retido e abre-se um ticket (ver plano de tickets) com prioridade alta.

---

## 3. APLICAÇÕES MÓVEIS

### 3.1 Abordagem

- **Expo (React Native) + TypeScript**, monorepo (`pnpm` + Turborepo), Android em primeiro lugar (mercado dominante) e iOS logo a seguir com a mesma base de código.
- **Duas apps** que partilham código: `Bué de Mestres` (cliente) e `Bué de Mestres Pro` (mestre). Uma só base de código evita trabalho duplicado para um programador.
- Web (Next.js) continua para: admin/superadmin, SEO (perfis públicos), landing e cliente web.

```
buedemestres/
├─ apps/
│  ├─ web/            # Next.js: site, admin, superadmin
│  ├─ cliente/        # Expo: app do cliente
│  └─ pro/            # Expo: app do mestre
├─ packages/
│  ├─ ui/             # tokens de design partilhados (cores, tipografia), componentes RN
│  ├─ api/            # cliente Supabase, tipos gerados, funções de acesso
│  ├─ validators/     # zod
│  ├─ domain/         # regras: estados do trabalho, comissões, formatação MT
│  └─ providers/      # PaymentProvider, KycProvider, MapProvider (interfaces + implementações)
└─ supabase/          # migrations, funções, seeds
```

### 3.2 Requisitos técnicos

| Área | Decisão |
|---|---|
| Navegação | Expo Router; barra inferior (secção 6.1 do design) |
| Localização | `expo-location`; app do mestre com **serviço em primeiro plano** (notificação persistente no Android) enquanto "Online" ou em trabalho; app do cliente só em uso |
| Notificações | `expo-notifications` (FCM no Android, APNs no iOS); pedidos novos chegam ao mestre como notificação de alta prioridade, com som e ecrã de oferta |
| Tempo real | Supabase Realtime (canal por trabalho); *fallback* de sondagem a cada 10 s |
| Câmara e documentos | `react-native-vision-camera` + reconhecimento de texto no dispositivo (ML Kit no Android, Vision no iOS via *frame processors*), ver secção 5 |
| Offline | Fila local de acções (aceitar, actualizar estado) com reenvio; ecrãs em modo leitura sem ligação |
| Poupança de dados | Imagens comprimidas (WebP ≤ 1 MB), mapas com vector tiles, actualização de posição adaptativa (secção 4.5) |
| Actualizações | EAS Update (correcções sem passar pela loja); EAS Build para binários |
| Segurança | Tokens em `expo-secure-store`; bloqueio por *jailbreak/root* apenas como aviso; certificado pinning opcional |
| Lojas | Conta Google Play (Android) e Apple Developer (iOS): custos e prazos de revisão a confirmar; **abrir contas em nome da RFL ou da sociedade**, não pessoais |
| Distribuição inicial | APK/AAB interno e *closed testing* para os primeiros mestres, antes da publicação |

### 3.3 Ecrãs principais

**Cliente:** Início (mapa + "Do que precisas?"), Novo pedido (categoria, problema, fotos, localização), A procurar mestre (animação de rondas), Mestre a caminho (mapa, ETA, contacto, partilhar viagem), Proposta de preço e pagamento, Confirmar serviço, Avaliar, Histórico, Carteira/métodos, Ajuda (tickets).
**Mestre:** Online/Offline, Oferta de pedido (distância, ETA, categoria, fotos, contagem regressiva), Navegar até ao cliente (abre mapas externos ou rota interna), Chegada e diagnóstico, Propor preço, Aguardar pagamento, Concluir, Ganhos e levantamentos, Verificação (linha do tempo), Plano e destaques, Ajuda.

Design: usar os tokens e o sistema de placas do documento de design. No mapa, o marcador do mestre é uma **mini-placa** com o pictograma do ofício; o pin do cliente é um círculo cobalto com anel amarelo só durante o pedido activo.

---

## 4. MAPAS, LOCALIZAÇÃO E DESPACHO

### 4.1 Opções de mapas e custos (consultado em Setembro de 2026; confirmar antes de orçamentar)

| Opção | Custo | Notas |
|---|---|---|
| **MapLibre + OpenStreetMap** (recomendado no arranque) | Sem licença. Custo = alojamento de *tiles* e do motor de rotas | Dados OSM abertos. Qualidade de moradas em Maputo/Matola a validar com testes reais |
| **Google Maps Platform** | Os SDKs de mapa Android/iOS são gratuitos e ilimitados. Serviços como Geocoding e Rotas cobram por evento acima de um limite mensal gratuito por SKU (10 000 em Essentials, 5 000 em Pro, 1 000 em Enterprise). Acima disso, algo entre 2 e 7 USD por 1 000 nos SKUs Essentials. A Matriz de Rotas cobra **por elemento** | Melhor cobertura e ETA com trânsito. Sem limite rígido por defeito: alertas de orçamento avisam, não bloqueiam |
| **Mapbox** | Mapas móveis: 25 000 utilizadores activos mensais gratuitos; geocoding: 100 000 pedidos gratuitos; cartão de crédito exigido | Bom para navegação; custos por MAU e por viagem no SDK de navegação |

**Recomendação:**
1. **Mapa:** MapLibre com *tiles* OSM (fornecedor gerido ou alojamento próprio).
2. **Procura de mestres próximos:** **PostGIS** na base de dados (`ST_DWithin`), sem custo por pedido.
3. **Rota e ETA:** motor OSRM/Valhalla alojado, ou serviço gerido com camada gratuita, atrás da interface `MapProvider`. **Aproximação de reserva:** distância em linha recta × factor de rodovia.
4. **Geocoding:** dispensável no arranque. O cliente marca o pin e escreve o ponto de referência.
5. **Plano B:** implementar `MapProvider` também para Google/Mapbox e comutar por flag se os dados OSM se revelarem insuficientes. **Definir orçamento e alertas de custo** antes de activar.
6. **Teste obrigatório na fase 3:** verificar em Maputo e Matola a qualidade das ruas e bairros e o erro de ETA em 30 trajectos reais.

### 4.2 Modelo de dados de presença e pedidos (ver migration na secção 8)

- `provider_presence`: posição actual, `is_online`, categorias em que está disponível, `updated_at`, trabalho activo.
- Presença considerada **válida** se `updated_at` for inferior a 90 s. Mestre com trabalho activo não recebe novas ofertas.

### 4.3 Algoritmo de despacho

1. `nearby_providers(pedido, raio, limite)` devolve mestres **verificados, publicados, online, sem trabalho activo, na categoria e dentro do raio**, ordenados por distância e depois por avaliação.
2. **Rondas:** ronda 1 = 5 km, top 5; ronda 2 = 10 km, top 8; ronda 3 = 20 km, top 10. Cada oferta expira em **60 s** (SOS) ou **5 min** (hoje/agendado). Valores em `system_settings`.
3. As ofertas da mesma ronda são enviadas em simultâneo por notificação push. O **primeiro a aceitar** ganha (`accept_offer` com bloqueio de linha; as restantes ofertas são canceladas).
4. Sem aceitação após a ronda 3: pedido `expired`; ao cliente propõe-se alargar, agendar ou ligar a mestres com contacto directo, se autorizado.
5. **Transparência:** o plano do mestre pode influenciar a ordem apenas em **desempate** dentro da mesma distância; nunca contra um mestre claramente mais próximo. Destaques pagos são identificados.
6. **Anti-abuso:** limite de pedidos abertos por cliente; bloqueio de clientes com muitas anulações; penalização de mestres que aceitam e cancelam.

### 4.4 Índice de fiabilidade do mestre

`taxa_de_aceitação`, `taxa_de_cancelamento`, `tempo_médio_de_chegada`, `nota_média`, `trabalhos_concluídos` → usados no desempate e em alertas ao admin (não visíveis como número ao cliente, só como selo/nota).

### 4.5 Consumo de bateria e dados

| Situação | Actualização de posição |
|---|---|
| Mestre online sem trabalho | 30–60 s ou ao mover 200 m |
| Trabalho activo (a caminho) | 5–10 s |
| Cliente | Só ao criar o pedido; durante o acompanhamento, apenas a posição do mestre é transmitida |

- Só o **mestre** partilha localização contínua e **só enquanto online ou em trabalho**. O cliente vê a posição do mestre apenas depois de aceitar.
- Persistir trilho do trabalho apenas de forma esparsa (a cada 30 s), com retenção de 90 dias, para disputas.

---

## 5. CADASTRO RÍGIDO DOS MESTRES (KYC)

### 5.1 Regra de ouro

**Nenhum mestre recebe pedidos sem `verification = approved`.** A aprovação é sempre confirmada por uma pessoa da equipa; a automação serve para acelerar e assinalar risco, não para decidir sozinha.

### 5.2 Etapas (linha do tempo mostrada ao mestre)

```
1. Conta (telefone com OTP)        → 2. Dados pessoais
3. Documento (frente e verso)      → 4. Leitura automática (OCR)
5. Selfie com o documento + prova de vida → 6. Comparação facial
7. Verificações automáticas        → 8. Revisão humana
9. Aprovado | Pedido de correcção | Rejeitado
```

Estados (`verification_documents.stage`): `draft`, `documents_submitted`, `auto_checks`, `manual_review`, `needs_info`, `approved`, `rejected`, `expired`.

### 5.3 Captura no telemóvel

- **Documento:** ecrã de câmara com moldura, detecção de contornos, verificação de nitidez/reflexo/luz e captura automática. Frente e verso (BI), página de dados (passaporte), carta de condução, DIRE.
- **Leitura no dispositivo:** OCR (ML Kit/Vision) para pré-preencher nome, número, data de nascimento, validade; o mestre **confirma ou corrige** os campos.
- **Selfie com o documento:** o mestre segura o documento junto ao rosto. Instruções em ecrã e exemplo.
- **Prova de vida:** desafio activo (piscar, virar a cabeça, sorrir) com vários *frames* capturados. Rejeitar se detecta ecrã de outro telemóvel ou fotografia impressa (fornecedor com anti-*spoofing*).
- Tudo é enviado por ligação cifrada para **bucket privado** (`verification`). Nada fica no rolo de câmara.

### 5.4 Verificações no servidor (`KycProvider`)

Interface:

```ts
interface KycProvider {
  submit(input: { verificationId: string; docFront: Blob; docBack?: Blob; selfie: Blob; liveness: Blob[]; country: 'MZ' }): Promise<{ providerRef: string }>;
  handleCallback(req: Request): Promise<KycResult>; // ocr, faceMatch, liveness, tamper flags
}
```

**Opções de implementação** (decidir na fase 1 com *testes em BI e cartões reais*):
1. **API comercial de verificação** com leitura de documento, prova de vida e comparação facial. Alguns fornecedores listam suporte a documentos moçambicanos (BI/cartão de identidade e passaporte), mas **a cobertura de cada versão do BI e da carta de condução tem de ser testada** com amostras reais. Pedir sandbox e preços por verificação.
2. **Stack aberta alojada por nós:** OCR (Tesseract/PaddleOCR) com modelos/regras próprios para o BI moçambicano + reconhecimento facial de código aberto (ex.: ArcFace/InsightFace) + prova de vida no dispositivo. Menor custo por verificação, mais trabalho de engenharia e afinação. Faz sentido se o volume for alto.
3. **Híbrido (recomendado):** OCR e prova de vida no dispositivo (gratuito), comparação facial e detecção de fraude via API comercial ou serviço próprio, **sempre** com revisão humana.

**Importante:** não há, que eu saiba, API pública para validar o número do BI contra a base oficial do Estado. Por isso a revisão humana é obrigatória e os testes de consistência abaixo são essenciais.

Verificações automáticas (`verification_checks`), cada uma com resultado e pontuação:
- Legibilidade e qualidade das imagens.
- Campos OCR vs dados declarados (nome, data de nascimento).
- Documento **em validade**.
- Formato do número do documento.
- Pontuação de comparação facial (selfie vs foto do documento) acima do limiar.
- Prova de vida aprovada.
- **Duplicados:** número de documento (hash com segredo do servidor) e rosto já registados noutra conta → bloqueia e alerta admin.
- Sinais de adulteração (metadados, edição, ecrã sobre ecrã) quando fornecidos pelo `KycProvider`.

Resultado automático: `auto_pass` (vai para revisão rápida), `auto_review` (revisão detalhada), `auto_fail` (pede nova captura ou rejeita).

### 5.5 Revisão humana (admin)

- Fila com prioridade por antiguidade e risco.
- Ecrã em duas colunas: imagens do documento e da selfie ampliáveis à esquerda; dados extraídos, pontuações e alertas à direita.
- Acções: **Aprovar**, **Pedir correcção** (motivo em lista: foto desfocada, documento cortado, reflexo, selfie sem documento, dados diferentes) e **Rejeitar** (motivo obrigatório).
- Atalhos de teclado (A, C, R). Toda a decisão fica em `verification_events` e `audit_logs`.
- **SLA de revisão:** 24 h úteis (configurável). Indicador de atraso no painel.

### 5.6 Acompanhamento pelo mestre

- Ecrã "A minha verificação" com **linha do tempo** (como o acompanhamento de uma encomenda): etapa actual, tempo estimado, o que falta e botão de acção quando é pedida correcção.
- **Notificação push e SMS/WhatsApp** a cada mudança de etapa.
- Tickets de suporte a partir do ecrã ("Preciso de ajuda com a verificação").

### 5.7 Requisitos adicionais por categoria

| Categoria | Além do documento e da selfie |
|---|---|
| Mecânico, chapeiro, pneus | Fotografia da oficina/local e localização; fotografias de trabalhos |
| Reboque/socorro | Carta de condução válida, dados do veículo (matrícula), fotografia do veículo |
| Electricista, canalizador, gás | Certificados ou referências, quando existirem |
| Explicador | Habilitações (certificado/declaração) e referências |
| Todos (opcional) | NUIT, quando o mestre for facturar; registo criminal em categorias sensíveis, **só se a lei permitir e com consentimento** |

### 5.8 Revalidação

- Reverificação quando o documento expira, a cada 12 meses e após incidentes graves (denúncias procedentes).
- Reverificação leve por selfie (prova de vida) em alterações sensíveis: mudança de telefone, levantamento de valores acima de um limite, novo dispositivo.

### 5.9 Regras de negócio

- Taxa de verificação **única** (valor em `system_settings`, definido pela RFL), para cobrir o custo por verificação.
- Máximo de 3 tentativas por documento antes de revisão manual obrigatória e possível bloqueio.
- Mestre rejeitado pode recorrer uma vez, por ticket.

---

## 6. PAGAMENTO OBRIGATÓRIO COM RETENÇÃO

### 6.1 Princípios

- O cliente paga **à plataforma**; o valor fica **retido** até a confirmação do serviço.
- O mestre vê que o pagamento está retido antes de começar (garante que será pago).
- **Livro-razão** (ledger) com registo imutável de cada movimento. Nunca actualizar saldos sem gerar movimento.
- Toda a acção passa por funções SQL transaccionais e é **idempotente** (chave do operador único).

### 6.2 Fluxo

```
Cliente aceita preço → pedido de pagamento (M-Pesa / e-Mola) → confirmação por webhook
  → job_payments.status = held (retido)
Serviço concluído → cliente confirma OU 24 h sem disputa
  → release: comissão para a plataforma + valor líquido para a carteira do mestre
Mestre levanta valor → payout para M-Pesa/e-Mola
Disputa → held → decisão → release parcial/total ao mestre ou reembolso ao cliente
```

### 6.3 Comissão

`commission_rate` vem do plano activo do mestre no momento do acordo do preço (Grátis 12 %, Pro 8 %, Premium 5 % como valores iniciais em `plans.commission_rate`). A taxa aplicada **fica gravada no pagamento** para não mudar retroactivamente.

### 6.4 Pagamento em dinheiro (decisão pendente, desactivado por defeito)

Se a RFL o autorizar no piloto:
- O mestre só aceita trabalhos em dinheiro se a **carteira tiver saldo mínimo** (≥ comissão estimada).
- Ao concluir, a comissão é **debitada da carteira do mestre**.
- Sem saldo suficiente, os pedidos em dinheiro ficam bloqueados para esse mestre.

### 6.5 Levantamentos

- Automático ao fim de cada trabalho (D+0) ou diário/semanal, configurável.
- Mínimo por levantamento e conta/telefone **validado por verificação leve**.
- Levantamentos acima de um limite exigem nova prova de vida e, para valores altos, aprovação (ver dupla aprovação no plano de superadmin).

### 6.6 Reconciliação e controlo

- Reconciliação **diária** entre `payments`/`job_payments`/`payouts` e os extractos do operador; diferenças geram alerta no painel de superadmin.
- Painel de saúde: pagamentos pendentes há mais de 48 h, webhooks falhados, valores retidos por antiguidade.

### 6.7 Nota regulatória (obrigatória para a RFL)

Reter dinheiro de terceiros é uma actividade que pode exigir **entidade legal autorizada** e conta de custódia. **Contas comerciais de M-Pesa/e-Mola exigem entidade constituída.** Por isso a conta comercial e a conta de custódia devem ficar em nome da RFL ou da sociedade, validadas com jurista e com o Banco de Moçambique antes de operar. Até isso estar resolvido, manter o `PaymentProvider = manual` e limitar o piloto a montantes baixos.

---

## 7. MODALIDADES DE GANHO (o que a plataforma tem de suportar)

| Modalidade | Implementação |
|---|---|
| Comissão por serviço | `job_payments.commission_*`; `platform_revenue` |
| Subscrição mensal | `plans` + `subscriptions` (já existem); `commission_rate` por plano |
| Destaques / prioridade | `boosts` (já existe); prioridade no despacho só como desempate |
| Taxa de verificação | Cobrada uma vez na carteira/pagamento, registada como `platform_revenue` |
| Taxa de deslocação / cancelamento | Retida do cliente em cancelamentos tardios; parte para o mestre |
| Publicidade e parcerias | `banners` + campanhas de parceiros (lojas de peças, seguradoras) |
| Afiliados | Já existe; comissão sobre carregamentos e opcionalmente sobre a primeira compra |
| Empresas (B2B) | Contas de empresa com vários utilizadores e facturação mensal (fase posterior) |

**Relatório financeiro (superadmin/finance):** receita por modalidade, valor retido, valor libertado, comissão média, taxa de disputa, receita por mestre e por categoria, conciliado com o operador.

---

## 8. ESQUEMA — MIGRATION `0200_on_demand.sql`

Executar `alter type ... add value` em migration **separada e anterior** (não podem ser usados na mesma transacção).

### 8.1 Enums

```sql
-- 0199_enums.sql (separada)
alter type job_status add value if not exists 'requested';
alter type job_status add value if not exists 'accepted';
alter type job_status add value if not exists 'en_route';
alter type job_status add value if not exists 'arrived';
alter type job_status add value if not exists 'price_proposed';
alter type job_status add value if not exists 'awaiting_confirmation';
alter type job_status add value if not exists 'expired';
alter type payment_method add value if not exists 'cash';
alter type tx_type add value if not exists 'job_payout';
alter type tx_type add value if not exists 'job_commission';
alter type tx_type add value if not exists 'withdrawal';
alter type tx_type add value if not exists 'verification_fee';

-- 0200_on_demand.sql
create extension if not exists postgis;
create type request_mode  as enum ('on_demand','quote');
create type urgency_level as enum ('sos','today','scheduled');
create type offer_status  as enum ('sent','viewed','accepted','declined','expired','cancelled');
create type escrow_status as enum ('pending_payment','held','released','refunded','partially_refunded','disputed');
create type payout_status as enum ('pending','processing','completed','failed');
create type kyc_stage     as enum ('draft','documents_submitted','auto_checks','manual_review','needs_info','approved','rejected','expired');
```

### 8.2 Pedidos com localização e presença

```sql
alter table service_requests
  add column mode request_mode not null default 'quote',
  add column urgency urgency_level not null default 'scheduled',
  add column location geography(Point,4326),
  add column location_note text,                 -- ponto de referência
  add column vehicle jsonb,                      -- {marca, modelo, matricula}
  add column search_radius_m int not null default 5000;
create index service_requests_loc_gix on service_requests using gist(location);

create table provider_presence (
  provider_id uuid primary key references provider_profiles(profile_id) on delete cascade,
  is_online boolean not null default false,
  location geography(Point,4326),
  heading smallint,
  accuracy_m int,
  categories int[] not null default '{}',
  active_job_id uuid,
  updated_at timestamptz not null default now()
);
create index provider_presence_gix on provider_presence using gist(location) where is_online;

create table request_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  status offer_status not null default 'sent',
  round smallint not null default 1,
  distance_m int,
  eta_s int,
  sent_at timestamptz not null default now(),
  viewed_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz not null,
  unique (request_id, provider_id)
);
create index on request_offers(provider_id, status, expires_at);
```

### 8.3 Trabalhos: preço, comissão e localização

```sql
alter table jobs
  add column price_estimate_min numeric(12,2),
  add column price_estimate_max numeric(12,2),
  add column price_proposed numeric(12,2),
  add column arrival_eta_s int,
  add column accepted_at timestamptz,
  add column arrived_at timestamptz,
  add column started_at timestamptz,
  add column confirm_deadline timestamptz,
  add column pickup_location geography(Point,4326);

create table job_price_proposals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  proposed_by uuid not null references profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now()
);

create table job_location_log (           -- trilho esparso, retenção de 90 dias
  id bigserial primary key,
  job_id uuid not null references jobs(id) on delete cascade,
  location geography(Point,4326) not null,
  recorded_at timestamptz not null default now()
);
create index on job_location_log(job_id, recorded_at);
```

### 8.4 Pagamentos retidos, levantamentos e receita

```sql
alter table plans add column commission_rate numeric(5,4) not null default 0.1200;

create table job_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references jobs(id),
  client_id uuid not null references profiles(id),
  provider_id uuid not null references provider_profiles(profile_id),
  amount numeric(12,2) not null check (amount > 0),
  commission_rate numeric(5,4) not null,
  commission_amount numeric(12,2) not null,
  provider_payout numeric(12,2) not null,
  method payment_method not null,
  msisdn text,
  status escrow_status not null default 'pending_payment',
  provider_ref text unique,
  held_at timestamptz,
  release_after timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  ticket_id uuid,
  created_at timestamptz not null default now(),
  check (commission_amount + provider_payout = amount)
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id),
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null,
  msisdn text not null,
  status payout_status not null default 'pending',
  provider_ref text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table platform_revenue (
  id uuid primary key default gen_random_uuid(),
  kind text not null,               -- commission | subscription | boost | verification_fee | cancellation_fee | ad
  amount numeric(12,2) not null,
  job_id uuid references jobs(id),
  profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on platform_revenue(kind, created_at);
```

### 8.5 KYC rígido

```sql
alter table verification_documents
  add column stage kyc_stage not null default 'documents_submitted',
  add column ocr_data jsonb,                       -- campos lidos (cifrar campos sensíveis na aplicação)
  add column ocr_confidence numeric(4,3),
  add column face_match_score numeric(4,3),
  add column liveness_passed boolean,
  add column doc_number_hash text,                 -- HMAC-SHA256 com segredo do servidor; não guardar o número em claro
  add column face_hash text,                       -- identificador para detecção de duplicados (do KycProvider)
  add column provider_ref text,
  add column attempts smallint not null default 1;
create unique index verification_docnum_uq on verification_documents(doc_number_hash)
  where stage in ('documents_submitted','auto_checks','manual_review','needs_info','approved');

create table verification_events (
  id bigserial primary key,
  verification_id uuid not null references verification_documents(id) on delete cascade,
  stage kyc_stage not null,
  actor_id uuid references profiles(id),
  note text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on verification_events(verification_id, created_at);

create table verification_checks (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references verification_documents(id) on delete cascade,
  check_type text not null,         -- image_quality | ocr_match | expiry | number_format | face_match | liveness | duplicate | tamper
  passed boolean not null,
  score numeric(5,3),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

Nota: se a migration anterior criou `verification_documents.doc_number text`, **remover** essa coluna após migrar para `doc_number_hash`.

### 8.6 Funções

```sql
-- Mestres elegíveis próximos
create or replace function nearby_providers(p_request uuid, p_radius_m int, p_limit int default 10)
returns table (provider_id uuid, distance_m int, rating_avg numeric)
language sql stable security definer set search_path = public as $$
  select pr.provider_id,
         ST_Distance(pr.location, r.location)::int,
         pp.rating_avg
  from service_requests r
  join provider_presence pr
    on pr.is_online
   and pr.updated_at > now() - interval '90 seconds'
   and pr.active_job_id is null
   and r.category_id = any(pr.categories)
   and ST_DWithin(pr.location, r.location, p_radius_m)
  join provider_profiles pp
    on pp.profile_id = pr.provider_id
   and pp.is_published and pp.is_available and pp.verification = 'approved'
  where r.id = p_request
    and not exists (select 1 from request_offers o
                    where o.request_id = r.id and o.provider_id = pr.provider_id)
  order by ST_Distance(pr.location, r.location), pp.rating_avg desc
  limit p_limit;
$$;

-- Aceitar oferta: o primeiro ganha
create or replace function accept_offer(p_offer uuid, p_eta_s int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_o request_offers; v_r service_requests; v_job uuid;
begin
  select * into v_o from request_offers
   where id = p_offer and provider_id = auth.uid() for update;
  if not found or v_o.status not in ('sent','viewed') or v_o.expires_at < now() then
    raise exception 'offer_unavailable';
  end if;

  select * into v_r from service_requests where id = v_o.request_id for update;
  if v_r.status <> 'open' then raise exception 'request_taken'; end if;

  if exists (select 1 from provider_presence where provider_id = auth.uid() and active_job_id is not null) then
    raise exception 'provider_busy';
  end if;

  update request_offers set status='accepted', responded_at=now(), eta_s = coalesce(p_eta_s, eta_s) where id = p_offer;
  update request_offers set status='cancelled', responded_at=now()
   where request_id = v_o.request_id and id <> p_offer and status in ('sent','viewed');
  update service_requests set status='accepted' where id = v_o.request_id;

  insert into jobs(request_id, client_id, provider_id, status, accepted_at, arrival_eta_s, pickup_location)
  values (v_r.id, v_r.client_id, auth.uid(), 'accepted', now(), coalesce(p_eta_s, v_o.eta_s), v_r.location)
  returning id into v_job;

  update provider_presence set active_job_id = v_job where provider_id = auth.uid();
  return v_job;
end $$;

-- Preço acordado -> pagamento pendente (o cliente aceita a proposta)
create or replace function agree_price(p_proposal uuid, p_method payment_method, p_msisdn text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_p job_price_proposals; v_j jobs; v_rate numeric; v_comm numeric; v_id uuid;
begin
  select * into v_p from job_price_proposals where id = p_proposal for update;
  select * into v_j from jobs where id = v_p.job_id for update;
  if v_j.client_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_p.status <> 'pending' then raise exception 'proposal_not_pending'; end if;

  select coalesce(pl.commission_rate, 0.12) into v_rate
    from provider_profiles pp
    left join subscriptions s on s.provider_id = pp.profile_id and s.status = 'active'
    left join plans pl on pl.id = s.plan_id
   where pp.profile_id = v_j.provider_id;

  v_comm := round(v_p.amount * v_rate, 2);
  update job_price_proposals set status='accepted' where id = p_proposal;
  update jobs set price_proposed = v_p.amount where id = v_j.id;

  insert into job_payments(job_id, client_id, provider_id, amount, commission_rate, commission_amount,
                           provider_payout, method, msisdn)
  values (v_j.id, v_j.client_id, v_j.provider_id, v_p.amount, v_rate, v_comm, v_p.amount - v_comm, p_method, p_msisdn)
  returning id into v_id;
  return v_id;
end $$;

-- Confirmação do pagamento (webhook/admin, service role): passa a retido
create or replace function hold_job_payment(p_job_payment uuid, p_provider_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update job_payments set status='held', held_at=now(), provider_ref = p_provider_ref
   where id = p_job_payment and status = 'pending_payment';
  if not found then return; end if;        -- idempotente
  update jobs set status='in_service', started_at = coalesce(started_at, now())
   where id = (select job_id from job_payments where id = p_job_payment);
end $$;

-- Libertar retenção (cliente confirma, ou automático após 24 h sem disputa)
create or replace function release_job_payment(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_pay job_payments;
begin
  select * into v_pay from job_payments where job_id = p_job for update;
  if not found or v_pay.status <> 'held' then return; end if;   -- idempotente

  perform wallet_apply(v_pay.provider_id, 'job_payout', v_pay.provider_payout,
                       'Serviço concluído', null, jsonb_build_object('job_id', p_job));
  insert into platform_revenue(kind, amount, job_id, profile_id)
  values ('commission', v_pay.commission_amount, p_job, v_pay.provider_id);

  update job_payments set status='released', released_at=now() where id = v_pay.id;
  update jobs set status='completed' where id = p_job;
  update provider_presence set active_job_id = null where active_job_id = p_job;
end $$;
```

**Nota:** no ficheiro real, as funções chamadas pelo cliente/mestre validam `auth.uid()`; `hold_job_payment` e libertação automática só correm com *service role* (webhook/cron). Não conceder `execute` a `authenticated` nas funções de servidor.

### 8.7 Jobs agendados (`pg_cron`)

```sql
-- libertar automaticamente após 24 h sem disputa (a cada 10 min)
select cron.schedule('auto-release','*/10 * * * *', $$
  select release_job_payment(job_id) from job_payments
   where status = 'held' and release_after is not null and release_after < now()
$$);
-- expirar ofertas
select cron.schedule('expire-offers','* * * * *', $$
  update request_offers set status='expired' where status in ('sent','viewed') and expires_at < now()
$$);
-- presença antiga -> offline
select cron.schedule('presence-stale','* * * * *', $$
  update provider_presence set is_online=false where is_online and updated_at < now() - interval '3 minutes'
$$);
-- limpar trilhos com mais de 90 dias
select cron.schedule('gc-location','0 3 * * *', $$
  delete from job_location_log where recorded_at < now() - interval '90 days'
$$);
```

O despacho por rondas corre num *worker* (Edge Function/servidor) que invoca `nearby_providers`, cria `request_offers` e envia push; não em SQL puro.

### 8.8 RLS (acrescentar à tabela do plano principal)

| Tabela | SELECT | Escrita |
|---|---|---|
| `provider_presence` | o próprio mestre; cliente **só** do mestre do seu trabalho activo | o próprio (via função que valida posição plausível) |
| `request_offers` | mestre destinatário; dono do pedido (só ofertas aceites) | só via funções |
| `job_price_proposals`, `job_payments` | participantes do trabalho + finance/admin | só via funções |
| `job_location_log` | cliente do trabalho (durante e até 24 h depois) + admin | só servidor |
| `payouts` | o mestre + finance | só via funções/servidor |
| `platform_revenue` | finance/admin/superadmin | só servidor |
| `verification_*` | o mestre (só linha do tempo e estado); `verifications.review` vê tudo | só via funções/servidor |

---

## 9. SEGURANÇA, PRIVACIDADE E CONFIANÇA

**Dados de identificação e biometria**
- Bucket privado `verification`, **cifrado em repouso**, URLs assinadas de 60 s, acesso só a `verifications.review` e auditado (`audit_logs` de cada visualização).
- Guardar o **hash** do número do documento (HMAC), não o número em claro. Campos OCR sensíveis cifrados ao nível da aplicação.
- Recolher **consentimento explícito** e informar finalidade e prazo de conservação. Validar com jurista a legislação de protecção de dados aplicável antes do lançamento.
- Retenção: imagens de verificações rejeitadas apagadas após 30 dias; de aprovadas conservadas enquanto a conta existir e durante o período exigido pela lei/regulamento aplicável (definir com jurista); descartar *frames* de prova de vida logo após a decisão.

**Segurança do serviço**
- Botão **SOS/Denunciar** na app durante o trabalho; partilha do trajecto e do estado com um contacto de confiança.
- Máscara de números (chamadas via plataforma) como melhoria futura; no arranque, contacto só depois de aceitar.
- Avaliação **bidireccional** (mestre também avalia o cliente). Clientes com denúncias repetidas são restringidos.
- Alertas: mestre muito longe do local, mudança brusca de posição, aceitações e cancelamentos anómalos.

**Fraude de pagamento**
- Confirmação só por webhook verificado ou aprovação de `finance`. Sem confiar em ecrãs do cliente.
- Limites por utilizador novo (valor máximo nos primeiros trabalhos).
- Contas de levantamento com validação e período de espera em contas novas.

---

## 10. DESIGN (ecrãs novos; usar tokens e placas do documento de design)

1. **Mapa como ecrã principal do cliente** (ocupa toda a largura; painel inferior arrastável). Sem sombras decorativas: painel Papel com borda de tinta.
2. **Cartão de oferta do mestre:** distância e ETA em números grandes, fotos do problema, contagem regressiva em barra simples. Botões `Aceitar` (primário) e `Recusar`.
3. **Acompanhamento:** mini-placa do mestre no mapa, linha "A chegar em X min", botões `Ligar` e `Mensagem`, estado do pagamento e botão `Partilhar viagem`.
4. **Proposta de preço:** tabela de preços (pontos condutores) com linhas de serviço e total; botão `Aceitar e pagar`. Após pagar, o **talão** mostra "Valor retido até confirmares o serviço".
5. **Confirmação:** ecrã de dois botões grandes, `Serviço concluído` e `Tive um problema`; explica que o valor só sai depois de confirmares.
6. **Verificação do mestre:** linha do tempo vertical, guia de câmara com moldura e exemplos correcto/incorrecto, e ecrã de estado com o próximo passo.
7. **Estados vazios e de espera** com a mesma voz da marca ("Estamos a procurar o mestre mais perto de ti.").

---

## 11. FASES REVISTAS E ESTIMATIVAS

Estimativas de esforço (semanas de trabalho), **a rever depois de detalhar o âmbito**. "Só" = um programador; "Apoio" = com programador móvel e designer contratados.

| Fase | Conteúdo | Só | Apoio |
|---|---|---|---|
| 0 | Fundação: monorepo (web + 2 apps Expo), Supabase + PostGIS, tokens de design, CI | 3 | 3 |
| 1 | Contas (OTP), perfis e **cadastro rígido** completo (captura, OCR, prova de vida, `KycProvider`, fila e acompanhamento) | 5 | 4 |
| 2 | Catálogo de serviços, perfil público, pesquisa web (SEO) | 3 | 2 |
| 3 | **On-demand:** mapa, presença, despacho por rondas, ofertas, acompanhamento em tempo real, push | 6 | 4 |
| 4 | Trabalho: estados, proposta de preço, chat, avaliações bidireccionais, cancelamentos | 3 | 3 |
| 5 | **Pagamento retido**, carteira, planos e comissões, levantamentos (`PaymentProvider = manual`) | 5 | 4 |
| 6 | Apps móveis: polimento, modo offline, publicação nas lojas | 6 | 3 |
| 7 | Tickets e superadmin (documento anterior, fases 10 a 14) | 5 | 4 |
| 8 | Pagamentos automáticos (M-Pesa/e-Mola), reconciliação diária | 4 | 4 |
| 9 | Piloto: endurecimento, testes de carga e campo, metas | 4 | 4 |
| | **Total aproximado** | **44 (~10 meses)** | **31 (~7 meses)** |

**Caminho crítico e riscos de calendário:**
- **Desde o mês 1** (fora do código): constituição de entidade, contas comerciais dos operadores de pagamento, contas nas lojas de aplicações, contrato com fornecedor de KYC e testes com documentos reais. São tarefas da **RFL**, e atrasam a fase 8 se começarem tarde.
- Prazos de revisão das lojas (Apple e Google) e de aprovação dos operadores de pagamento não dependem do programador.
- A fase 3 só se valida com **mestres reais a testar em campo**; reservar semanas para testes com 10 a 20 mestres.

### Critérios de aceitação por fase (novos)

- **1:** captura de BI e selfie funciona em 3 modelos de telemóvel de gama baixa; duplicado de documento bloqueado; mestre acompanha todas as etapas; revisão de 1 mestre em < 2 min.
- **3:** dois telemóveis reais completam o fluxo pedido → aceitação → chegada; nunca dois mestres aceitam o mesmo pedido (teste de concorrência com 20 aceitações simultâneas); posição só visível ao cliente do trabalho activo.
- **5:** saldo nunca negativo; liberação idempotente (executar duas vezes não paga duas vezes); reconciliação com dados de teste bate ao cêntimo.
- **9:** piloto com metas acordadas; 0 tabelas sem RLS; auditoria de acesso a documentos activa.

---

## 12. CUSTOS RECORRENTES A ORÇAMENTAR (pedir cotações actuais)

| Item | Nota |
|---|---|
| Base de dados e autenticação (Supabase) | Plano pago recomendado para produção; PostGIS incluído |
| Alojamento web (Vercel ou equivalente) | Plano pago para equipa |
| SMS/OTP | Por mensagem; avaliar WhatsApp/Telegram OTP para poupar |
| Verificação de identidade | Por verificação (API comercial) ou custo de servidor (stack própria) |
| Mapas | OSM: alojamento de tiles e rotas; Google/Mapbox: por utilização acima do limite gratuito |
| Push notifications | Gratuitas (FCM/APNs) |
| Monitorização (Sentry), e-mail transaccional | Camadas gratuitas no início |
| Contas de lojas | Google Play e Apple Developer (valores e renovação a confirmar) |
| Taxas do operador de pagamento | Sobre cada transacção; incluir no modelo financeiro |
| Apoio técnico | Programador móvel, designer, testes |

---

## 13. DECISÕES PENDENTES (a fechar com a RFL antes da fase 3)

1. Modelo de parceria (A, B, C, D ou E) e entidade titular das contas (pagamentos, lojas, KYC, mapas).
2. Fornecedor de KYC (API comercial, stack própria ou híbrido) depois de testar documentos reais.
3. Provedor de mapas (OSM no arranque, com plano de migração) e orçamento de alertas.
4. Comissões finais por plano e valor da taxa de verificação.
5. Pagamento em dinheiro: sim ou não no piloto.
6. Taxa de deslocação e regras de cancelamento por categoria.
7. Ofícios e zonas do piloto (sugestão: mecânicos + um segundo ofício; Maputo e Matola).
8. Política de retenção de documentos e texto de consentimento (com jurista).
9. SLA de revisão de verificações e equipa que o cumpre.

---

## 14. BACKLOG POSTERIOR

Máscara de chamadas, chat com voz, IA para descrever o problema a partir de fotos/áudio e sugerir categoria e faixa de preço (rascunho, nunca decisão), viagens partilhadas em tempo real com terceiros, planos para empresas e frotas, seguro/garantia de serviço, pontos de referência locais alimentados pelos utilizadores, programa de fidelidade, expansão por província.
