// Sinalizadores de "novidade" persistidos em localStorage. Cada chave guarda
// o timestamp da primeira vez que o usuário interagiu com a feature; o badge
// "NOVO" deixa de aparecer após uma janela (default: 30 dias) ou quando o
// usuário toca pela primeira vez (o que vier antes — markFeatureSeen só
// escreve se não houver registro, preservando o ponto de partida do timer).

const DAY_MS = 24 * 60 * 60 * 1000;

export function shouldShowNewBadge(key: string, windowDays = 30): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return true;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return true;
    return Date.now() - ts < windowDays * DAY_MS;
  } catch {
    return false;
  }
}

export function markFeatureSeen(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, String(Date.now()));
    }
  } catch {
    // localStorage indisponível (modo privado, quota, etc.) — silenciar é OK,
    // o badge simplesmente continua aparecendo até a janela expirar.
  }
}

export const MISSAO_FEATURE_KEY = 'missao_feature_seen';
