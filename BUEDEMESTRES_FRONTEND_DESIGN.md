# BUÉ DE MESTRES — Direcção de Design e Implementação do Frontend

> Documento para o agente de desenvolvimento e para quem revê o design.
> Complementa `BUEDEMESTRES_PLANO_IMPLEMENTACAO.md` (regras de negócio, esquema e fases).
> Idioma: português de Moçambique. Moeda: MT. Público: telemóveis Android de gama baixa/média, dados móveis limitados.

---

## 0. COMO USAR ESTE DOCUMENTO

1. Ler as secções 1 e 2 antes de escrever qualquer componente. Explicam **porquê** o visual é o que é.
2. Os tokens (secção 3) são a fonte de verdade. Nenhuma cor, tamanho de letra, raio ou sombra é escrito "à mão" num componente: tudo vem de tokens.
3. **Não entregar o aspecto por defeito do shadcn/ui, do Tailwind ou de qualquer template.** Os componentes base (Radix/shadcn) servem para acessibilidade e comportamento; o aspecto é sempre sobrescrito por este documento.
4. Antes de dar uma fase por terminada, executar a auto-crítica da secção 13 (capturas de ecrã a 360, 768 e 1280 px).
5. Se algo aqui contradiz o que "fica bem por norma", vence este documento.

---

## 1. DIRECÇÃO CRIATIVA

### 1.1 Conceito: "Placa de oficina"

Em qualquer bairro de Maputo, Matola ou Nampula, o mestre anuncia-se numa **placa pintada à mão**: letras grossas e estreitas sobre chapa ou parede, moldura interior, cores de esmalte (azul, amarelo, vermelho, branco). "Mecânico — Pneus e Rodas — Aqui". É a linguagem visual que toda a gente do país já lê e em que já confia.

O Bué de Mestres transporta essa placa para o digital. **Cada profissional passa a ter a sua placa.** O produto é uma rua de oficinas organizada e verificada.

- **Público:** pessoas comuns a resolver um problema (carro avariado, filho a precisar de explicações, porta partida) e profissionais informais a ganhar visibilidade.
- **Tarefa principal do design:** fazer um cliente encontrar e contactar um mestre fiável em menos de 3 toques; fazer um mestre sentir que tem uma "oficina" própria e respeitada.
- **Tom:** directo, caloroso, do bairro. Confiança antes de brilho.

### 1.2 O que é memorável (e só isso)

**O sistema de placas.** É o único elemento ousado do produto. Tudo à volta é calmo, legível e disciplinado. As placas aparecem:
- na página inicial (a "parede de placas" que substitui a grelha de ícones de categorias);
- no topo de cada perfil profissional (a placa do mestre);
- nos selos ("Verificado", "Em destaque") e nas etiquetas de estado.

Fora disto, o interface é sóbrio. Se uma ideia decorativa não serve as placas, corta-se.

### 1.3 Revisão do plano contra o genérico

O primeiro instinto para "marketplace moderno" é: fundo creme com serifa e terracota; ou preto com um verde ácido; ou grelhas de cartões arredondados iguais com sombra suave e gradientes. Foram **rejeitados**, porque servem qualquer produto e não dizem nada sobre Moçambique nem sobre ofícios.

| Instinto genérico | Substituído por |
|---|---|
| Fundo creme + terracota | Cal (branco-acinzentado de parede caiada) + cobalto de esmalte |
| Preto + acento néon | Tinta (índigo escuro) + amarelo de placa usado com significado |
| Grelha de cartões iguais com ícone | Parede de placas com tamanhos e cores variados |
| Avatar redondo pequeno | Fotografia do trabalho em formato rectangular, à frente |
| Ícones lineares genéricos | Pictogramas de ofício desenhados à medida (secção 5) |
| Sombras suaves em tudo | Bordas sólidas de 2 px em elementos-placa; sem sombras decorativas |
| Animação de entrada em cada secção | Um único momento de "pintar as placas" (secção 8) |

---

## 2. LISTA ANTI-GENÉRICO (obrigatória)

O agente **não** deve fazer, em nenhuma página:

1. Gradientes como decoração de fundo ou de botões.
2. Grelhas de cartões todos iguais, com o mesmo raio e a mesma sombra.
3. Uma etiqueta em MAIÚSCULAS espaçadas ("eyebrow") por cima de cada título. *(Excepção: o lettering das placas, que é conteúdo do sistema visual.)*
4. Destacar só uma palavra do título com cor ou itálico.
5. Numeração "01 / 02 / 03" em conteúdo que não é uma sequência real. *(Só no assistente de pedido e no onboarding, que são sequências.)*
6. Linhas de metadados com pontos médios ("Mecânico · Matola · 4,8") como padrão universal. Usar estrutura real (linhas, colunas, ícones com rótulo).
7. Seta "→" no fim de botões e ligações.
8. Emojis como ícones de interface.
9. Fotografias de banco de imagens com pessoas a sorrir. Fotografias de profissionais são sempre **reais**, enviadas por eles.
10. Fade-in e slide-up em cada secção ao fazer scroll; efeito de hover em todos os cartões.
11. Texto de exemplo ("Lorem ipsum", "Serviço 1"). Todos os ecrãs são construídos com conteúdo realista em português de Moçambique.
12. Preto puro ou quase-preto genérico como cor de texto. A cor de texto é **Tinta** (secção 3.1).
13. Fonte monoespaçada para "dar ar técnico".
14. Ilustrações vectoriais de pessoas em estilo "corporate flat".

