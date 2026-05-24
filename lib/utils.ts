export const COUPON_STORAGE_KEY = 'toorganizado_cupom';

export function buildKiwifyUrl(
  baseUrl: string,
  cupom?: string | null,
  utmCampaign?: string,
): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', 'toorganizado');
    url.searchParams.set('utm_medium', 'app');
    url.searchParams.set('utm_campaign', utmCampaign ?? 'upgrade');
    if (cupom) url.searchParams.set('cupom', cupom);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export function readStoredCupom(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(COUPON_STORAGE_KEY);
  } catch {
    return null;
  }
}
