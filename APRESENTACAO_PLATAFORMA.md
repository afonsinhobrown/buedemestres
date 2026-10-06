# BUÉ DE MESTRES
## O que este sistema faz — apresentação em linguagem simples

**Versão 2 · Outubro de 2026**

---

## 1. O que é, em duas frases

A **Bué de Mestres** é um **serviço para encontrar e contratar profissionais** — electricistas, canalizadores, mecânicos, carpinteiros, pedreiros, pintores, cabeleireiros, explicadores — **em Moçambique.**

É como ter na mão a lista de todos os mestres da cidade, saber quem está livre, quem está mesmo perto, quem é de confiança — e **pagar só quando o trabalho estiver feito.**

---

## 2. O problema que resolve

Hoje, quando alguém precisa de um mestre:

- Pergunta aos vizinhos e à família (**boca-a-boca**) — e nem sempre aparece alguém.
- Não sabe se o profissional que encontrou é **de confiança** (não há avaliações nem identidade verificada).
- Não sabe **quanto custa** antes de o trabalho começar.
- Paga **às cegas**, antes de ver o resultado — se o trabalho correr mal, o dinheiro já foi.
- Não sabe **onde é que o mestre anda** enquanto espera em casa.

A Bué de Mestres resolve os cinco pontos.

---

## 3. Uma história concreta — como funciona

> **Maria, em Maputo, tem um cano a arrebentar em casa.** É segunda-feira às 17h.

### O que Maria faz (app do cliente)

1. **Abre a aplicação e escreve o que precisa** — "cano da cozinha a arrebentar", tira uma foto, marca onde é a casa.
2. **O sistema envia o pedido aos mestres de canalização que estão online e perto dela.**
3. **Um mestre recebe o aviso no telemóvel e tem 60 segundos para aceitar** (evita que os mestres ignorem os pedidos).
4. **No ecrã aparece o nome, a cara, a nota e as avaliações daquele mestre** — Maria sabe com quem está a lidar.
5. **Maria vê num mapa o mestre a caminho** — como o táxi no Uber. Sabe que chega em 15 minutos.
6. **O mestre chega, diagnostica e diz o preço.** Maria **confirma no telemóvel** — só nesse momento o dinheiro fica **retido pela plataforma** (não vai directo para o mestre, nem fica com Maria).
7. **O trabalho é feito.** Maria **confirma que está satisfeita** — aí o sistema paga ao mestre, descontando a comissão da plataforma.
8. **Maria dá 5 estrelas.** A nota entra no perfil do mestre e ajuda quem vier a seguir.

### O que o mestre faz (app do mestre)

1. **Entra online** ("estou a trabalhar") e escolhe as suas categorias (ex.: canalização, electricidade).
2. **Recebe pedidos de gente por perto** com contagem de 60 segundos para aceitar.
3. **Aceita, vai até à casa** (com o mapa a mostrar o caminho), **propõe o preço**.
4. **Recebe o pagamento automaticamente** no bolso da plataforma (carteira), no dia em que o cliente confirmar o serviço — e pode **transferir para o M-Pesa/e-Mola**.
5. **Cobra mais aos clientes pelos serviços:** pode assinar um plano mensal, aparecer no topo da pesquisa e receber mais pedidos.

### Se Maria não tiver pressa (2.º modo)

Em vez de chamar alguém de imediato, Maria pode **publicar o pedido e esperar orçamentos**: vários mestres enviam preço e prazo, Maria escolhe o que mais gostar e só depois marca o serviço. É o sistema clássico de "peça orçamento a 5 pessoas" — mas num só sítio.

---

## 4. O que o sistema faz por dentro (sem complicar)