---

## 3. TOKENS DE DESIGN

### 3.1 Cor

Paleta-base (6 cores nomeadas) + semânticas.

| Token | Nome | Hex | Uso |
|---|---|---|---|
| `--cobalto` | Cobalto de esmalte | `#2444C8` | Cor de marca; botões primários; ligações; placas azuis |
| `--amarelo` | Amarelo de placa | `#FFC61A` | **Só** para: selo Verificado, etiqueta "Em destaque", anel de foco, placas amarelas |
| `--oxido` | Vermelho óxido | `#BF3A21` | Erros, acções destrutivas, placas vermelhas, alertas |
| `--tinta` | Tinta | `#12163A` | Texto principal; bordas de placas |
| `--cal` | Cal | `#EDF0F2` | Fundo da aplicação |
| `--zinco` | Zinco | `#5B6472` | Texto secundário, ícones inactivos |

Auxiliares:

| Token | Hex | Uso |
|---|---|---|
| `--papel` | `#FFFFFF` | Superfície de placas, fichas, formulários |
| `--cobalto-100` | `#DCE3FA` | Fundos suaves de selecção |
| `--cobalto-700` | `#1A329A` | Estado premido/hover do primário |
| `--zinco-200` | `#D5DAE0` | Divisórias e bordas finas |
| `--verde` | `#1E7F4F` | Sucesso, "concluído" |
| `--oxido-100` | `#F7DDD7` | Fundo de mensagens de erro |

Regras:
- **Amarelo tem significado**: nunca usar como cor decorativa. Se aparece, quer dizer "verificado", "em destaque" ou "foco".
- Texto sobre cobalto: branco (7,5:1). Texto sobre amarelo: tinta. Texto sobre óxido: branco (5,4:1). Validar todos os pares novos com contraste ≥ 4,5:1 (3:1 para texto grande e componentes de interface).
- Fundo da app é sempre **Cal**; superfícies elevadas são **Papel**. Sem fundos em gradiente.
- Sem modo escuro no MVP. Os tokens devem ficar preparados (variáveis CSS), mas não é prioridade.

### 3.2 Tipografia

| Papel | Família | Notas |
|---|---|---|
| **Títulos e placas** | **Archivo** (variável, eixo de largura `wdth` 62–125) | Estreita e pesada (`wdth` 70–80, `wght` 800) nas placas; larga (`wdth` 105–115, `wght` 800) nos títulos de página. O contraste entre estreita e larga é a assinatura tipográfica. |
| **Texto e interface** | **Atkinson Hyperlegible Next** (fallback: Atkinson Hyperlegible) | Desenhada para máxima legibilidade em ecrãs pequenos e para leitores com dificuldades. Ideal para telemóveis baratos. |

Carregar com `next/font/google` (auto-hospedagem, `display: swap`, subset `latin`). Archivo: `axes: ['wdth']` sem `weight` fixo. Definir fallbacks: `system-ui, sans-serif`.

Escala (mobile-first, razão ≈ 1,25; usar `clamp` nos maiores):

| Token | Tamanho | Altura de linha | Uso |
|---|---|---|---|
| `text-xs` | 13 px | 1,4 | Notas legais, contadores |
| `text-sm` | 15 px | 1,5 | Texto secundário, rótulos de campo |
| `text-base` | 17 px | 1,55 | Texto corrente |
| `text-lg` | 21 px | 1,4 | Lead, subtítulos |
| `text-xl` | 26 px | 1,2 | Títulos de secção |
| `text-2xl` | 33 px | 1,1 | Títulos de página |
| `text-3xl` | `clamp(40px, 8vw, 64px)` | 1,02 | Título da página inicial |

Regras:
- **Frases em minúsculas** (sentence case) em todos os títulos, botões e rótulos. Maiúsculas só no lettering das placas.
- Comprimento de linha máximo: **68 caracteres** em texto corrido.
- Títulos com `letter-spacing: -0.01em`; texto corrente `0`.
- Números (preços, avaliações, saldo) usam `font-variant-numeric: tabular-nums`.
- Preço: `1 500 MT` (espaço como separador de milhares, sem casas decimais quando são zero). Criar `formatMT()` em `lib/utils/format-mzn.ts` e usá-lo em todo o lado. Datas: `dd/MM/yyyy`; hora em 24 h.

### 3.3 Espaçamento, raios, bordas, elevação

- Base de **4 px**. Espaçamentos comuns: 4, 8, 12, 16, 24, 32, 48, 72.
- **Raios diferentes por hierarquia** (não usar um raio único):

