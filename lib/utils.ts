export const COUPON_STORAGE_KEY = 'toorganizado_cupom';

export function readStoredCupom(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(COUPON_STORAGE_KEY);
  } catch {
    return null;
  }
}
