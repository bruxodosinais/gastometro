'use client';

// Camada de acesso ao RevenueCat (IAP nativo). TUDO aqui é client-side e
// native-gated por isNativePlatform() (@/lib/native): na WEB toda função faz
// early-return/no-op e o plugin nativo NUNCA é carregado nem executado.
//
// Web-safety: o plugin @revenuecat/purchases-capacitor e o @capacitor/core são
// importados por `await import(...)` DENTRO das funções, sempre DEPOIS do guard
// isNativePlatform(). Assim o build web não executa código do plugin em runtime
// (o chunk existe, mas nunca é carregado quando isNativePlatform()===false).
// Só os `import type` (apagados na compilação) referenciam o pacote no topo.
//
// IMPORTANTE (Fase 2): esta camada NÃO decide o Pro de ninguém. O BACKEND
// continua a fonte de verdade do isPro (tabela `subscriptions`, atualizada pelo
// webhook RevenueCat na Fase 3). O entitlement lido aqui serve SÓ pra feedback
// imediato de UI logo após a compra/restore.

import { isNativePlatform, apiUrl } from '@/lib/native';
import { createClient } from '@/lib/supabase/client';
import type { CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor';

// Constantes do console RevenueCat (Fase 1).
export const ENTITLEMENT_ID = 'pro';
export const OFFERING_ID = 'default';

// configure() é global e deve rodar uma única vez por processo. Flag só vira
// true após um configure() bem-sucedido → se falhar, uma chamada futura tenta de
// novo. initRevenueCat() é, portanto, idempotente.
let configured = false;

// Um pacote do offering + o preço JÁ LOCALIZADO pela loja (ex.: "R$ 19,90").
export interface OfferingPackage {
  pkg: PurchasesPackage;
  priceString: string;
}

export interface Offerings {
  monthly: OfferingPackage | null;
  annual: OfferingPackage | null;
}

// Resultado de uma tentativa de compra. `cancelled` = usuário desistiu no
// prompt da loja (estado tratável, NÃO um erro/crash).
export interface PurchaseOutcome {
  proActive: boolean;
  cancelled: boolean;
}

// Escolhe a chave PÚBLICA de SDK por plataforma. Vazia/ausente → null (a env só
// é preenchida na Fase 1). As envs são inlined no bundle em build time.
function apiKeyFor(platform: string): string | null {
  const key =
    platform === 'ios'
      ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY
      : platform === 'android'
        ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY
        : undefined;
  return key && key.length > 0 ? key : null;
}

function hasPro(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
}

/**
 * Configura o SDK do RevenueCat. Idempotente e native-only.
 * - Web → return imediato (no-op).
 * - Chave ausente (envs da Fase 1 ainda vazias) → warn + return, sem travar o boot.
 */
export async function initRevenueCat(): Promise<void> {
  if (!isNativePlatform()) return;
  if (configured) return;

  const { Capacitor } = await import('@capacitor/core');
  const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
  const apiKey = apiKeyFor(platform);
  if (!apiKey) {
    console.warn(
      `[revenuecat] chave SDK ausente para "${platform}" — configure() ignorado. ` +
        `Preencha NEXT_PUBLIC_REVENUECAT_${platform === 'ios' ? 'IOS' : 'ANDROID'}_KEY (Fase 1).`,
    );
    return;
  }

  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  await Purchases.configure({ apiKey });
  configured = true;
}

/**
 * Offerings 'default' com os pacotes Mensal/Anual e o priceString localizado.
 * Web (ou offering inexistente) → null.
 */
export async function getOfferings(): Promise<Offerings | null> {
  if (!isNativePlatform()) return null;

  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  const offerings = await Purchases.getOfferings();
  const offering = offerings.all[OFFERING_ID] ?? offerings.current;
  if (!offering) return null;

  const wrap = (pkg: PurchasesPackage | null): OfferingPackage | null =>
    pkg ? { pkg, priceString: pkg.product.priceString } : null;

  return { monthly: wrap(offering.monthly), annual: wrap(offering.annual) };
}

/**
 * Compra um pacote. Cancelamento do usuário volta como { cancelled: true }
 * (tratável); outros erros propagam. Web → no-op.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!isNativePlatform()) return { proActive: false, cancelled: false };

  const { Purchases, PURCHASES_ERROR_CODE } = await import('@revenuecat/purchases-capacitor');
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return { proActive: hasPro(customerInfo), cancelled: false };
  } catch (e) {
    const err = e as { code?: unknown; userCancelled?: boolean };
    if (err?.userCancelled === true || err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { proActive: false, cancelled: true };
    }
    throw e;
  }
}

/** Restaura compras anteriores e lê o entitlement 'pro'. Web → { proActive: false }. */
export async function restorePurchases(): Promise<{ proActive: boolean }> {
  if (!isNativePlatform()) return { proActive: false };

  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  const { customerInfo } = await Purchases.restorePurchases();
  return { proActive: hasPro(customerInfo) };
}

/**
 * Aliasa o usuário anônimo do RevenueCat → conta Supabase (usado na Fase 5, pós-
 * cadastro, pra amarrar a compra anônima à conta). Web/appUserId vazio → no-op.
 */
export async function loginRevenueCat(appUserId: string): Promise<void> {
  if (!isNativePlatform()) return;
  if (!appUserId) return;

  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  await Purchases.logIn({ appUserID: appUserId });
}

/**
 * Sync sob demanda pós-alias: chama o backend (que consulta o RevenueCat via
 * REST secret key) pra gravar a assinatura em `subscriptions` NA HORA. Necessário
 * porque o alias anônimo→identificado NÃO dispara webhook — sem isto, a linha só
 * nasceria na próxima renovação (um ano depois, no anual). Native-gated e
 * best-effort: sem sessão/erro/timeout → return silencioso (o webhook ainda cobre
 * renovações/cancelamentos). Retorna true se o backend confirmou 'pro' ativo.
 */
export async function syncSubscriptionFromStore(): Promise<boolean> {
  if (!isNativePlatform()) return false;

  const {
    data: { session },
  } = await createClient().auth.getSession();
  const token = session?.access_token;
  if (!token) return false;

  const res = await fetch(apiUrl('/api/subscription/sync'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const body = (await res.json().catch(() => null)) as { pro?: boolean } | null;
  return body?.pro === true;
}
