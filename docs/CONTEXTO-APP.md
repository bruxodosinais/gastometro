# TôOrganizado — Contexto completo do produto e da engenharia

> Documento de contexto para IAs e novos colaboradores. Descreve **o que o app é**, **como ele funciona por dentro**, **o que separa o Free do Pro** e **como trabalhar no código**.
> Snapshot: **25/08/2026**. Repositório local: `/Users/anderson/gastometro` (nome antigo do produto). Produto público: **TôOrganizado** — `toorganizado.com.br`. Bundle ID das lojas: `br.com.toorganizado`.

---

## 1. O que é o app

**TôOrganizado é um app de organização financeira pessoal (pt-BR) que transforma "guardar dinheiro" em hábito**, usando mecânicas de jogo (streaks, níveis, badges, desafios) em cima de um controle de gastos completo.

- **Público:** brasileiro comum que quer parar de se perder com o próprio dinheiro — não investidor, não contador.
- **Promessa da landing:** *"Seu dinheiro organizado, direto do seu bolso"* / *"Finanças que viram hábito"*.
- **Plataformas:** app nativo iOS (App Store, no ar) e Android (Play Console, teste interno) via **Capacitor**, + web app (PWA) na Vercel. O mesmo código roda nos três.
- **Modelo:** grátis pra baixar, **Pro por assinatura dentro do app** (IAP mensal/anual). Não existe checkout web.

### 1.1 O norte estratégico (importante para qualquer decisão de produto)

Existem duas camadas, e elas **não** têm o mesmo peso:

| Camada | O que é | Papel |
|---|---|---|
| **Missão de Poupança** | Meta de dinheiro guardado, com aportes, marcos, badges, desafios de IA e coach | **O DIFERENCIAL.** É o destino. |
| **Hábito** (streak 🔥, freeze 🧊, níveis, milestones) | Mecânicas que trazem a pessoa de volta todo dia | **O MOTOR.** Não é diferencial — qualquer app copia ofensiva/pontinho. |

Regra prática: **tudo deve servir à Missão**, não rodar em paralelo a ela. Recompensar *registrar gasto* é motor; recompensar *guardar dinheiro* é produto.

**Decisão travada (15/06/2026): a economia de moedas 🪙 foi APOSENTADA.** Foi removida do app inteiro (badge, toasts, loja, compra de freeze). Motivo: era farmável (auto-declaração de aportes), não tinha ralo bom e recompensava a ação errada. Princípio: *"tira a CURRENCY, mantém as ACHIEVEMENTS"*. As tabelas (`user_coins`, `coin_transactions`) e RPCs continuam **dormindo no banco** — algumas RPCs ainda escrevem no ledger que ninguém lê. **Não reintroduzir moeda sem decisão explícita.**

### 1.2 Restrições de marca (obrigatórias)

- **NUNCA** comparar o app a outro produto em copy, criativos ou material externo. Especificamente: **não usar "Duolingo do dinheiro"** em nada voltado ao público (internamente a analogia é usada como atalho de conversa, mas não vaza pra fora).
- Verde é reservado a **dinheiro/economia e confirmação**. Botão de ação primária **nunca é verde** — é o índigo `#5B5BD6`.

---

## 2. Stack e arquitetura

```
Next.js 16 (App Router, --webpack) + React 19 + TypeScript + Tailwind v4
        │
        ├─ Web/PWA  → Vercel (toorganizado.com.br)  ← também é o BACKEND de tudo
        ├─ iOS      → Capacitor 8 → WKWebView (App Store)
        └─ Android  → Capacitor 8 → WebView (Play Console)

Dados/Auth: Supabase (Postgres + RLS + Auth por e-mail/OTP)
IA:         Anthropic SDK (Claude Sonnet 4.6 + Haiku 4.5)
E-mail:     Resend (noreply@toorganizado.com.br)
Pagamento:  RevenueCat → StoreKit (iOS) / Play Billing (Android)
Push:       FCM/APNs no nativo (firebase-admin) + Web Push VAPID na web
Gráficos:   Recharts · Ícones: lucide-react · PDF: jsPDF · SW: Serwist
```

> ⚠️ **Esta versão do Next.js tem breaking changes em relação ao que a maioria dos modelos conhece.** Antes de escrever código, ler o guia relevante em `node_modules/next/dist/docs/`. Exemplo concreto já em produção: **`middleware.ts` virou `proxy.ts`**.

### 2.1 Estrutura de pastas

