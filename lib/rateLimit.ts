// Rate limiter in-memory simples. Best-effort: serverless multi-instância,
// cada uma com seu mapa. Padrão usado no webhook Kiwify (app/api/webhooks/kiwify/route.ts).
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  ip: string,
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const mapKey = `${key}:${ip}`;
  const entry = rateLimitMap.get(mapKey);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(mapKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}
