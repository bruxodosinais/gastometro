import { getExpenses } from '@/lib/storage';

export interface DuplicateCandidate {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

export interface DuplicateResult {
  isDuplicate: boolean;
  candidates: DuplicateCandidate[];
}

const WINDOW_DAYS = 45;
const SIMILARITY_THRESHOLD = 0.7;
// Epsilon RELATIVO: tolera diferença de até 0.5% entre os valores.
// Para R$50 → 25 centavos; para R$1000 → R$5. Suficiente para absorver
// arredondamentos do Postgres NUMERIC sem deixar passar duplicata real.
const AMOUNT_EPSILON = 0.005;

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): Set<string> {
  return new Set(s.split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  // Substring após normalização: "Netflix" ⊂ "Conta Netflix" → match instantâneo.
  if (na.includes(nb) || nb.includes(na)) return 1;
  return jaccard(tokenize(na), tokenize(nb));
}

// Diferença em dias entre duas strings YYYY-MM-DD usando Date.UTC, então não
// sofre influência do timezone local nem de DST. Datas iguais → 0.
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.abs((da - db) / 86_400_000);
}

// Detecta possíveis duplicatas nos últimos 45 dias.
// Critério: mesmo type + mesmo amount + similaridade de descrição ≥ 70%.
// Ignora lançamentos com recurring_expense_id (auto-lançamento de recorrente
// não é duplicata manual). Janela: date ∈ [dateStr - 45d, dateStr] —
// mesmo-dia (date === dateStr) É candidato.
export async function detectDuplicate(
  description: string,
  amount: number,
  type: string,
  dateStr: string,
): Promise<DuplicateResult> {
  const expenses = await getExpenses();
  const candidates: DuplicateCandidate[] = [];

  for (const exp of expenses) {
    if (exp.type !== type) continue;
    // Epsilon relativo: diff ≤ 0.5% × max(a, b, 1). Comparar com max evita
    // ficar restritivo demais p/ valores altos e absurdo p/ valores baixos.
    const tolerance = AMOUNT_EPSILON * Math.max(exp.amount, amount, 1);
    if (Math.abs(exp.amount - amount) > tolerance) continue;
    if (exp.recurringExpenseId) continue;
    // Comparação de strings YYYY-MM-DD (lexicográfica == cronológica).
    if (exp.date > dateStr) continue;
    if (daysBetween(exp.date, dateStr) > WINDOW_DAYS) continue;

    const score = similarity(description, exp.description);
    if (score >= SIMILARITY_THRESHOLD) {
      candidates.push({
        id: exp.id,
        description: exp.description,
        amount: exp.amount,
        date: exp.date,
        category: exp.category,
      });
    }
  }

  candidates.sort((a, b) => b.date.localeCompare(a.date));

  return {
    isDuplicate: candidates.length > 0,
    candidates,
  };
}