| Token | Valor | Onde |
|---|---|---|
| `--r-placa` | 4 px | Placas, tabela de preços, selos |
| `--r-foto` | 8 px | Fotografias |
| `--r-controlo` | 10 px | Botões, inputs, chips de filtro |
| `--r-folha` | 20 px (só cantos superiores) | Bottom sheets |
| `--r-pilula` | 999 px | Etiquetas de estado, contadores |

- **Bordas:** 2 px `--tinta` em placas e no input em foco; 1 px `--zinco-200` em divisórias.
- **Elevação:** sem sombras decorativas. Hierarquia por cor de superfície (Papel sobre Cal) e por bordas. Únicas sombras: o véu (scrim) `rgba(18,22,58,.5)` atrás de sheets/modais e a sombra da barra de navegação inferior ao fazer scroll (1 px).
- **Anel de foco:** 3 px `--amarelo` com 2 px de intervalo em `--tinta`. Visível em qualquer fundo. Nunca remover.

### 3.4 Implementação dos tokens (Tailwind v4, `src/app/globals.css`)

```css
@import "tailwindcss";

@theme {
  --color-cobalto: #2444C8;
  --color-cobalto-100: #DCE3FA;
  --color-cobalto-700: #1A329A;
  --color-amarelo: #FFC61A;
  --color-oxido: #BF3A21;
  --color-oxido-100: #F7DDD7;
  --color-tinta: #12163A;
  --color-cal: #EDF0F2;
  --color-papel: #FFFFFF;
  --color-zinco: #5B6472;
  --color-zinco-200: #D5DAE0;
  --color-verde: #1E7F4F;

  --font-display: var(--font-archivo), system-ui, sans-serif;
  --font-sans: var(--font-atkinson), system-ui, sans-serif;

  --radius-placa: 4px;
  --radius-foto: 8px;
  --radius-controlo: 10px;
  --radius-folha: 20px;
}

@layer base {
  html { background: var(--color-cal); color: var(--color-tinta); font-family: var(--font-sans); font-size: 17px; line-height: 1.55; }
  :focus-visible { outline: 3px solid var(--color-amarelo); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-tinta); }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
}
```

Utilitários: `.display-wide` (`font-family: var(--font-display); font-stretch: 110%; font-weight: 800; letter-spacing: -0.01em`) e `.display-sign` (`font-stretch: 72%; font-weight: 800; text-transform: uppercase; letter-spacing: .02em`).

---

## 4. ASSINATURA VISUAL

### 4.1 Placa de ofício — `<TradeSign />`

Rectângulo de esmalte com **moldura interior** (linha de 2 px a 6 px da borda), lettering `.display-sign`, raio 4 px.

- Variantes de cor: `cobalto` (texto branco), `amarelo` (texto tinta), `oxido` (texto branco), `papel` (texto tinta, moldura cobalto).
- Inclinação: cada placa tem uma rotação fixa entre −1° e +1° atribuída por `hash(trade)`, **estável entre renders**. Nunca aleatória a cada carregamento. Em listas de resultados, sem inclinação (legibilidade).
- Textura: leve granulado de tinta em ficheiro **SVG/PNG pré-renderizado** (≤ 3 KB), aplicado como `background-image` a 6–8 % de opacidade. Proibido usar `feTurbulence` ao vivo em muitas placas (custo de GPU em telemóveis fracos).
- Conteúdo: nome do ofício (ex.: `MECÂNICO`, `EXPLICADOR`, `CARPINTEIRO`) e, opcionalmente, segunda linha mais pequena com especialidade (`PNEUS E RODAS`).
- Tamanhos: `sm` (etiqueta em cartões), `md` (parede de placas), `lg` (topo do perfil).
- Como link: a placa inteira é o alvo de toque; estado premido inverte a moldura (moldura cheia).

**A placa do mestre** (topo do perfil): usa o `business_name` e o ofício principal. Cor atribuída pelo ofício (consistente, não escolhida pelo utilizador) para manter coerência visual da rua.

### 4.2 Parede de placas (página inicial)

Composição assimétrica de 8–12 placas de tamanhos e cores diferentes, como fachadas lado a lado. Cada uma leva à categoria. Não é uma grelha uniforme: larguras variam (1, 1,5 e 2 colunas), alturas por linhas de 56/72/96 px. Ver wireframe 6.1.

### 4.3 Selo "Verificado"

Carimbo circular: fundo `--amarelo`, borda 2 px `--tinta`, marca de visto desenhada à medida e um fio de padrão geométrico à volta (secção 4.6). Tamanhos 20/28/44 px. Acompanhado sempre de texto "Verificado" (não depende só do ícone). Toque abre uma folha: "Documento de identificação e fotografia conferidos pela equipa do Bué de Mestres em [data]."

### 4.4 Etiqueta "Em destaque"

Placa pequena amarela com texto tinta: "Em destaque". **Transparência obrigatória**: resultados pagos têm sempre esta etiqueta, nunca disfarçados de orgânicos.

### 4.5 Tabela de preços (serviços do mestre)

