// Leitura COMPLETA de uma tabela para o painel /admin.
//
// O PostgREST do Supabase corta toda resposta em 1000 linhas (max-rows), e
// `.limit(200000)` NÃO fura esse teto — ele só é respeitado até 1000. Sem
// paginar, contagem, funil e retenção ficam errados em silêncio assim que a
// tabela passa de mil linhas. Medido em 25/09/2026: onboarding_events com 1382
// linhas devolvia 1000; expenses em 962, prestes a cruzar.
//
// `page` monta a consulta de UMA página. Ela precisa ter `.order()` estável
// (coluna única ou combinação única), senão linhas se repetem/somem entre
// páginas:
//
//   const rows = await fetchAll((from, to) =>
//     admin.from('expenses').select('user_id').order('id').range(from, to));

export const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: unknown };

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error || !data) break; // painel nunca cai por causa de uma tabela
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}