```
app/
  page.tsx              landing pública (web) / boot do first-run (nativo)
  (app)/                ROTAS AUTENTICADAS (todas as telas do produto)
    app/                Home
    lancamentos/  historico/  recorrentes/  categorias/  orcamentos/
    analise/  previsoes/  metas/  cartoes/  patrimonio/
    missao/{page,nova,dashboard,badges,compartilhar}/
    assistente/  perfil/  upgrade/
    _components/{home,missao,cartoes,recorrentes,orcamento}/
  auth/                 login, cadastro, callback, confirmar-codigo/email, recuperar/nova senha
  onboarding/           onboarding financeiro pós-cadastro (5 passos)
  inicio/               first-run NATIVO: intro → quiz → building → plano → paywall
  comecar/              funil de ativação PÚBLICO (missão antes do cadastro)
  admin/                painel administrativo (protegido por tabela `admins`)
  api/                  ~35 rotas: assistente, missão, push, reports, crons, webhooks, admin
  sw.ts  manifest.ts  offline/  instalar/  privacidade/  termos/  suporte/  excluir-conta/
lib/
  storage/              acesso ao Supabase por domínio (expenses, cards, goals, missions…)
  gamification/         challenges, freezes, milestones, goalMilestones
  insights/  mission/  notifications/  onboarding/  supabase/  hooks/  utils/
  calculations.ts  monthlyBudget.ts  budgetAlerts.ts  forecast.ts  emergencyFund.ts
  planLimits.ts  dataCache.ts  revenuecat.ts  native.ts  reports.ts  badges.ts  push.ts  fcm.ts
components/             UI compartilhada (Navigation, Sidebar, modais, toasts…)
hooks/                  useSubscription, usePushNotifications, useCustomCategories…
migrations/ supabase/migrations/   SQL aplicado À MÃO no dashboard (não há CLI)
ios/  android/  scripts/build-native.sh  capacitor.config.ts
```

### 2.2 `proxy.ts` — o gate de todas as requisições

Substitui o `middleware.ts` clássico. Responsabilidades, na ordem:

1. **Webhooks e crons passam direto** (autenticam-se sozinhos por token).
2. **CORS para o app nativo:** a allowlist `NATIVE_API` marca as rotas `/api` chamadas pelo webview por `Authorization: Bearer` (não por cookie). Para elas o proxy responde ao preflight `OPTIONS`, **não redireciona** pra `/auth/login` e ecoa headers de CORS.
3. **Redirect legado** `/cartoes/<id>` → `/cartoes/detalhe?id=<id>` (308).
4. **Gate de sessão:** sem usuário e fora de rota pública → `/auth/login`.
5. **Gate de onboarding:** logado com `user_metadata.onboarding_completed !== true` → força `/onboarding`.
6. **Gate de admin:** `/admin` consulta a tabela `admins` com o client de service role.

Rotas públicas: `/`, `/comecar`, `/inicio`, `/termos`, `/privacidade`, `/excluir-conta`, `/suporte`, `/instalar`, `/offline`.

> **Gotcha caro já pago:** `sw.js` está isento no `matcher` e `/offline` está em `isPublicPage` porque o service worker os busca **sem sessão**; atrás do gate davam 307 e o PWA nunca instalava (o botão de push travava pra sempre em "Ativando…").

### 2.3 Build nativo vs build web

`next.config.ts` bifurca por `BUILD_TARGET=native`:

| | Web (Vercel) | Nativo (Capacitor) |
|---|---|---|
| `output` | server | `export` estático → `out/` |
| `/api` | no bundle | **fora** (o app chama a Vercel via `apiUrl()`) |
| redirects/proxy | ativos | não existem |
| Service Worker | Serwist ativo | desabilitado |
| Analytics GTM | ativo | **desligado** |

`lib/native.ts` é a ponte: `isNativePlatform()` lê o global `window.Capacitor` (sem depender do pacote), e `apiUrl(path)` prefixa `NEXT_PUBLIC_API_BASE` só no nativo.
Build: `npm run build:native` → `npx cap sync` (ou `npm run cap:sync`).

### 2.4 Cache de dados (`lib/dataCache.ts`)

Sidebar, Topbar, Navigation e a Home montam juntos e pediam os mesmos dados 3–4× (46+ queries por sessão). O cache resolve com três mecanismos:

- **TTL:** `LIST` 60s, `USER` 5min, `SUBSCRIPTION` 60s.
- **Dedupe em voo:** N chamadas concorrentes idênticas colapsam em 1 round-trip.
- **Invalidação explícita:** **toda escrita derruba a chave afetada** (`invalidate()` / `withCacheInvalidation`). Essa convenção é obrigatória — esquecer dela é a origem de "salvei e não atualizou".

---

## 3. Modelo de dados (Supabase)

Todas as tabelas têm RLS por `auth.uid()`. Migrations são aplicadas **manualmente** no SQL Editor do dashboard.

### Núcleo financeiro
| Tabela | Papel |
|---|---|
| `profiles` | perfil do usuário. **A PK é `id` e ela É o id do usuário — NÃO existe coluna `user_id`.** Guarda avatar, `financial_start_day`, preferências de push/e-mail, `roundup_enabled`/`roundup_multiple`, `streak_freezes`, `terms_accepted_at`, `whatsapp_phone`. |
| `expenses` | lançamentos (gastos **e** receitas). `type`, `amount`, `category`, `date`, `is_credit`, `credit_card_id`, `billing_month`, `recurring_expense_id`. |
| `recurring_expenses` | contas fixas e receitas recorrentes. `day_of_month`, `due_day`, `is_variable`, `total_installments` (parcelado). |
| `monthly_obligations` | a instância **daquele mês** de cada recorrente: `status pending/paid`, `paid_at`. |
| `monthly_plans` | plano do mês: `expected_income`, `savings_goal`. |
| `budgets` | limite por categoria. |
| `credit_cards` | cartões: limite, dia de fechamento, dia de vencimento. |
| `custom_categories` | categorias criadas pelo usuário (nome, ícone, cor, tipo). |
| `goals` + `goal_contributions` | metas financeiras genéricas (separadas da Missão). |
| `assets` + `liabilities` | patrimônio: ativos (caixa/investimentos/imóveis/negócios) e dívidas. |

### Missão de Poupança
`savings_missions` (1 ativa por vez) · `mission_contributions` (aportes, com `is_roundup`) · `mission_challenges` (desafios da IA: `accepted`/`dismissed`/`completed`) · `mission_badges` · `mission_goal_milestones` (25/50/75/100%).

### Hábito e engajamento
`user_activity` (1 linha por dia de acesso; coluna `frozen`) · `streak_milestones` · `weekly_challenges`.

### Plataforma
`subscriptions` (fonte da verdade do Pro) · `coupons` · `gastobot_usage` · `push_subscriptions` (web) · `device_tokens` (FCM nativo) · `push_history` / `push_notification_log` · `email_funnel_log` · `feedback` · `admins` · `user_blocks` · `webhook_events` (idempotência).

### RPCs importantes (SECURITY DEFINER — a lógica sensível vive no banco)
| RPC / trigger | Por quê |
|---|---|
| `check_expense_plan_limit()` (trigger BEFORE INSERT) | impõe o limite Free de 20 lançamentos/mês **no banco**, não só na UI. Ignora receitas e recorrentes. |
| `increment_goal_amount(goal_id, delta)` | incremento atômico. |
| `redeem_coupon(code, user_id)` | resgate atômico de cupom. |
| `claim_streak_milestone(days)` | **recomputa o streak no servidor** (gaps-and-islands sobre `user_activity`) antes de conceder — anti-cheat. |
| `claim_goal_milestone(mission_id, percent)` | recomputa `sum(contributions)/target` no servidor. Anti-farming: meta < R$1.000 registra o marco sem recompensa. |
| `complete_challenge(challenge_id)` | marca o desafio concluído, idempotente. **Não cria o aporte** — o aporte é o fluxo normal. |
| `consume_freeze_for_gap(p_today)` | consome freeze inserindo linha `frozen=true` em `user_activity`, "pontando" o buraco. |
| `grant_weekly_freeze()` / `buy_streak_freeze()` | concessão semanal e (legado) compra. |

> **Gotcha PostgREST:** ao criar função/tabela nova que o client chama, rodar `notify pgrst, 'reload schema';` no SQL Editor — senão dá *"Could not find the function … in the schema cache"*.
> **Gotcha RLS:** a policy de INSERT em `user_activity` foi endurecida — exige `auth.uid()=user_id`, `frozen=false` e `active_date` entre ontem e amanhã no fuso `America/Sao_Paulo`. Isso bloqueia forjar streak.

---

## 4. As telas, uma a uma

### Home (`/app`) — a tela que responde "como estou este mês?"
Composta por cards, em ordem:
1. **SaldoCard** — saldo cumulativo (não só do mês).
2. **EntradaSaidaCards** — entrou / saiu no período.
3. **CartaoCard + FaturaAlertCard** — fatura aberta e alerta de vencimento.
4. **OrcamentoCard** — quanto ainda pode gastar, com fala de coach.
5. **MissaoCard** — progresso da Missão + **check-in diário** ("· Dia N" + mensagem do coach).
6. **ReservaCard** — reserva de emergência sugerida.
7. **CompromissosCard / ContasDoMes** — só as contas **pendentes**; mostra "Tudo em dia ✓" quando zera.
8. **InsightsCard** e **AnomaliaCard** — insights escritos em tom de coach.
Mais: seletor de período, badge de streak 🔥 com sheet de freeze 🧊, drawer de notificações e `MonthlyCloseModal` (fechamento de mês).

### `/lancamentos` — lançar gasto ou receita
Formulário com valor, descrição, categoria (fixa ou custom), data e toggle **"Pagar com cartão de crédito"** (joga na fatura em vez do caixa). Traz:
- **`BudgetLimitHint`** — aviso **em tempo real, antes de salvar**, de que aquele valor vai estourar o limite da categoria (o item ⭐ do backlog; é o gancho dos criativos de anúncio).
- **`DuplicateWarningModal`** — detecta lançamento duplicado.
- **Round-up automático** (se ligado): arredonda o gasto pro próximo R$1/R$5/R$10 e a diferença vira aporte na Missão.
- Contador de limite do Free (aviso a partir do 15º lançamento, bloqueio no 20º).

### `/historico` — lista completa com filtros, busca, edição e exportação (CSV/PDF).
### `/recorrentes` — contas fixas: calendário do mês, marcar como paga, parcelados com prazo (`total_installments`), stats.
### `/categorias` — ranking de gastos por categoria vs média, alta/baixa (threshold 5%), e gestão das categorias personalizadas.
### `/orcamentos` — tela única de limites por categoria, com pills de status e o `PlanoMensalModal` (renda esperada + meta de economia).
### `/analise` — gráficos: donut por categoria, receita×despesa, saldo cumulativo, comparação de períodos, top categorias, grid de insights e dicas. **Parcialmente gated (Free vê versão reduzida com `ProGateCard`).**
### `/previsoes` — projeção de 12 meses a partir das recorrentes (perpétuas + parcelados que ainda têm parcelas).
### `/metas` — metas financeiras com tipo, prazo, cor, emoji e aportes. **Pro.**
### `/cartoes` (+ `/cartoes/detalhe`) — cartões, fatura por ciclo de fechamento, pagamento de fatura e **importação de CSV com categorização por IA**. **Pro.**
### `/patrimonio` — ativos, dívidas e patrimônio líquido. **Pro.**
### `/assistente` — o **GastôBot** (ver §6).
### `/missao/*` — a Missão de Poupança (ver §5).
### `/perfil` — plano, avatar, tema, `financial_start_day`, preferências de push/e-mail, round-up, badges de streak, exportar dados (LGPD), excluir conta, suporte e feedback.
### `/upgrade` — no nativo renderiza o **Paywall** (IAP); na web mostra o plano atual e o resgate de **cupom**.
### `/admin` — abas: visão geral, usuários, atividade, feedback, cupons, notificações e comunicação (push manual segmentado free/pro).

---

## 5. A Missão de Poupança (o diferencial)

**O que é:** o usuário define *quanto* quer guardar, *em quantos meses*, e o app calcula o alvo mensal. A partir daí, guardar dinheiro vira uma jornada com progresso visível.

**Ciclo de vida:** `/missao/nova` (nome, valor, prazo, lembretes, desafios de IA) → `/missao/dashboard` → `/missao/badges` → `/missao/compartilhar`. **Uma missão ativa por vez**; 100% **não** completa sozinha — o usuário fecha.

**Peças:**

| Peça | Como funciona |
|---|---|
| **Aporte** | ação-herói. `ContributionSheet` → `addContribution`. Celebra com "💰 Aporte registrado!". |
| **Marcos da meta** | 25 / 50 / 75 / 100% do dinheiro guardado → badge + `GoalMilestoneToast` + card compartilhável. Validado no servidor. Reivindica retroativo no primeiro load. |
| **Níveis** | derivados do % de progresso: 🌱 Iniciante (0–24) · ⚡ Intermediário (25–49) · 💎 Avançado (50–74) · 🚀 Expert (75–99) · 🏆 Completo (100). |
| **17 badges** | 4 categorias (`streak`, `valor`, `missoes`, `comportamento`). Ex.: 🚀 Primeiro passo, ⚡ Largada rápida, 📅 Pontual, 💥 Dobrou a meta, 🔥 Consistente, 💎 Poupador Expert, 🌟 Lendário. Fonte da verdade: `lib/badges.ts`. |
| **Desafios de IA** | **Pro.** Claude Haiku 4.5 lê o padrão de gastos e propõe um desafio do mês com `potential_savings`. Aceitar → concluir → **vira aporte real** (o sheet abre pré-preenchido com o valor sugerido, ajustável). |
| **Coach + check-in** | `lib/mission/coach.ts` classifica o ritmo (`savedPct` vs `timePct`, margem 5%) e escreve a mensagem: boas-vindas / adiantado / no ritmo / atrasado. Aparece no MissaoCard da Home e na projeção do dashboard ("atinge a meta em Novembro 2026"). |
| **Round-up** | opcional, configurado no perfil. Arredonda cada gasto pro próximo R$1/R$5/R$10 e a diferença vira aporte marcado `is_roundup=true`. Não gera recompensa (anti-farming), mas **aciona os marcos da meta**. |
| **Lembrete** | cron mensal (dia 5, 10h BR) por e-mail. |