Estrutura de "tabela de oficina" com **linhas de pontos condutores** entre o serviço e o preço, como nos quadros de preços pintados:

```
Mudança de óleo e filtro ................ desde 1 500 MT
Diagnóstico electrónico ................. 800 MT
Reparação de travões ................... sob orçamento
```

Implementação: `display:flex` com um elemento central `flex:1; border-bottom: 2px dotted var(--zinco-200)`. Fundo Papel, borda 2 px tinta, raio 4 px. Preço em `tabular-nums`, "sob orçamento" em Zinco.

### 4.6 Padrão geométrico (uso restrito)

Inspirado na geometria das capulanas, **desenhado à medida** (linhas e formas simples, 2 cores). Aparece apenas em: (1) fio do selo Verificado, (2) ilustração dos estados vazios, (3) faixa fina de 8 px no rodapé. **Nunca** como fundo de secções nem como "padrão africano" decorativo geral. Evitar estereótipos: nada de máscaras, savana ou animais.

### 4.7 Talão de pagamento

No ecrã de confirmação de carregamento/compra, o resumo tem o formato de **talão** (largura estreita, linha tracejada de corte, valores alinhados à direita), porque o utilizador já reconhece o talão M-Pesa/banco como prova. Só neste ecrã.

---

## 5. ICONOGRAFIA E IMAGEM

**Ícones de interface:** Phosphor Icons (peso *bold*, traço 2 px, extremidades quadradas onde possível). Não usar Lucide por defeito. Um único conjunto em todo o produto.

**Pictogramas de ofício:** conjunto **desenhado à medida** de ~30 pictogramas (chave inglesa, serrote, plaina, livro, tesoura, mangueira, capacete, pincel, roda dentada, tomada, etc.), mesmo traço (3 px), grelha de 48 px, cantos quadrados. Servem na pesquisa por voz/toque e em filtros. Gerar com a ferramenta de imagem/vector do projecto e normalizar em SVG optimizado (SVGO).

**Fotografia:**
- Perfil: **primeira imagem = trabalho**, não retrato. Fotografia de retrato é secundária.
- Guia de fotografia para o mestre (no onboarding): "Mostra o teu trabalho de perto, com boa luz. Uma foto do antes e outra do depois."
- Formato: 4:3 na ficha, 1:1 na galeria; compressão no cliente para WebP ≤ 1 MB; `blurhash`/cor dominante como placeholder.
- Sem fotografia? A ficha mostra a placa do mestre em tamanho grande em vez de um avatar cinzento.

**Referência real:** antes de fechar o lettering e as cores das placas, recolher **30 fotografias de placas reais** (Maputo, Matola, Beira, Nampula) para `docs/referencias/`. Usar para calibrar largura das letras, molduras e combinações de cor. Não copiar marcas de terceiros.

---

## 6. LAYOUT E NAVEGAÇÃO

### 6.1 Princípios

- **Mobile-first a 360 px.** Desktop expande, não inventa outra app.
- Alinhamento **à esquerda** em texto e títulos (nada de blocos centrados extensos). Centrar só elementos isolados (estados vazios).
- Colunas: 4 no móvel, 8 em tablet, 12 em desktop. Largura máxima de conteúdo 1200 px; texto corrido máx. 68ch.
- **Navegação móvel:** barra inferior fixa (altura 60 px, alvos ≥ 48 px) com rótulos de texto sempre visíveis.
  - Cliente: `Início · Procurar · Pedidos · Mensagens · Conta`
  - Mestre: `Painel · Pedidos · Mensagens · Carteira · Perfil`
- **Desktop:** cabeçalho simples com logótipo-placa, pesquisa compacta e conta; menu lateral fixo no painel do mestre e no admin.
- **Localização por bairro:** o cliente escolhe o bairro/cidade uma vez ("Estou em: Polana, Maputo"), guardado localmente, editável a partir do cabeçalho. Geolocalização é opcional, nunca obrigatória.

### 6.2 Página inicial

```
┌────────────────────────────────────┐
│ [BUÉ DE MESTRES]        Entrar     │
│                                    │
│ Precisas de um mestre?             │
│ Bué deles, no teu bairro.          │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Preciso de                     │ │
│ │ [ mecânico, explicador…      ] │ │
│ │ Onde                           │ │
│ │ [ Polana, Maputo             ] │ │
│ │ [     Procurar mestres       ] │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌MECÂNICO────┐ ┌EXPLICADOR─┐       │
│ │ Pneus…     │ │           │       │
│ └────────────┘ └───────────┘       │
│ ┌CARPINTEIRO────────┐ ┌PEDREIRO─┐  │
│ └───────────────────┘ └─────────┘  │
│ ┌ELECTRICISTA┐ ┌CANALIZADOR────┐   │
│ └────────────┘ └───────────────┘   │
│           Ver todos os ofícios     │
│                                    │
│ Mestres verificados perto de ti    │
│ [ficha][ficha][ficha]  (scroll →)  │
│                                    │
│ Como funciona (3 passos reais)     │
│ Tens um ofício? Cria a tua placa.  │
│ Rodapé + faixa geométrica 8 px     │
├────────────────────────────────────┤
│ Início Procurar Pedidos Msgs Conta │
└────────────────────────────────────┘
```

