-- Web Push Notifications (N1+N2)
-- Aplicar manualmente no Supabase SQL Editor.

-- Subscriptions de push por usuário (um usuário pode ter mais de um device/endpoint).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own subscriptions" ON push_subscriptions;
CREATE POLICY "users manage own subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Preferências de notificação push por usuário.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_due_tomorrow boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_budget_exceeded boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_weekly_summary boolean NOT NULL DEFAULT true;

-- Histórico de pushes enviados (manuais pelo admin ou via cron).
CREATE TABLE IF NOT EXISTS push_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  target text NOT NULL,                       -- 'all' | 'pro' | 'free' | 'user' | 'cron:due-tomorrow' | 'cron:budget-exceeded'
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_history_created_at_idx
  ON push_history (created_at DESC);

ALTER TABLE push_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "only admins read push_history" ON push_history;
CREATE POLICY "only admins read push_history" ON push_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );
