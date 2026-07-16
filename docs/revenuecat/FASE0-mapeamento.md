# Fase 0 — Mapeamento RevenueCat / IAP nativo (TôOrganizado)

> Relatório de mapeamento apenas. **Nenhum arquivo de código foi alterado.**
> Data: 2026-07-03 · Branch: `main`

## Fato de partida — CONFIRMADO (não mudou)

`hooks/useSubscription.ts:83-86` está exatamente como descrito:

```ts
const native = isNativePlatform();
const plan: SubscriptionPlan = native ? 'pro' : row.plan;
const status = native ? 'active' : row.status;
const isPro = native || (plan === 'pro' && status === 'active');
```

No nativo, `isPro` é **sempre** `true`, ignorando a linha real de `subscriptions`.
Isto é o interruptor central da Fase 4 (client). Mas **não é o único** ponto — o
servidor tem gates equivalentes por `Origin` (ver tabela abaixo).

---

## (a) Tabela — pontos que concedem Pro ao nativo

### CLIENT

| # | Arquivo:linha | O que faz | Muda na Fase 4 |
|---|---|---|---|
| C1 | `hooks/useSubscription.ts:83-86` | `native ? 'pro'/'active'` e `isPro = native \|\| …`. **Origem única** de todo o Pro-grátis no client. | Remover o `native ?`/`native \|\|`. `plan`/`status`/`isPro` passam a vir **só** de `row` (assinatura real). Todos os consumidores abaixo herdam a mudança sem tocar neles. |

**Consumidores de `useSubscription` (herdam C1 — não precisam mudar, mas passam a ver Free):**

| Arquivo:linha | Usa | Efeito quando nativo virar Free |
|---|---|---|
| `app/(app)/analise/page.tsx:218,288` | `isPro` → `isFree` (blur/lock de relatórios) | Nativo Free vê os locks (hoje ocultos) |
| `app/(app)/recorrentes/page.tsx:60,599` | `isFree` + `PLAN_LIMITS.free.recurringExpenses` | Passa a aplicar limite de recorrentes no nativo |
| `app/(app)/upgrade/page.tsx:44-45,117` | `isPro`, `native = isNativePlatform()`, `refetch` | Tela de upgrade deixa de curto-circuitar; **é onde a compra IAP será disparada** |
| `app/(app)/perfil/page.tsx:80,602-707` | badge PRO/FREE + "Gerenciar/Fazer upgrade" | Mostra FREE e CTA de upgrade no nativo |
| `app/(app)/app/page.tsx:73,1365` | `isFree` (banner) | Banner de upgrade aparece no nativo |
| `app/(app)/missao/nova/page.tsx:100,156,211,335,844` | `isPro` gate dos "desafios com IA" | Toggle IA desabilitado no nativo Free |
| `app/(app)/missao/dashboard/page.tsx:95,796` | `isPro` p/ gerar desafio | Idem |
| `app/(app)/cartoes/page.tsx:52,615` | `isFree` → paywall da página | Página Cartões trava no nativo Free |
| `app/(app)/patrimonio/page.tsx:115,295` | `isFree` → paywall | Página Patrimônio trava no nativo Free |
| `app/(app)/assistente/page.tsx:185,196-303` | `isFree` + limite de uso | Assistente passa a ter limite Free no nativo |
| `app/(app)/lancamentos/page.tsx:372,616-618` | `isFree` + limite de lançamentos | Aplica limite de lançamentos no nativo |
| `app/(app)/metas/page.tsx:190,465` | `isFree` → paywall | Página Metas trava no nativo Free |
| `components/Navigation.tsx:80,140,270-478` | `isFree`/`isPro` (banners mobile) | Banners de upgrade no nativo |
| `components/Sidebar.tsx:94,312-444` | `isPro` (badge + CTA) | Sidebar mostra Free no nativo |

> **Implicação Fase 4:** basta desligar C1 para que **todas** essas telas passem a
> gate real. Por isso o paywall (Fase 3) precisa existir **antes** de desligar C1,
> senão o nativo vira Free sem caminho de compra.

### SERVER (Pro-gate por `Origin` nativo — `lib/cors.ts:isNativeRequest`)

`isNativeRequest(req)` retorna `true` quando `Origin ∈ {capacitor://localhost, https://localhost}` (`lib/cors.ts:19-28`).

