import { createClient as createCookieClient } from '@/lib/supabase/server';
import { createClient as createTokenClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

// Tipo do client autenticado retornado. O ramo cookie (@supabase/ssr) e o ramo
// Bearer (@supabase/supabase-js) inferem o mesmo SupabaseClient<any,...>, então
// derivamos do cookie client (caminho atual da web) pra manter a inferência das
// queries (.from/.select) idêntica ao resto do app.
type AuthedClient = Awaited<ReturnType<typeof createCookieClient>>;

export type RequestAuth =
  | { user: User; supabase: AuthedClient }
  | { user: null; supabase: null };

// Autentica uma request de /api por COOKIE de sessão (web, caminho atual) OU
// por Authorization: Bearer <access_token> do Supabase (app nativo Capacitor,
// fetch cross-origin sem cookie). ADITIVO: tenta cookie primeiro — a web fica
// EXATAMENTE como antes; Bearer só entra como fallback quando não há sessão por
// cookie. Devolve o client já autenticado para que as queries RLS-scoped das
// rotas continuem rodando como o usuário (igual ao client de cookie).
export async function getRequestUser(req: Request): Promise<RequestAuth> {
  // 1) Cookie (web). Sem sessão por cookie, getUser() retorna null sem rede.
  const cookieClient = await createCookieClient();
  const {
    data: { user: cookieUser },
  } = await cookieClient.auth.getUser();
  if (cookieUser) {
    return { user: cookieUser, supabase: cookieClient };
  }

  // 2) Bearer (nativo). Valida o token e cria um client cujas queries rodam
  // como esse usuário (RLS), injetando o Authorization em todas as chamadas.
  const authz = req.headers.get('authorization') ?? '';
  const match = authz.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const token = match[1].trim();
    const tokenClient = createTokenClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const {
      data: { user },
    } = await tokenClient.auth.getUser(token);
    if (user) {
      return { user, supabase: tokenClient as AuthedClient };
    }
  }

  return { user: null, supabase: null };
}