### 5.1 Streaks — atenção, existem TRÊS noções diferentes

| Streak | Fonte | Onde aparece | Protegido por freeze? |
|---|---|---|---|
| **Acesso** 🔥 | `user_activity` | é o badge oficial da Home; alimenta milestones | **Sim** |
| **Poupança** | `mission_contributions` (mensal) | na Missão: "X meses seguidos guardando" | Não |
| **Registro** | `expenses` (dias consecutivos com lançamento) | só em 3 APIs server (admin/stats, assistente, resumo-semanal) | Não |

O streak de acesso é **100% derivado na leitura** (`lib/streak.ts` anda de hoje pra trás), sem valor persistido, no fuso **do dispositivo**.

**Streak Freeze 🧊:** 1 grátis por semana, máximo 2 (`CHECK` no banco). Ao perder dia(s), `consume_freeze_for_gap` insere linha `frozen=true` em `user_activity` — o cálculo de streak conta como dia presente, **zero mudança no caminho de leitura**. Se o buraco for maior que os freezes disponíveis, não consome (não desperdiça).

**Milestones de acesso:** 7 (Primeira Semana), 14 (Em Chama), 30 (Inabalável), 60 (Máquina), 100 (Centenário), 365 (Lendário) — celebrados por `MilestoneToast`, com badges no perfil.

---

## 6. GastôBot — o assistente com IA

`app/api/assistente/route.ts`, **Claude Sonnet 4.6**, prompt system com cache efêmero.

**O que ele recebe de contexto:** resumo do mês, planejamento, últimos 3 meses, orçamentos por categoria, metas ativas, patrimônio (ativos/dívidas/líquido), recorrentes ativos, streak e até 100 transações recentes.

**O que ele devolve:** JSON puro, em dois formatos —
- `{"type":"query","message":"…"}` para análise/resposta;
- `{"type":"expense_detected", "expense":{…}}` quando o usuário **descreve uma transação em linguagem natural** ("gastei 45 no mercado ontem") — o app oferece registrar direto.

**Regras do prompt:** máximo 200 palavras, seções curtas com **negrito** e emojis, valores sempre `R$ 1.000,00`, termina com pergunta ou próximo passo, nunca inventa categoria.

**Outros usos de IA:**
- `api/missao/gerar-desafio` — Haiku 4.5, gera o desafio da Missão (**402 se não for Pro**).
- `api/categorizar-csv` — Haiku 4.5, categoriza extrato importado (até 200 transações).

Rate limit em todas: 20 req/min por IP.

---

## 7. Free × Pro

### 7.1 Limites (`lib/planLimits.ts` — fonte única)

| Recurso | Free | Pro |
|---|---|---|
| Lançamentos por mês | **20** (imposto por trigger no Postgres) | ilimitado |
| Recorrentes ativos | **5** | ilimitado |
| Consultas ao GastôBot | **1 por mês** | ilimitado |
| Metas financeiras | ✗ | ✓ |
| Patrimônio | ✗ | ✓ |
| Cartões de crédito | ✗ | ✓ |
| Desafios de IA da Missão | ✗ (402 na API) | ✓ |
| Análise avançada | versão reduzida (`ProGateCard`) | completa |
| Relatório semanal por e-mail | — | ✓ |
| Suporte prioritário | — | ✓ |

O que o **Free** mantém integralmente: a Missão de Poupança (aportes, marcos, badges, níveis, coach, round-up), streak/freeze/milestones, orçamentos por categoria com alerta em tempo real, recorrentes, histórico, previsões e insights. **O gancho de conversão é o limite de volume + IA + as três telas fechadas (metas, patrimônio, cartões)**, não a mecânica central.

### 7.2 Como o Pro é decidido

**O BACKEND é a única fonte da verdade** — a tabela `subscriptions` (`plan`, `status`, `billing_cycle`, `current_period_end`, `store`, `entitlement`). Vale igual na web e no nativo, **sem override por plataforma**. `useSubscription()` lê essa tabela (com cache de 60s) e expõe `isPro = plan === 'pro' && status === 'active'`.

O SDK do RevenueCat **não** decide o Pro de ninguém — o entitlement lido no cliente serve só pra feedback imediato de UI logo após a compra.

