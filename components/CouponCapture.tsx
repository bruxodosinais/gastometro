'use client';

import { useEffect } from 'react';
import { COUPON_STORAGE_KEY } from '@/lib/utils';

export default function CouponCapture() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      const cupom = params.get('cupom');
      if (!cupom) return;

      try {
        window.sessionStorage.setItem(COUPON_STORAGE_KEY, cupom);
      } catch {
        // sessionStorage indisponível (Safari private mode etc.) — segue limpando a URL
      }

      params.delete('cupom');
      const qs = params.toString();
      const newUrl =
        window.location.pathname +
        (qs ? `?${qs}` : '') +
        window.location.hash;
      window.history.replaceState(window.history.state, '', newUrl);
    } catch {
      // noop
    }
  }, []);

  return null;
}