- O **título** é uma frase inteira em `.display-wide`, sem palavra destacada.
- O painel de pesquisa é uma **placa branca** com moldura tinta (não um cartão flutuante com sombra).
- "Como funciona": só 3 passos porque é uma **sequência real** (Descreve o que precisas → Recebe orçamentos → Escolhe e avalia). Aqui a numeração é permitida.
- A faixa "Tens um ofício?" é a segunda placa grande, em amarelo, com botão "Criar a minha placa".

### 6.3 Resultados de pesquisa

```
Mobile:                       Desktop:
┌──────────────────────┐      ┌────────┬────────────────────────┐
│ [mecânico] [Polana ▾]│      │Filtros │ 42 mestres em Polana   │
│ [Verificados][4★+][…]│      │ Ofício │ ┌ficha──────────────┐  │
│ 42 mestres           │      │ Zona   │ │foto  Nome         │  │
│ ┌ficha────────────┐  │      │ Nota   │ │      placa  preço │  │
│ │[foto]  Nome     │  │      │ Só     │ └───────────────────┘  │
│ │ placa  ★4,8 (31)│  │      │ verif. │ ┌ficha──────────────┐  │
│ │ Polana · 3 km   │  │      │        │ └───────────────────┘  │
│ │[WhatsApp][Pedir]│  │      └────────┴────────────────────────┘
│ └─────────────────┘  │
```

- **Ficha do mestre** (`ProviderCard`): fotografia de trabalho 4:3 à esquerda (≈ 40 % da largura), à direita: nome (Archivo largo, 21 px), placa `sm` do ofício, avaliação **como número grande** + contagem, bairro e distância, preço "desde X MT", selo Verificado, etiqueta Em destaque (se aplicável). Botões: `Falar no WhatsApp` (secundário, ícone verde) e `Pedir orçamento` (primário).
- As fichas **não são todas iguais** por estrutura visual só quando o conteúdo o justifica: ficha em destaque tem faixa amarela fina no topo; ficha sem fotografia usa a placa grande. Mas o esqueleto é o mesmo (consistência).
- Filtros no móvel: chips na horizontal + botão "Filtros" que abre uma folha inferior. No desktop: coluna lateral fixa.
- Ordenação visível: "Mais relevantes · Melhor avaliados · Mais perto" como controlo segmentado.

### 6.4 Perfil do mestre

```
┌────────────────────────────────────┐
│ [galeria de trabalhos, scroll-snap]│
│ ┌MECÂNICO────────────────────────┐ │  ← placa lg
│ │  Oficina Mabunda               │ │
│ └────────────────────────────────┘ │
│ (selo) Verificado   Polana, Maputo │
│ 4,8  ★★★★★   31 avaliações         │
│ 126 trabalhos concluídos           │
│                                    │
│ [Pedir orçamento]  [WhatsApp]      │  ← barra fixa em baixo
│                                    │
│ Sobre o mestre (texto ≤ 68ch)      │
│ Tabela de preços (secção 4.5)      │
│ Trabalhos (galeria 1:1)            │
│ Avaliações                         │
│ Zona de atendimento (mapa opcional)│
└────────────────────────────────────┘
```

- **Avaliações:** cada uma mostra o tipo de trabalho e o mês ("Mudança de óleo, Setembro de 2026") e a nota "Trabalho concluído pelo Bué de Mestres" (prova de que é real). Distribuição de notas em barras simples. Resposta do mestre por baixo, recuada.
- **Barra de acção fixa** em baixo (acima da navegação): sempre visível.
- Contacto directo (telefone/WhatsApp) só após login (regra de negócio §5.13). Visitante vê botão "Entrar para contactar".
- Estatísticas como "responde em X horas" só aparecem se forem **medidas** pelo sistema. Nunca inventadas.

### 6.5 Assistente de pedido (sequência real: numeração permitida)

Quatro passos, um por ecrã, barra de progresso simples ("Passo 2 de 4"):
1. **Qual é o problema?** Categoria (pictogramas) + título curto.
2. **Mostra-nos.** Câmara primeiro: "Tira uma foto ou escolhe da galeria" (até 5). Campo de descrição abaixo, opcional para quem prefere fotografar.
3. **Onde e quando?** Bairro (pré-preenchido), data preferida (hoje, amanhã, esta semana, escolher).
4. **Orçamento e revisão.** Intervalo de preço opcional, resumo, botão `Publicar pedido`.

Guardar rascunho automático localmente; retomar se a ligação falhar. O botão final mantém o mesmo verbo em toda a cadeia: "Publicar pedido" → confirmação "Pedido publicado".

### 6.6 Orçamentos recebidos

Lista de propostas ordenadas por preço/avaliação. Cada proposta mostra placa `sm`, valor grande (`tabular-nums`), prazo, mensagem curta, selo. Acção: `Aceitar orçamento`. Ao aceitar, aparece um **carimbo** "ACEITE" que "bate" na proposta (secção 8), resposta a uma acção do utilizador.