**Fluxo de compra (nativo):**
```
Paywall (StoreKit/Play Billing, preços vindos do getOfferings — nada hardcoded)
   → compra ANÔNIMA (acontece antes do cadastro no first-run)
   → cadastro → Purchases.logIn(user.id)  (alias anônimo → conta)
   → POST /api/subscription/sync  ← ESSENCIAL: o alias NÃO dispara webhook
   → subscriptions gravada na hora
   → webhook RevenueCat cobre renovações/cancelamentos daí pra frente
```
Sem o `sync` sob demanda, a linha só nasceria na próxima renovação (um ano depois, no anual). Medido em produção: **18 segundos** entre cadastro e assinatura gravada.

**Outros caminhos para Pro:** resgate de **cupom** (`redeem_coupon`, dias de Pro) e ativação manual pelo painel admin (`billing_cycle = 'manual'`).

**Web/Kiwify:** ⚰️ **código morto**. Não existe assinatura pela web — `/upgrade` manda assinar pelo app. O webhook Kiwify e as envs `NEXT_PUBLIC_KIWIFY_CHECKOUT_*` são vestigiais e candidatos a faxina.

---

## 8. Cálculos financeiros (as fórmulas que importam)

### Orçamento do mês (`lib/monthlyBudget.ts` — **fonte única**, Home e `/orcamentos` mostram o MESMO número)

```
base      = income > 0 ? income : monthlyPlan.expectedIncome
planned   = base − savingsGoal              // o teto do mês
remaining = planned − debitSpent            // a sobra REAL (pode ser negativa)
pct       = min(debitSpent / planned × 100, 100)

structuralMargin = base − fixedCosts − savingsGoal   // diagnóstico "o plano fecha?"
```

> 🐛 **Bug de dinheiro já corrigido — não reintroduzir.** As contas fixas **não** são pré-reservadas do `planned`. Elas já entram como gasto quando pagas; subtraí-las antes descontava o mesmo dinheiro duas vezes (plano 4.500 / fixas 1.645 / meta 450: pagar as fixas derrubava o disponível de 2.405 pra 760, e o mesmo estado voltava a 2.405 ao lançar a renda). Quem precisa da pergunta estrutural usa `structuralMargin`, nunca `planned`.

- `debitSpent` = gasto em **caixa** (`spent − compras no crédito`). Compra no crédito só move caixa quando a fatura é paga.
- `'Saldo inicial'` é categoria de sistema (âncora do saldo cumulativo vinda do onboarding) e fica **fora** de entrou/saiu e de orçamentos.

### Alertas de orçamento por categoria (`lib/budgetAlerts.ts`)
Degraus únicos para todas as telas: **70% warn · 90% danger · 100% over**. `evaluateBudget({..., extraAmount})` permite avaliar um valor **ainda não lançado** — é o que sustenta o aviso em tempo real na tela de lançar.

### Variação de categoria (`lib/calculations.ts`)
Compara com a média dos **3 meses anteriores**. Thresholds intencionalmente diferentes: `ALERT 20%` (uso geral) · `PAGE 5%` (tela de categorias) · `ANOMALY 30%` (só anomalia severa no card da Home).

### Previsão (`lib/forecast.ts`)
12 meses à frente. Recorrentes **perpétuas** entram em todo mês; **parceladas** só enquanto restam parcelas (cruza com `expenses` por `recurring_expense_id`).

### Reserva de emergência (`lib/emergencyFund.ts`)
Base = soma das recorrentes de despesa **fixas** ativas, se ≥ R$100 (evita falso positivo de quem cadastrou só uma Netflix). Senão, média dos 3 últimos meses com lançamento.

### Mês financeiro (`lib/financialPeriod.ts`)
`profiles.financial_start_day` permite o mês começar no dia do salário. O seletor mostra "5 mai → 4 jun 2026".

### Fatura do cartão (`lib/storage/cards.ts`)
Ciclo por `dia_fechamento`/`dia_vencimento`. `faturaFromExpenses()` deriva a fatura da lista de expenses já carregada — **zero queries extras** (antes era 1 query por cartão na Home). Pagamento de fatura = expense com `category='Cartão de Crédito'`, `is_credit=false`, mesmo `billing_month`.

### Saldo cumulativo e auto-lançamento
O saldo é **cumulativo**, não do mês — por isso o onboarding grava a âncora `'Saldo inicial'`. Receitas recorrentes vencidas são **auto-lançadas** (`checkAndGenerateIncomeEntries`), e as obrigações do mês são geradas por `checkAndGenerateObligations` (com dedupe em voo + `sessionStorage`, porque 4 componentes chamam quase ao mesmo tempo no primeiro load).

---

## 9. Aquisição, onboarding e retenção

### 9.1 Dois onboardings diferentes (não confundir)

