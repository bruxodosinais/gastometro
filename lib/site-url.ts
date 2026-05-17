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
 * A causa raiz do "link aponta pra localhost" em produção é a Site URL do
 * dashboard do Supabase (fallback do GoTrue quando o redirect_to não casa com
 * a allowlist) — este helper é hardening complementar, não a correção.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
