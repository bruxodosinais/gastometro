-- Habilita Row Level Security nas tabelas de dados do usuário que ainda
-- estavam sem proteção, e define policies "owner-only" baseadas em auth.uid().
--
-- Aplicar manualmente no Supabase SQL Editor antes do deploy. Sem RLS, a
-- anon key (exposta no frontend) consegue ler/gravar qualquer linha de
-- qualquer usuário — qualquer pessoa com a URL pública do Supabase
-- consegue dumpar a base inteira via PostgREST.
--
-- Tabelas já cobertas por RLS em migrations anteriores (não duplicar aqui):
--   profiles                  20260507_profiles_avatar_notifications.sql
--   savings_missions          20260522_missao_poupanca.sql
--   mission_contributions     20260522_missao_poupanca.sql
--   mission_challenges        20260522_missao_poupanca.sql
--   mission_badges            20260522_missao_poupanca.sql
--   subscriptions             20260513_subscriptions.sql
--   gastobot_usage            20260513_subscriptions.sql
--   admins / user_blocks      20260512_admin_system.sql
--   coupons                   20260514_coupons.sql
--   feedback                  20260514_feedback.sql
--   push_subscriptions        20260514_push_notifications.sql
--   push_history              20260514_push_notifications.sql
--   push_notification_log     20260524_push_notification_log.sql

-- expenses ---------------------------------------------------------------
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON expenses;
CREATE POLICY "users_own_data" ON expenses
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- recurring_expenses -----------------------------------------------------
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON recurring_expenses;
CREATE POLICY "users_own_data" ON recurring_expenses
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- monthly_plans ----------------------------------------------------------
ALTER TABLE monthly_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON monthly_plans;
CREATE POLICY "users_own_data" ON monthly_plans
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- budgets ----------------------------------------------------------------
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON budgets;
CREATE POLICY "users_own_data" ON budgets
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- credit_cards -----------------------------------------------------------
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON credit_cards;
CREATE POLICY "users_own_data" ON credit_cards
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- goals ------------------------------------------------------------------
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON goals;
CREATE POLICY "users_own_data" ON goals
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- goal_contributions -----------------------------------------------------
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON goal_contributions;
CREATE POLICY "users_own_data" ON goal_contributions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- assets -----------------------------------------------------------------
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON assets;
CREATE POLICY "users_own_data" ON assets
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- liabilities ------------------------------------------------------------
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON liabilities;
CREATE POLICY "users_own_data" ON liabilities
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- monthly_obligations ----------------------------------------------------
ALTER TABLE monthly_obligations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_data" ON monthly_obligations;
CREATE POLICY "users_own_data" ON monthly_obligations
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- avatars (Supabase Storage bucket) --------------------------------------
-- Convenção no app: o path do objeto é "<user_id>/<arquivo>.jpg" (ver
-- app/(app)/perfil/page.tsx). A primeira pasta do path tem que bater com
-- auth.uid() — assim cada usuário só mexe nos próprios objetos.
-- Leitura segue pública (bucket é public e a URL é gravada em
-- profiles.avatar_url para exibição).
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
