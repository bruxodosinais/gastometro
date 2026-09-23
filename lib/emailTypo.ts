// Sugestão de correção para domínio de e-mail digitado errado.
//
// Motivo: na onda de 22-23/09, 11 de 67 cadastros nunca confirmaram o e-mail e
// pelo menos 2 tinham "gmail.con". Esse e-mail nunca chega e a pessoa fica
// esperando um código que não existe — o maior vazamento do topo do funil.
//
// A sugestão é SEMPRE aditiva: nunca corrige sozinha nem bloqueia o envio.
// Domínio legítimo e raro (ex.: empresa própria) não pode virar barreira.

/** Domínios que concentram praticamente todo cadastro do app. */
const COMMON_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com.br',
  'yahoo.com',
  'icloud.com',
  'live.com',
  'me.com',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'globo.com',
];

/**
 * Distância de edição contando TROCA DE LETRAS VIZINHAS como um erro só
 * (Damerau-Levenshtein). Sem isso, "gmial.com" ficaria a 2 de "gmail.com" e
 * passaria batido — e é justamente o erro de digitação mais comum.
 *
 * Tem corte: para de contar assim que passa de `max`.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let beforePrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, beforePrev[j - 2] + 1);
      }
      row[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    beforePrev = prev;
    prev = row;
  }
  return prev[b.length];
}

/**
 * Devolve o e-mail corrigido quando o domínio parece erro de digitação de um
 * domínio comum, ou null quando não há o que sugerir.
 *
 * Só sugere para erro de UMA letra (gmail.con, hotnail.com). Dois erros já
 * arriscam propor um domínio que a pessoa não quis.
 */
export function suggestEmailFix(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at < 1) return null;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!local || !domain || domain.includes(' ')) return null;

  // Domínio exato é sempre válido — inclusive os que não estão na lista.
  if (COMMON_DOMAINS.includes(domain)) return null;

  for (const candidate of COMMON_DOMAINS) {
    if (editDistance(domain, candidate, 1) <= 1) return `${local}@${candidate}`;
  }
  return null;
}