| Se... | ...o sistema |
|---|---|
| Maria paga o serviço | **Retém o dinheiro** numa conta intermédia (escrow) até o trabalho estar concluído — protege Maria e protege o mestre |
| Alguém dá uma nota | **Só deixa avaliar quem teve mesmo um trabalho concluído** — não se inventam avaliações |
| Maria procura um mestre | **Ordena por perto, por nota e por quem destaque** (mestres com plano aparecem primeiro) |
| O mestre falha, cancela ou há disputa | **Fica registado** — a plataforma pode analisar e decidir quem tem razão |
| Alguém se regista como mestre | Pode ter de **enviar documento de identidade e um selfie** para verificação (KYC) — muda o "estou de confiança" para "está verificado" |
| Alguém denuncia um perfil | A equipa da plataforma **vê a denúncia, analisa e decide** — suspender ou manter |

Tudo isto está **construído na base de dados** — as regras do dinheiro e das avaliações vivem em "trancas" que o próprio sistema executa, para ninguém conseguir trapacear por engano ou por força.

---

## 5. Quem gere a plataforma

| Papel | O que faz |
|---|---|
| **Admin** (gestor do dia a dia) | Valida pagamentos manuais, aprova verificações de mestres, responde aos tickets de suporte, vê relatórios |
| **Superadmin / equipa** | Gere quem tem acesso ao painel, aprova mudanças sensíveis (dupla aprovação), vê o histórico de tudo o que se fez, tem código de segurança extra (MFA) |
| **Mestre** | O seu perfil, os seus serviços, a sua carteira, os seus planos e afiliados |
| **Cliente** | Pesquisa, pedidos, mensagens, avaliações — **tudo grátis** |

Há **um centro de ajuda com tickets** (como uma caixa de e-mail da plataforma) com prazos de resposta automáticos, mensagens prontas e nota de satisfação no fim.

---

## 6. De onde vem o dinheiro

> **O cliente nunca paga nada à plataforma.** A plataforma ganha dinheiro com os mestres e com a publicidade.

| Fonte | Em palavras |
|---|---|
| **Planos mensais** | O mestre paga por aparecer mais: Grátis / **Pro 500 MZN** / **Premium 1.500 MZN** |
| **Destaques** | O mestre paga para aparecer no topo da categoria e na página inicial |
| **Publicidade** | Banners de anunciantes no site |
| **Comissão por serviço** | No modo "chamar agora", a plataforma fica com **12% (grátis) / 8% (Pro) / 5% (Premium)** do valor pago |
| **Afiliados** | Quem convida outro mestre ganha **10% do que ele carregar, durante 90 dias** |

---

## 7. O que já está a funcionar

- **Site web completo:** pesquisa, perfis públicos de mestres, pedidos, trabalhos, avaliações, carteira, planos, centros de ajuda e painéis de administração.
- **App do cliente:** fluxo inteiro — pedir → procurar mestre → mestre a caminho → preço → confirmar → pagar.
- **App do mestre:** ficar online → receber pedido com 60 s → ir ao local → propor preço → receber pagamento.
- **Verificação de identidade (KYC)** na app do mestre: documento, selfie e confirmação de dados.
- **Dinheiro protegido (escrow)**, carteiras, comissões e afiliados — regras gravadas na base de dados.
- **Base de dados com toda a estrutura**: geografia do país, categorias de ofícios, tickets de suporte, auditoria e permissões da equipa.

## 8. O que ainda não está pronto

| Falta | Porque importa |
|---|---|
| **Ligar o chat e os orçamentos à base de dados** | Hoje estão "de demonstração" no site — a estrutura existe, falta ligar |
| **Um robô que envie pedidos aos mestres por perto** | O cálculo "quem está perto" já existe na BD; falta quem o dispare |
| **Ligação aos pagamentos M-Pesa / e-Mola** | O caminho está preparado; falta fechar contrato com o operador |
| **Fornecedor real de verificação (KYC)** | A app já tira a foto; falta o serviço que analisa documento e cara |
| **Testes automáticos** | Protege contra rebentamentos quando se muda código |
| **Arranjar 3 problemas urgentes** (ver secção 9) | Sem eles, o site tem a cara errada e o painel de administração está aberto a qualquer pessoa |

