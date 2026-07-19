import { isNativePlatform } from '@/lib/native';

/**
 * URL base do site para redirects de auth (confirmação de e-mail, reset de
 * senha). Prefere NEXT_PUBLIC_SITE_URL — inlinado no build pela Vercel — e cai
 * pra window.location.origin quando a env var não existir (dev local).
 *
 * IMPORTANTE: `process.env.NEXT_PUBLIC_SITE_URL` é referenciado de forma
 * estática de propósito — o Next só inlina a var assim (lookup dinâmico não
 * é substituído). Não existir a var em dev é o comportamento desejado: mantém
 * os links de confirmação apontando pra localhost durante o teste local.
 *
 * No app nativo (Capacitor), window.location.origin = capacitor://localhost, que
 * não está na allowlist do Supabase → GoTrue cairia no fallback Site URL. Por
 * isso, quando nativo e sem NEXT_PUBLIC_SITE_URL, usamos NEXT_PUBLIC_API_BASE
 * (a base de produção embarcada no build nativo) pra que os links de auth abram
 * na web de produção.
 *
 * A causa raiz do "link aponta pra localhost" em produção é a Site URL do
 * dashboard do Supabase (fallback do GoTrue quando o redirect_to não casa com
 * a allowlist) — este helper é hardening complementar, não a correção.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (isNativePlatform()) {
    const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/+$/, '');
    if (apiBase) return apiBase;
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