### 6.7 Painel do mestre

- **Topo:** saldo da carteira e estado do plano (texto simples, não painel de KPIs decorativo).
- **Bloco principal:** "Pedidos novos na tua zona" (lista acionável).
- **Lista de verificação de perfil** enquanto incompleto ("Falta: 1 fotografia de trabalho, 1 serviço com preço"), com barra de progresso. Desaparece quando completo.
- **Carteira:** saldo, `Carregar saldo`, extracto em linhas (data, descrição, valor, saldo). Comprar plano e destaque em folhas inferiores com resumo do que se paga e o que se obtém.

### 6.8 Admin

Mesmos tokens, **sem placas decorativas**. Interface densa e funcional: tabelas (TanStack Table), filtros, painéis divididos. Fila de verificação em duas colunas (documento à esquerda, dados e decisão à direita) com atalhos de teclado (A aprovar, R rejeitar). Estados com etiquetas de cor semântica.

---

## 7. COMPONENTES (especificação mínima)

| Componente | Especificação |
|---|---|
| **Botão primário** | Cobalto, texto branco, altura 48 px, raio 10, peso 700. Premido: `--cobalto-700`. Desactivado: Zinco-200 + texto Zinco. Sem gradiente, sem sombra. |
| **Botão secundário** | Papel, borda 2 px tinta, texto tinta. |
| **Botão destrutivo** | Óxido, texto branco; exige confirmação em folha. |
| **Input** | Altura 52 px, Papel, borda 1 px Zinco-200; em foco borda 2 px tinta + anel amarelo. Rótulo **sempre visível acima** (não só placeholder). Erro: borda óxido + mensagem por baixo com ícone. |
| **Campo de telefone** | Prefixo fixo `+258`, teclado numérico, máscara `8X XXX XXXX`. |
| **Chip de filtro** | Pílula, altura 40 px, Papel + borda 1 px; activo: cobalto-100 + borda cobalto. |
| **Folha inferior (sheet)** | Raio superior 20, pega de arrasto, véu tinta 50 %, fecha com gesto/Esc. Biblioteca `vaul`. |
| **Toast** | Topo do ecrã, Papel + borda 2 px tinta, ícone de estado. Mensagem usa o mesmo verbo da acção. Biblioteca `sonner` totalmente restilizada. |
| **Estado vazio** | Ilustração geométrica pequena (secção 4.6) + frase que diz o que fazer + botão. |
| **Skeletons** | Blocos em Zinco-200 com a forma real do conteúdo (fotografia 4:3, linhas de texto). Sem *shimmer* pesado; um pulso de opacidade lento. |
| **Estrelas** | Número grande primeiro, estrelas como apoio (cobalto, não amarelo). Amarelo é reservado. |
| **Chat** | Balões: enviada = cobalto/branco, recebida = Papel/tinta. Hora discreta; estado (enviada/lida) com ícone e texto acessível. Anexos em miniatura. Campo fixo em baixo, sobe com o teclado. |
| **Etiquetas de estado** | Pílula com ponto + texto: Aberto (cobalto), Em curso (tinta), Concluído (verde), Cancelado (zinco), Disputa (óxido). Nunca só cor. |
| **Tabelas (admin)** | Cabeçalho fixo, linhas 44 px, ordenação e filtros; colunas redimensionáveis apenas em desktop. |

**Shadcn/Radix:** usar como base de comportamento (Dialog, Popover, Tabs, Select, Accordion). Sobrescrever raio, cores, tipografia e foco com os tokens acima; remover o aspecto zinc/neutral padrão. Todos os componentes vivem em `src/components/ui/` já com o aspecto do Bué de Mestres.

---

## 8. MOVIMENTO

Regra: **um momento coreografado** + movimento que responde a acções. Nada mais.

1. **Momento único — "pintar as placas"** (só na primeira visita da sessão à página inicial): as placas da parede aparecem com o lettering a ser revelado da esquerda para a direita (`clip-path: inset(0 100% 0 0)` → `inset(0)`), 450 ms cada, desfasadas 60 ms, `cubic-bezier(.2,.7,.2,1)`. Total < 1 s. Guardar flag em `sessionStorage` para não repetir. Só CSS.
2. **Resposta a acções** (permitido e desejado):
   - Favoritar: coração preenche com pequeno *pop* (150 ms).
   - Aceitar orçamento: carimbo "ACEITE" bate (escala 1,4 → 1, rotação −6°, 180 ms).
   - Abrir/fechar folhas, acordeões, mudança de separador: 200–250 ms.
   - Botão premido: escurece; sem transformações escala exageradas.
3. Nada de animações de entrada por scroll, *parallax*, cursores personalizados nem *hover lifts* em cartões.
4. `prefers-reduced-motion`: todas as animações desactivadas, mantendo apenas mudanças de estado instantâneas.
5. Sem bibliotecas de animação no bundle público (usar CSS). Framer Motion só se um caso concreto o exigir e apenas em rotas do painel.