**A) First-run NATIVO (`/inicio`)** — máquina de estados numa rota só:
`intro (carousel) → quiz (8 passos) → building (antecipação) → plan (PlanReady) → paywall → cadastro`.
A flag `to_intro_seen` só é marcada no **CTA final** — quem abandona antes revê o carousel em vez de cair num beco sem saída no login. **Compliance Apple 3.1.1:** a tela de planos do quiz não mostra preço; preço só no paywall real, vindo da loja.

**B) Funil público `/comecar`** — alavanca de ativação (TikTok/anúncios), 5 passos: escolher missão (chips Reserva/Viagem/Carro/Outra) → valor → aporte + projeção → compromisso → **"Dia 1 ✅"**. Grava `presignup_mission` em localStorage **e** em `user_metadata` (durável cross-device). Na primeira sessão autenticada, um efeito idempotente no `/onboarding` cria a missão de verdade, registra o Dia 1 e pré-preenche o plano mensal.

**C) Onboarding financeiro (`/onboarding`, pós-cadastro)** — 5 passos: renda → contas fixas → cartões → meta → situação financeira (3 sub-etapas) → resumo → **convite de notificações**. Ao fim, `onboarding_completed = true` no `user_metadata`.

### 9.2 Notificações

**Push** — nativo via FCM/APNs (`device_tokens`, `lib/fcm.ts`), web via VAPID/Service Worker (`push_subscriptions`, `lib/push.ts`). Três crons, com opt-in por tipo em colunas de `profiles`:

| Cron | Quando | Coluna de preferência |
|---|---|---|
| `push/cron/due-tomorrow` | diário 9h | `push_due_tomorrow` |
| `push/cron/budget-exceeded` | diário 20h | `push_budget_exceeded` |
| `push/cron/weekly-summary` | segunda 13h | `push_weekly_summary` |

> ⚠️ São **essas colunas** que os crons leem. O JSON `notification_preferences` tem chaves legadas (`vencimento`, `resumo_semanal`) que **ninguém lê** — não confundir.

A copy é humana e amarrada à Missão quando ela existe (`lib/notifications/copy.ts`). Há `dryRun` escopado (`?dryRun=1&user=…` atrás do `CRON_SECRET`) para depurar sem enviar.

**E-mail (Resend)** — relatório **semanal** (segunda 8h) e **mensal** (dia 1, 8h), com templates em `lib/reports.ts`; **funil de ativação** D+0 / D+3 / D+14 / D+21 (cron diário 13h, dedupe por `email_funnel_log`, exclui Pro ativo de D3/D14/D21); lembrete mensal da Missão. Nenhum e-mail leva a checkout externo — todos são app-first.

> Os e-mails de **confirmação de cadastro (OTP)** e **recuperação de senha** são templates do **Supabase Dashboard**, fora do repo.

---

## 10. Design system

- **Fonte:** Nunito. **Accent:** `#5B5BD6` (índigo). Verde `#1E9E6A` só para dinheiro/confirmação.
- **Dark mode** via `[data-theme="dark"]` em `globals.css`. Variáveis reais: `--bg`, `--surface`, `--text`, `--text-2`, `--text-3`, `--border`, `--accent`, `--accent-bg`, `--r`, `--r-sm`, `--card-shadow`. **Não existem** `--background` nem `--text-primary`.
- **Admin é sempre light** (`data-theme="light"` forçado), com cores fixas `#111827` / `#374151` / `#6b7280`.
- **Tailwind v4 não aceita classes dinâmicas** — boa parte da UI usa `style={{}}` inline por isso.
- Camadas de `zIndex`: bottom nav 50 · overlay/drawer 60/70/71 · **paywall 80** (precisa ficar acima da tab bar, senão o aviso legal de renovação fica coberto — rejeição Apple 3.1.2).
- Mobile: bottom nav com FAB rotulado; tab "Perfil" com sheet + drawer lateral pelo hamburger. Desktop: sidebar em 3 grupos (Principal / Finanças / Outros).

---

## 11. Como trabalhar neste repositório

