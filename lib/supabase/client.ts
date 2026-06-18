import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isNativePlatform } from '@/lib/native';

// Singleton: createClient() é chamado em ~79 lugares. Sem memoização, cada
// chamada instancia um novo client GoTrue, todos disputando o mesmo
// navigator.locks — origem do erro "Lock was released because another request
// stole it". Uma única instância por aba elimina a contenção.
//
// WEB: createBrowserClient (@supabase/ssr) persiste a sessão em COOKIES — é o
// que o middleware (proxy.ts) lê no servidor. Não muda nada na web.
//
// NATIVO (Capacitor/WKWebView, origem capacitor://localhost): cookies de scheme
// custom NÃO persistem no webview → a sessão "evapora" logo após o login
// (getUser → "Auth session missing"). Por isso, no nativo usamos o client puro
// do supabase-js com persistência em localStorage (que funciona no webview).
// No nativo não há middleware: o gating de sessão vive no AuthGate (client-side).
//
// IMPORTANTE: o tipo de retorno tem que ser EXATAMENTE o inferido de
// createBrowserClient(url, key) — anotar como ReturnType<typeof
// createBrowserClient> instancia o genérico Database com o default e quebra a
// inferência das queries (.select/.map viram implicit any) em todo o app.
// Por isso o cache deriva o tipo de makeClient(). Ambos os ramos inferem o
// mesmo SupabaseClient<any, "public", ...>, então a união colapsa.
function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (isNativePlatform()) {
    return createSupabaseClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: window.localStorage,
      },
    });
  }

  return createBrowserClient(url, key);
}

let browserClient: ReturnType<typeof makeClient> | null = null;

export function createClient() {
  return (browserClient ??= makeClient());
}