---

## 9. Os 3 problemas urgentes (para já)

1. **O painel de administração está sem porta.** Qualquer visitante consegue aceder às áreas internas — tem de se corrigir já.
2. **A aparência do site está partida.** Um ficheiro de estilos ficou cortado a meio — faltam as cores e os tamanhos.
3. **Duas páginas disputam a página inicial.** O endereço "/" tem dois donos — o site pode abrir de forma errada.

Depois vêm: ações que não pedem login, tabelas de dinheiro sem protecção extra, e a separação de duas tabelas de trabalhos duplicadas.

---

## 10. O que falta decidir (não é código, é negócio)

- **Quem faz a verificação de identidades** (fornecedor de KYC).
- **Se o piloto aceita dinheiro em mão** ou só pagamento pela aplicação.
- **A plataforma pode mesmo reter dinheiro de outros?** — em Moçambique pode ser preciso criar uma entidade legal e conta própria para isso.
- **Contratos**: M-Pesa / e-Mola, Google Play e App Store.
- **Comissões finais** e preços dos planos.

---

## 11. Plano para chegar ao piloto

| Quando | O que |
|---|---|
| **Semana 1–2** | Fechar as 3 portas urgentes (admin, estilos, página inicial) + login obrigatório em todas as ações |
| **Semana 3–4** | Ligar chat e orçamentos à base de dados, proteger as tabelas de dinheiro, primeiros testes automáticos |
| **Mês 2–3** | O robô de despacho (chamar mestres por perto), pagamentos M-Pesa, verificação de identidades |
| **Mês 4–6** | **Piloto numa cidade**: mestres verificados, apps nas lojas, planos e destaques activos |

**Medir sempre:** mestres verificados por cidade · tempo até alguém aceitar um pedido · trabalhos concluídos · notas médias.

---

## 12. Resumo para levar na cabeça

> **Um sítio onde quem precisa encontra quem sabe fazer — com a chegada do mestre visível no mapa, o preço acordado antes de começar, o dinheiro guardado até o trabalho estar feito, e avaliações que só quem trabalhou pode dar.**
>
> Quem paga é o mestre (plano, destaque ou comissão) e o anunciante — **nunca o cliente.**
>
> O esqueleto está construído: site, duas apps, base de dados e regras de dinheiro. **Falta fechar a porta do painel, ligar as peças que estão em demonstração e fechar os contratos de pagamento e verificação — para depois testar numa cidade.**

---

# Anexo — Detalhe técnico

<details>

## A.1 Arquitectura

```
buedemestres/ (monorepo Turborepo + pnpm)
├─ apps/web      → Next.js 16 — site público, cliente, mestre, admin, superadmin
├─ apps/cliente  → Expo 52 / React Native — app do cliente
├─ apps/pro      → Expo 52 / React Native — app do mestre
├─ packages/     → regras de negócio partilhadas + contratos de pagamento/KYC/mapas
└─ migrations/   → 12 scripts SQL (0001–0200) já aplicados
```

- **Base de dados:** PostgreSQL (Neon) + **PostGIS** (geolocalização) + `pg_cron` (tarefas agendadas).
- **Sem ORM:** SQL escrito à mão e tipado em TypeScript.
- **Dinheiro:** só em funções SQL transaccionais e idempotentes (`wallet_apply`, `complete_payment`, `hold_job_payment`, `release_job_payment`) — nunca no código da aplicação.
- **Tempo real:** Pusher (web) · Expo Notifications (mobile).
- **Mapas:** Leaflet + OpenStreetMap (web) · react-native-maps (mobile).
- **Auth:** web = JWT (jose) em cookie + bcryptjs · mobile = Supabase.
- **Deploy:** Vercel (site) · EAS Build (APKs).