---

## 9. ESCRITA E MICROCOPY

Princípios: escrever do ponto de vista do utilizador, verbos claros, frases curtas, português de Moçambique (telemóvel, ecrã, bairro, carregar saldo), sem clichés de marketing. O "Bué" aparece pontualmente (título da home, estados vazios) e não em tudo.

| Contexto | Texto |
|---|---|
| Título da home | "Precisas de um mestre? Bué deles, no teu bairro." |
| Campo pesquisa 1 | Rótulo "Preciso de" · placeholder "mecânico, explicador de Matemática…" |
| Campo pesquisa 2 | Rótulo "Onde" · placeholder "Bairro ou cidade" |
| Botão pesquisa | "Procurar mestres" |
| Ficha, acções | "Falar no WhatsApp" · "Pedir orçamento" |
| Visitante sem sessão | "Entra para contactar este mestre" |
| Publicar pedido | Botão "Publicar pedido" → toast "Pedido publicado" |
| Estado vazio (orçamentos) | "Ainda não há orçamentos. Assim que um mestre responder, aparece aqui." |
| Estado vazio (mestre sem pedidos) | "Sem pedidos novos na tua zona. Completa o teu perfil para apareceres mais." |
| Erro de rede | "Não foi possível enviar. Verifica a ligação e toca em Tentar de novo." |
| Erro de campo | "O número de telemóvel deve ter 9 dígitos e começar por 8." |
| Saldo insuficiente | "Saldo insuficiente: faltam 300 MT. Carrega a tua carteira para continuar." |
| Pagamento pendente | "Recebemos o teu comprovativo. Vamos confirmar em até 48 horas." |
| Selo | "Verificado: documento de identificação e fotografia conferidos." |
| CTA do mestre | "Criar a minha placa" |

Regras: um verbo por acção, mantido em toda a cadeia (Publicar → Publicado). Erros dizem o que aconteceu e como resolver, sem pedir desculpa vaga. Os botões nunca dizem "Submeter" nem "Clique aqui".

---

## 10. ACESSIBILIDADE E DESEMPENHO

**Acessibilidade (piso mínimo):**
- Contraste AA em todo o texto; alvos de toque ≥ 48 px; foco visível sempre (anel amarelo + tinta).
- Nunca comunicar estado só por cor (texto ou ícone com rótulo).
- Formulários com rótulos ligados, erros anunciados (`aria-live`), ordem de tabulação lógica.
- Imagens com `alt` descritivo (o mestre preenche legenda na galeria).
- Texto ajustável até 200 % sem quebrar layout.
- Testar com leitor de ecrã (TalkBack) nos fluxos: pesquisa, pedido, chat.

**Desempenho (telemóveis fracos, dados móveis):**
- Orçamento: LCP < 2,5 s em 4G; JS inicial da home ≤ 150 KB gzip; imagens da home ≤ 300 KB no total acima da dobra.
- `next/image` com `sizes`, WebP/AVIF, `loading="lazy"` abaixo da dobra; miniaturas na lista, originais só no detalhe.
- Fontes: 2 famílias, subset latin, `display: swap`, pré-carregar só Archivo (títulos).
- Componentes de servidor por defeito; cliente só onde há interacção.
- Listas paginadas/infinite com *skeleton*; pesquisa com *debounce* de 300 ms.
- Modo "poupar dados" (respeitar `Save-Data`): desactivar autoplay, reduzir qualidade de imagens, esconder mapas.
- PWA: *cache* da casca, páginas vistas offline em modo leitura, fila de envio de mensagens/pedidos quando sem ligação.
- Orçamentos de peso: sem vídeos de fundo, sem bibliotecas de ícones completas (importar só os usados), sem *carousels* JS (usar `scroll-snap` CSS).

---

## 11. IMPLEMENTAÇÃO TÉCNICA

- **Stack:** Next.js (App Router), Tailwind v4 com `@theme` (secção 3.4), Radix/shadcn como base restilizada, Phosphor Icons, `vaul` (sheets), `sonner` (toasts), `react-hook-form` + `zod`, `next/font`, `@tanstack/react-table` (admin).
- **Design system dentro do projecto:**
  ```
  src/
  ├─ components/
  │  ├─ ui/            # botão, input, chip, sheet, toast (já com o aspecto do produto)
  │  ├─ brand/         # TradeSign, VerifiedSeal, FeaturedTag, PriceBoard, ReceiptSlip
  │  ├─ providers/     # ProviderCard, ProviderHeader, ReviewItem, RatingSummary
  │  ├─ requests/      # RequestWizard, QuoteCard, StatusPill
  │  ├─ chat/          # Thread, Bubble, Composer
  │  ├─ wallet/        # BalanceBlock, LedgerRow, PlanPicker, BoostSheet
  │  └─ layout/        # BottomNav, Header, PageShell, EmptyState
  ├─ lib/design/       # tokens.ts (cores para gráficos), trade-colors.ts, tilt.ts
  └─ app/dev/design/   # página interna com todos os componentes e estados (substitui Storybook)
  ```
