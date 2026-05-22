import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// Cache de dados em escopo de módulo.
//
// Resolve o problema de 46+ queries por sessão: Sidebar, TopbarDesktop,
// Navigation e a Home buscavam os MESMOS dados de forma independente, e o
// useEffect da Sidebar refazia tudo a cada navegação.
//
// - TTL: dentro da janela, navegar entre abas reaproveita o cache (0 query).
// - Dedupe de requisição em voo: N chamadas concorrentes idênticas
//   (ex.: 3 useSubscription montando juntos) colapsam em 1 round-trip.
// - Invalidação explícita: toda escrita derruba a chave afetada, então o
//   próximo leitor pega dado fresco — a UI otimista não depende disto.
// ─────────────────────────────────────────────────────────────────────────────

type Entry<T> = {
  value: T;
  ts: number;
  // Promise da busca em andamento. Enquanto existir, novos leitores aguardam
  // ELA em vez de disparar outra query.
  inflight?: Promise<T>;
};

const store = new Map<string, Entry<unknown>>();

// TTLs (ms). Listas: curto o bastante p/ refrescar ao voltar depois de um
// tempo, longo o bastante p/ cobrir uma sessão de navegação entre abas.
export const TTL = {
  LIST: 60_000,
  USER: 5 * 60_000,
  SUBSCRIPTION: 60_000,
} as const;

export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const e = store.get(key) as Entry<T> | undefined;

  if (e) {
    if (e.inflight) return e.inflight; // dedupe
    if (now - e.ts < ttlMs) return e.value; // cache fresco
  }

  const inflight = fetcher().then(
    (value) => {
      store.set(key, { value, ts: Date.now() });
      return value;
    },
    (err) => {
      // Falhou: não persiste lixo. Mantém valor antigo se havia (stale ok),
      // senão remove a entrada para a próxima tentativa refazer.
      if (e && e.ts > 0) store.set(key, { value: e.value, ts: e.ts });
      else store.delete(key);
      throw err;
    }
  );

  store.set(key, {
    value: (e?.value as T) ?? (undefined as T),
    ts: e?.ts ?? 0,
    inflight,
  });
  return inflight;
}

// Invalida a chave exata e qualquer chave com o prefixo `prefix:` (ex.:
// invalidate('obligations') derruba 'obligations:2026-05', 'obligations:2026-04').
export function invalidate(prefix: string): void {
  for (const k of store.keys()) {
    if (k === prefix || k.startsWith(`${prefix}:`)) store.delete(k);
  }
}

export function invalidateAll(): void {
  store.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Invalidação automática: mapa table → cache keys a derrubar.
//
// O contrato anterior era frágil: TODA função nova em storage.ts precisava
// lembrar de chamar invalidate(<chave>). Esquecer significava UI exibindo
// dado velho por até TTL.LIST (60s). Aqui centralizamos a tabela do banco
// como a única coisa que o autor da escrita precisa lembrar — o mapa abaixo
// resolve as chaves derivadas.
//
// Algumas entradas (creditCardFaturas, profile, goals, assets, liabilities)
// referenciam chaves que AINDA não são cacheadas. Listá-las aqui é forward-
// thinking: `invalidate()` é no-op para chaves ausentes do store, e o dia
// que essas leituras virarem `cachedFetch` a invalidação já está coberta.
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_INVALIDATIONS = {
  expenses:            ['expenses', 'obligations', 'creditCardFaturas'],
  recurring_expenses:  ['recurring', 'obligations'],
  monthly_plans:       ['monthlyPlan'],
  monthly_obligations: ['obligations', 'expenses'],
  budgets:             ['budgets'],
  credit_cards:        ['creditCards', 'creditCardFaturas'],
  profiles:            ['profile'],
  subscriptions:       ['subscription'],
  goals:               ['goals', 'goalContributions'],
  goal_contributions:  ['goalContributions', 'goals'],
  assets:              ['assets'],
  liabilities:         ['liabilities'],
  savings_missions:     ['savings_missions'],
  mission_contributions:['mission_contributions', 'savings_missions'],
  mission_badges:       ['mission_badges'],
  mission_challenges:   ['mission_challenges'],
} as const;

export type CacheTable = keyof typeof TABLE_INVALIDATIONS;

// Envelopa uma escrita: executa, e se (e somente se) ela RESOLVER, invalida
// todas as chaves derivadas da(s) tabela(s). Se o writeFn rejeitar, propaga
// o erro normalmente e NÃO invalida — dado não mudou, cache permanece válido.
//
// Para escritas que tocam múltiplas tabelas (ex.: marcar obrigação como paga
// cria uma despesa), passar um array: as chaves de todas as tabelas são
// unionizadas e invalidadas uma única vez no caminho de sucesso.
//
// Observação para multi-step com falha parcial: se um INSERT bem-sucedido for
// seguido por outro que rejeita dentro do mesmo writeFn, a invalidação não
// roda — o estado parcial em cache será refrescado no próximo TTL (60s).
// Aceitável: alternativas (try/finally invalidando sempre) gastariam queries
// em todos os erros recuperáveis.
export async function withCacheInvalidation<T>(
  table: CacheTable | readonly CacheTable[],
  writeFn: () => Promise<T>,
): Promise<T> {
  const result = await writeFn();
  const tables: readonly CacheTable[] = Array.isArray(table) ? table : [table as CacheTable];
  const keys = new Set<string>();
  for (const t of tables) {
    for (const k of TABLE_INVALIDATIONS[t]) keys.add(k);
  }
  for (const k of keys) invalidate(k);
  return result;
}

// getUser() do supabase é SEMPRE um round-trip de rede (valida o token no
// servidor). Era chamado 10–15× por load (useSubscription×3, Sidebar, Topbar,
// loadUserAndProfile, checkAndGenerateObligations×4, cada escrita...).
// Cacheado: o user.id é estável na sessão; a RLS continua sendo aplicada no
// servidor a cada query real, independente deste objeto cacheado.
export function getCachedUser(): Promise<User | null> {
  return cachedFetch('auth:user', TTL.USER, async () => {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    return user;
  });
}

export function clearUserCache(): void {
  invalidate('auth:user');
}
