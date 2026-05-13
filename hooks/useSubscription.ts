'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type SubscriptionPlan = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due';
export type BillingCycle = 'monthly' | 'annual' | null;

export interface SubscriptionRow {
  plan: SubscriptionPlan;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  current_period_end: string | null;
  kiwify_order_id: string | null;
  kiwify_subscription_id: string | null;
}

export interface UseSubscriptionResult {
  plan: SubscriptionPlan;
  isPro: boolean;
  isFree: boolean;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodEnd: Date | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const DEFAULT_FREE: SubscriptionRow = {
  plan: 'free',
  billing_cycle: null,
  status: 'active',
  current_period_end: null,
  kiwify_order_id: null,
  kiwify_subscription_id: null,
};

export function useSubscription(): UseSubscriptionResult {
  const [row, setRow] = useState<SubscriptionRow>(DEFAULT_FREE);
  const [loading, setLoading] = useState(true);

  const fetchSub = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRow(DEFAULT_FREE);
        return;
      }
      const { data } = await supabase
        .from('subscriptions')
        .select('plan, billing_cycle, status, current_period_end, kiwify_order_id, kiwify_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setRow(data as SubscriptionRow);
      } else {
        setRow(DEFAULT_FREE);
      }
    } catch {
      setRow(DEFAULT_FREE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSub();
  }, [fetchSub]);

  const plan = row.plan;
  const status = row.status;
  const isPro = plan === 'pro' && status === 'active';
  const currentPeriodEnd = row.current_period_end ? new Date(row.current_period_end) : null;

  return {
    plan,
    isPro,
    isFree: !isPro,
    status,
    billingCycle: row.billing_cycle,
    currentPeriodEnd,
    loading,
    refetch: fetchSub,
  };
}

// Server-side helper. Usar com supabase admin client.
export async function getSubscription(
  userId: string,
  supabaseAdmin: SupabaseClient,
): Promise<SubscriptionRow> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, billing_cycle, status, current_period_end, kiwify_order_id, kiwify_subscription_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return DEFAULT_FREE;
  return data as SubscriptionRow;
}