## A.2 Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | Turborepo 2 · pnpm 9 · Node ≥ 20 |
| Web | Next.js 16.3 · React 19 · TypeScript 5 · Tailwind CSS v4 |
| Mobile | Expo SDK 52 · React Native 0.76 · Expo Router 4 · Zustand · TanStack Query · Zod |
| Formulários | react-hook-form + Zod |
| BD | PostgreSQL + PostGIS + pg_cron (≈60 tabelas, 21 enums) |

## A.3 Modelo de dados (grupos)

| Grupo | Tabelas |
|---|---|
| Geografia | `provinces`, `districts` (11 províncias) |
| Identidade | `profiles`, `user_passwords`, `provider_profiles`, `staff_profiles`, permissões |
| Catálogo | `categories` (9 ramos), `provider_services`, `provider_media` |
| Procura | `service_requests`, `request_media`, `quotes` |
| Execução | `jobs`, `request_offers`, `job_price_proposals`, `job_location_log` |
| Conversa | `conversations`, `messages`, `notifications` |
| Confiança | `reviews`, `favorites`, `reports` |
| Dinheiro | `wallets`, `wallet_transactions`, `payments`, `job_payments`, `payouts`, `platform_revenue` |
| Receita | `plans`, `subscriptions`, `boosts`, `banners`, `referrals`, `affiliate_commissions` |
| KYC | `verification_documents`, `verification_events`, `verification_checks` |
| Back-office | `tickets` + mensagens/macros, `approval_requests`, `audit_logs`, `system_settings` |
| On-demand | `provider_presence` (PostGIS), função `nearby_providers()` |

**Pesquisa:** índice de texto completo (`tsvector` GIN), correspondência aproximada de nomes (`gin_trgm_ops`) e filtros parciais só sobre perfis publicados.

## A.4 Máquina de estados do trabalho

```
requested → offered → accepted → en_route → arrived → price_proposed
  → price_agreed (pago/retido) → in_service → awaiting_confirmation
  → completed → paid_out
Cancelamentos: cancelled_by_client | cancelled_by_provider | expired | disputed
```

## A.5 Segurança

| Área | Estado |
|---|---|
| Cookie JWT assinado 7 dias + verificação em cache | ✅ |
| bcryptjs no registo/entrada | ✅ |
| Dinheiro em funções SQL idempotentes com `FOR UPDATE` | ✅ |
| MFA, 30 permissões, auditoria, dupla aprovação (staff) | ✅ |
| Guarda de rotas staff (`proxy.ts`) — prefixos não coincidem | 🔴 crítico |
| RLS — só em 5 tabelas de tickets | ⚠ parcial |
| Webhooks assinados, rate limiting, CAPTCHA | ❌ |
| KYC (OCR/selfie) | 🔧 stub |

## A.6 Integrações

| Serviço | Estado |
|---|---|
| Neon (PostgreSQL) · Supabase · PostGIS · Pusher · Leaflet/OSM · Vercel · EAS | ✅ activo |
| PaySuite / M-Pesa / e-Mola | ⚠ contrato pendente |
| Fornecedor de KYC | ⚠ decisão pendente |
| Firebase (push antigo) | ❌ código morto, migrado |

## A.7 Comandos

```bash
npm run dev | build | lint | typecheck | format   # raiz (Turbo)
npm run db:migrate                                  # apps/web
npx expo start                                      # apps/cliente e apps/pro
```

## A.8 Ficheiros de referência

`README.md` · `BUEDEMESTRES_PLANO_IMPLEMENTACAO.md` · `BUEDEMESTRES_ADENDA_ON_DEMAND.md` · `BUEDEMESTRES_TICKETS_SUPERADMIN.md` · `BUEDEMESTRES_FRONTEND_DESIGN.md` · `ESTADO_30SET2026.md` · `PENDENTES.md` · leitura directa de `apps/*`, `packages/*`, `migrations/0001–0200`.

</details>
