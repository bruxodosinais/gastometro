import { apiUrl, isNativePlatform } from '@/lib/native';
import { createClient } from '@/lib/supabase/client';

// fetch para as rotas /api. Na WEB é equivalente a fetch(apiUrl(path), init):
// path relativo + cookie de sessão (idêntico ao comportamento atual). No NATIVO
// (Capacitor), apiUrl() vira a URL absoluta da API de produção e injetamos o
// Authorization: Bearer <access_token> do Supabase, já que o fetch é
// cross-origin e não carrega o cookie de sessão.
export async function fetchApi(path: string, init: RequestInit = {}): Promise<Response> {
  const url = apiUrl(path);

  if (!isNativePlatform()) {
    return fetch(url, init); // web: cookie same-origin, sem header extra
  }

  const {
    data: { session },
  } = await createClient().auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return fetch(url, { ...init, headers });
}
