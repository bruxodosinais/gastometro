-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 3 — RevenueCat: colunas em `subscriptions` para o webhook
-- APLICAR À MÃO no SQL Editor do Supabase (Anderson). NÃO é aplicada por código.
-- Rode o bloco inteiro; é idempotente (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════

-- Chave de vínculo: o app_user_id do RevenueCat (= user.id do Supabase após o
-- logIn da Fase 5). É a coluna que o webhook grava sempre. OBRIGATÓRIA.
alter table public.subscriptions
  add column if not exists revenuecat_app_user_id text;

-- Opcionais (auditoria). O webhook grava se existirem; se não, degrada sem erro.
alter table public.subscriptions
  add column if not exists store text;          -- 'app_store' | 'play_store'
alter table public.subscriptions
  add column if not exists entitlement text;    -- 'pro'

-- Recarrega o schema cache do PostgREST (senão o webhook vê "column not found").
notify pgrst, 'reload schema';

-- ── Verificação (opcional) ─────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'subscriptions'
--   and column_name in ('revenuecat_app_user_id','store','entitlement');