### Rodar
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run dev            # web (Next 16 com webpack)
npm run build:native   # export estático pro Capacitor
npm run cap:sync       # build:native + npx cap sync
```

### Checkpoint padrão (na ordem, sem pular)
```
npx tsc --noEmit  →  npx next build --webpack  →  commit  →  push main  →  smoke test em produção
```
Deploy é **só via CLI** (`npx vercel --prod --archive=tgz --yes`) — a integração Git da Vercel está quebrada. **Nunca pushar sem o OK do Anderson.**

### Modo de trabalho
Anderson opera em **"modo fábrica de prompts"**: o chat no repositório atua como **arquiteto** e gera prompts de desenvolvimento em 6 blocos (CONTEXTO · DECISÃO DE ARQUITETURA · BANCO DE DADOS · TAREFAS NUMERADAS · VERIFICAÇÃO · INSTRUÇÃO FINAL), que ele cola em outro chat que implementa. Quando ele sinaliza esse modo, **não implementar aqui** — só gerar o prompt. Ler/diagnosticar arquivos é sempre permitido. Para itens arriscados (auth, billing, banco), o processo é **mapping-first**.

### Gotchas que já custaram caro
1. **`profiles` não tem `user_id`** — filtrar por `id`.
2. **`notify pgrst, 'reload schema';`** depois de criar RPC/tabela nova.
3. **`npx tsc --incremental`** já causou falso verde — usar `--noEmit` limpo.
4. **Cache:** toda escrita precisa invalidar a chave. Logout faz **hard navigation** nos 5 pontos de `signOut` (senão o cache vaza entre contas).
5. **Fuso:** usar `getMonthKey(new Date())` (local), **nunca** `toISOString()` (UTC adianta um dia depois das ~21h BRT).
6. **`+10 por lançar` (histórico):** créditos ficavam nos **handlers de UI**, não dentro de `addExpense`/`markObligationAsPaid`, porque essas também rodam no seed do onboarding. (Regra ainda válida para qualquer recompensa futura.)
7. **Domínio apex faz 307 → www** e o `curl` descarta o header `Authorization` no redirect cross-host. Para chamar cron/dryRun **manualmente**, sempre `https://www.toorganizado.com.br/...`. Os Vercel Crons não são afetados (usam paths relativos).
8. **Cookie → localStorage** no webview: o Supabase precisa dessa troca no nativo.
9. **Verificar build iOS inspecionando o IPA exportado**, nunca o `.xcarchive`.

---

## 12. Estado atual (25/08/2026)

| Frente | Estado |
|---|---|
| **Web / PWA** | no ar (Vercel), app-first |
| **iOS** | **1.2 (9) aprovada e no ar na App Store, com IAP vendendo** (Pro mensal + anual). Push nativo provado em produção. |
| **Android** | AAB v4 (1.2) no **teste interno**; console configurado, RevenueCat ligado com os 2 planos. Falta testar em emulador, RTDN e a release de produção. |
| **Analytics** | GTM com Consent Mode v2 no ar, **só no build web**. |
| **Missão** | trilha M0–M5 completa e em produção. |
| **Moedas** | aposentadas (banco dormindo). |

**Pendências vivas conhecidas:**
1. **`terms_accepted_at` fica `null`** — com confirmação de e-mail ligada, o `upsert profiles` do cadastro roda sem sessão e a RLS bloqueia. Já há usuário pagante nessa situação → **questão de LGPD, vale priorizar**. Fix: mover o upsert para a primeira sessão autenticada.
2. **`await navigator.serviceWorker.ready` sem timeout** (`hooks/usePushNotifications.ts`) — qualquer falha futura de instalação do SW trava o botão de push em "Ativando…".
3. **Fix OTP de cadastro (Apple 2.1a)** — link do e-mail pré-buscado consome o OTP; o fix (template só-código) está commitado localmente e pausado.
4. **Limpar dados de teste da produção** antes de gravar os criativos.
5. **Faxina de código morto:** webhook + envs da Kiwify; tabelas/RPCs de moeda.
6. **WhatsApp:** `whatsapp_phone` é coletado mas **ninguém lê**; as rotas `link-otp`/`verify-otp` não são chamadas por nenhuma UI. O VPS Evolution (`api.toorganizado.com.br`) não serve nenhum fluxo vivo — conferir automação externa antes de desligar.
7. **Modo Casal (V-07)** adiado — tem conflito de RLS a resolver.

---

## 13. Glossário rápido

| Termo | Significado |
|---|---|
| **Missão de Poupança** | a meta de dinheiro guardado com jornada gamificada — o diferencial do produto |
| **Aporte** | contribuição de dinheiro para a Missão (a ação-herói) |
| **Round-up** | arredondamento automático do gasto; o troco vira aporte |
| **Recorrente** | conta fixa ou receita que se repete todo mês |
| **Obrigação** | a instância daquele mês de um recorrente (pendente/paga) |
| **Streak / freeze** | dias seguidos de acesso 🔥 / escudo que perdoa um dia perdido 🧊 |
| **GastôBot** | o assistente financeiro com IA |
| **`debitSpent`** | gasto que efetivamente saiu do caixa (exclui compras no crédito) |
| **`structuralMargin`** | renda − fixas − meta; diagnóstico "o plano fecha?", **não** é saldo |
| **Entitlement `pro`** | o direito de acesso Pro no RevenueCat; espelhado em `subscriptions` |
