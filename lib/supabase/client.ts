import { createBrowserClient } from '@supabase/ssr';

// Singleton: createClient() é chamado em ~79 lugares. Sem memoização, cada
// chamada instancia um novo client GoTrue, todos disputando o mesmo
// navigator.locks — origem do erro "Lock was released because another request
// stole it". Uma única instância por aba elimina a contenção.
//
// IMPORTANTE: o tipo de retorno tem que ser EXATAMENTE o inferido de
// createBrowserClient(url, key) — anotar como ReturnType<typeof
// createBrowserClient> instancia o genérico Database com o default e quebra a
// inferência das queries (.select/.map viram implicit any) em todo o app.
// Por isso o cache deriva o tipo de makeClient(), que chama igual ao original.
function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

let browserClient: ReturnType<typeof makeClient> | null = null;

export function createClient() {
  return (browserClient ??= makeClient());
}