- **Mapa ofício → cor de placa** em `trade-colors.ts` (ex.: Automóvel = cobalto; Educação = amarelo; Construção = óxido; Beleza = papel/cobalto…). Consistente e determinístico.
- **`tilt.ts`:** rotação estável por `hash(slug)` entre −1° e +1°; desligada em listas.
- **Ícones de ofício:** SVG em `public/icons/trades/` + componente `TradeIcon`.
- **Estados obrigatórios** em cada componente de dados: carregando (skeleton), vazio, erro, sucesso, desactivado.
- **Formulários:** validação com zod no cliente e no servidor; mensagens em português de Moçambique centralizadas em `lib/validators/messages.ts`.
- **Página `/dev/design`** (só em `dev`/`staging`): mostra tokens, escala tipográfica, placas em todas as cores/tamanhos, botões, inputs, sheets, estados vazios e cartões de ficha em todos os casos (com/sem foto, verificado, destaque, esgotado). É o ponto de revisão visual antes de cada fase.

---

## 12. PLANO DE IMPLEMENTAÇÃO DO FRONTEND (alinhado às fases do plano principal)

| Fase | Entregas de frontend | Critério de aceitação |
|---|---|---|
| **0** | Tokens, fontes, `globals.css`, componentes `ui/` base restilizados, `TradeSign`, `PageShell`, `BottomNav`, página `/dev/design` | Página `/dev/design` revista a 360/768/1280 px; nenhum valor de cor/raio fora dos tokens (lint com regra de Tailwind) |
| **1** | Entrar/Registar/Recuperar, perfil, onboarding do mestre (com guia de fotografia), envio de verificação, fila admin | Formulários com estados de erro claros; fluxo completo utilizável só com polegar em 360 px |
| **2** | Home com parede de placas e momento "pintar", pesquisa, resultados, filtros em folha, `ProviderCard`, perfil público com tabela de preços | Home sem qualquer item da lista anti-genérico; LCP e peso cumprem orçamento |
| **3** | Assistente de pedido (4 passos), lista de pedidos, orçamentos, chat em tempo real | Rascunho de pedido sobrevive a perda de ligação; carimbo "ACEITE" |
| **4** | Trabalhos, avaliações (com tipo de trabalho e mês), denúncias | Avaliação só após trabalho concluído (UI reflecte a regra) |
| **5** | Carteira, extracto, carregar saldo (comprovativo), planos, destaques, talão de pagamento | Todos os valores em `formatMT()`; folhas de compra mostram custo e benefício antes de confirmar |
| **6** | Afiliados (código, partilha por WhatsApp, comissões), banners | Botão "Partilhar" abre o menu nativo do telemóvel |
| **7** | Admin completo (tabelas, atalhos, relatórios) | Fila de verificação processa um mestre em < 30 s com teclado |
| **8** | PWA, modo poupar dados, notificações | Instalável; funciona em modo leitura sem ligação |
| **9** | Passagem final de acessibilidade, desempenho e polimento visual | Auditoria TalkBack e Lighthouse ≥ 90 em móvel |

---

## 13. AUTO-CRÍTICA E APROVAÇÃO (antes de cada entrega)

**Capturas:** gerar capturas de todos os ecrãs novos a 360, 768 e 1280 px e olhar para elas.

**Perguntas de revisão (responder por escrito em `docs/DESIGN_REVIEW.md`):**
1. Se tirasse o logótipo, ainda se perceberia que é o Bué de Mestres? (As placas e a tabela de preços têm de o garantir.)
2. Há algum elemento da lista da secção 2 presente? Se sim, remover.
3. A ficha, o perfil e o pedido seriam compreendidos por alguém que lê devagar e usa um telemóvel barato ao sol?
4. O amarelo aparece só onde significa algo (Verificado, Em destaque, foco)?
5. Cada texto diz claramente o que acontece a seguir? Há verbos inconsistentes na mesma cadeia?
6. Onde está a **única coisa ousada** deste ecrã? Tudo o resto está calmo?
7. Retirar um elemento decorativo: o ecrã melhora?

**Bloqueadores (não aprovar se):**
- valores de cor, raio ou fonte fora dos tokens;
- contraste abaixo de AA ou alvos de toque < 44 px;
- resultado pago sem etiqueta "Em destaque";
- estatística mostrada que o sistema não mede;
- ecrã sem estados vazio/erro/carregamento;
- animação que ignora `prefers-reduced-motion`;
- peso da página inicial acima do orçamento.

---

## 14. GLOSSÁRIO DE ELEMENTOS DA MARCA

- **Mestre:** o profissional (qualquer ofício, incluindo explicadores). Usar sempre "mestre" na interface; "prestador" só em documentos legais.
- **Placa:** identidade visual do mestre ou do ofício (componente `TradeSign`).
- **Parede de placas:** composição da home.
- **Tabela de preços:** lista de serviços com pontos condutores.
- **Selo:** carimbo amarelo de verificação.
- **Talão:** resumo de pagamento em formato de recibo.
