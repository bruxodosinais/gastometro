/**
 * Detecta erro de rede pela mensagem do erro — funciona em Edge Runtime e no browser.
 * Não depende de `navigator.onLine` (não disponível no Edge).
 */
export function isNetworkErrorMessage(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('net::err') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('etimedout')
  );
}

/**
 * Versão browser — também considera `navigator.onLine`.
 * NÃO importar em proxy.ts ou código de servidor/edge.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return isNetworkErrorMessage(error);
}

export function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('jwt') ||
    msg.includes('token') ||
    msg.includes('não autenticado') ||
    msg.includes('unauthorized') ||
    msg.includes('unauthenticated')
  );
}

export function getErrorMessage(error: unknown): string {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (offline || isNetworkErrorMessage(error)) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }
  if (isAuthError(error)) {
    return 'Sua sessão expirou. Por favor, faça login novamente.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Ocorreu um erro inesperado. Tente novamente.';
}