| # | Arquivo:linha | Como concede Pro ao nativo | Muda na Fase 4 |
|---|---|---|---|
| S1 | `app/api/missao/gerar-desafio/route.ts:40-41` | `isPro = isNativeRequest(request) \|\| (sub.plan==='pro' && sub.status==='active')` | Remover `isNativeRequest(request) \|\|`. Passa a exigir assinatura real (retorna `402 pro_required`). |
| S2 | `app/api/assistente/route.ts:45,301` | `isPro = isNativeRequest(request) \|\| (subRow…)` | Idem — remover o bypass nativo; limite/lock Free valem no nativo. |

**Rotas Pro-gated que NÃO dão bypass nativo (já leem só a assinatura real — sem mudança):**

| Arquivo:linha | Observação |
|---|---|
| `app/api/whatsapp/link-otp/route.ts:26-27` | `isPro = sub.plan==='pro' && sub.status==='active'` — **sem** `isNativeRequest`. Já gate real (feature web). Nenhuma mudança. |
| `app/api/push/send/route.ts:79-80` | Segmenta push por `plan==='pro' && status==='active'` (não concede acesso; só filtra alvo). Sem mudança. |
| `app/api/push/cron/*` (`getSubscriptionsForUsers`) | Leem assinatura real via `lib/push.ts:78`. Sem mudança. |

> **Nota de segurança (já anotada no código, `lib/cors.ts:22-24`):** `Origin` não é
> forjável por browser, mas um cliente fora-do-browser pode enviá-lo. Risco aceito
> só enquanto o nativo é grátis. Ao introduzir Pro pago, S1/S2 **devem** deixar de
> confiar em `Origin` — a fonte de verdade vira `subscriptions` (webhook RevenueCat).

**`getSubscription` server helper** (`hooks/useSubscription.ts:103-114`): lê a linha
real, sem bypass nativo. Não é chamado por S1/S2 hoje (eles consultam `subscriptions`
inline), mas é o helper canônico para a Fase 4 no server.

---

## (b) Ponto exato de inserção — paywall e `Purchases.logIn`

### State machine do onboarding — `app/inicio/page.tsx:34`

```
intro (carousel) → quiz → building → plan (PlanReady) → [router.push('/auth/cadastro')]
```

- Tipo atual: `useState<'intro' | 'quiz' | 'building' | 'plan'>('intro')`.
- CTA final hoje: `PlanReady.onCreateAccount` (`app/inicio/page.tsx:59-64`) faz
  `markIntroSeen()` + `saveLocalPresignup(mission)` + `router.push('/auth/cadastro')`.
- `PlanReady.tsx` já tem o **`PricingSlot` isolado e web-only** (`PlanReady.tsx:38-40,116`)
  — hoje `null` (compliance Apple 3.1.1). É o encaixe natural do bloco de venda **web**.

**Onde a fase `'paywall'` entra (conforme decisão de arquitetura):**
adicionar `'paywall'` à união de `phase` e inseri-la **entre `'plan'` e o
`router.push('/auth/cadastro')`**, native-gated. Ou seja: `onCreateAccount` do
`PlanReady`, em vez de ir direto pro cadastro, no nativo (`isNativePlatform()`)
transiciona para `phase='paywall'`; na web mantém o push direto (comportamento
idêntico). A tela de paywall dispara a compra IAP e, ao concluir (ou "continuar
grátis", se houver tier free), segue para `/auth/cadastro`.

> Web nunca regride: como o gate é `isNativePlatform()`, o build web pula `'paywall'`.

### Onde fica o `Purchases.logIn(supabaseUserId)` pós-cadastro

O IAP é comprado **anônimo** (usuário RevenueCat anônimo) na tela de paywall, **antes**
de existir conta. O alias para a conta acontece no **primeiro momento com `user.id`**:

- Fluxo nativo de cadastro (`app/auth/cadastro/page.tsx:215-221`): salva
  `pending_confirmation_email` e, no nativo, `router.push('/auth/confirmar-codigo')`.
- **Ponto do alias:** `app/auth/confirmar-codigo/page.tsx:71-91`, logo após
  `supabase.auth.verifyOtp({ type:'signup' })` retornar sucesso e **antes** de
  `router.replace('/onboarding')`. É o primeiro instante com sessão válida no webview
  nativo. Chamar `Purchases.logIn(session.user.id)` aqui (native-gated) faz o alias
  do usuário anônimo do RevenueCat → conta Supabase.
- **Fallback/idempotência:** repetir o `logIn` no boot nativo já-logado
  (`app/page.tsx` boot effect, ~linha 80+, ramo `if (user)`) e/ou no `/onboarding`
  (`app/onboarding/page.tsx:348-351`, onde já há `getUser()` → `user.id`) cobre quem
  comprou mas caiu antes de confirmar. `logIn` é idempotente.

> Detalhe: no nativo o cadastro pode **não** devolver `data.session` (confirma por
> OTP) — por isso o `logIn` definitivo é no `confirmar-codigo`, não no `cadastro`.

---

## (c) Versão do plugin RevenueCat para Capacitor 8

- Projeto usa `@capacitor/core|ios|android ^8.4.0` (`package.json`).
- **`@revenuecat/purchases-capacitor@13.2.1`** (latest) — `peerDependencies:
  { "@capacitor/core": ">=8.0.0" }`. **Compatível com Cap 8.4.** Usar `^13`.
- ⚠️ Não usar a dist-tag `next` (`8.0.0-beta.4`) — é beta e o número de versão não
  reflete a versão do Capacitor.
- **NÃO instalado nesta fase** (instrução respeitada). Instalação/registro do plugin
  nativo é Fase 2.

Fontes: [npm @revenuecat/purchases-capacitor](https://www.npmjs.com/package/@revenuecat/purchases-capacitor) · [package.json (peerDependencies)](https://github.com/RevenueCat/purchases-capacitor/blob/main/package.json) · [Docs Capacitor RevenueCat](https://www.revenuecat.com/docs/getting-started/installation/capacitor)

---

## (d) Exclusão de `/api` no export nativo cobre a rota nova?

**Sim.** `scripts/build-native.sh:17-21` reloca `app/api` **inteiro** (mais `proxy.ts`
e `app/auth/callback`) para um stash antes de `next build --webpack` com
`BUILD_TARGET=native` (`output:'export'`), e restaura no `trap EXIT`:

```bash
ITEMS=( "app/api" "proxy.ts" "app/auth/callback" )
```

- O webhook Kiwify vive em `app/api/webhooks/kiwify/route.ts` → já excluído por estar
  sob `app/api`.
- Uma rota nova `app/api/webhooks/revenuecat/route.ts` cai sob o **mesmo** prefixo
  `app/api` → **automaticamente excluída** do export nativo, sem editar o script.
  (O webhook roda no server Vercel; o nativo chama a API remota via `NEXT_PUBLIC_API_BASE`.)

Script citado: `npm run build:native` → `bash scripts/build-native.sh`.

---

## Banco — schema atual + gap para RevenueCat (nada alterado)

`supabase/migrations/20260513_subscriptions.sql` — tabela `subscriptions`:
`user_id (unique)`, `plan`, `billing_cycle`, `status`, `kiwify_order_id`,
`kiwify_subscription_id`, `current_period_end`, `created_at`, `updated_at`.
RLS: SELECT próprio + `service_role` full. Trigger `updated_at`.

**Faltaria para RevenueCat (criar em fase posterior, não agora):**
- `revenuecat_app_user_id text` — mapear o App User ID do RevenueCat ↔ `user_id`
  (chave usada pelo webhook para localizar a assinatura).
- (opcional) `revenuecat_entitlement text` / `store text` (`app_store`|`play_store`)
  / `revenuecat_original_transaction_id text` — origem e rastreio da compra.
- Reaproveitar `plan`/`status`/`billing_cycle`/`current_period_end` (o webhook
  RevenueCat preenche os mesmos campos que o Kiwify hoje preenche).

---

## Verificação final

- ✅ `git status` sem novas alterações de código do meu trabalho. Os 3 arquivos
  modificados (`.claude/settings.local.json`, `ios/App/App.xcodeproj/project.pbxproj`,
  `proxy.ts`) **já estavam modificados** no snapshot inicial desta sessão — não os toquei.
  (Este relatório é um `.md` novo em `docs/revenuecat/`, não código.)
- ✅ Nenhuma dependência instalada.
- ✅ Fato de partida `native ? 'pro'` **inalterado** no código.

**Aguardando revisão antes da Fase 2.**
