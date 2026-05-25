-- Log granular de push notifications enviadas (controle de frequência / dedup).
-- Diferente de push_history (1 linha por execução de cron), aqui guardamos
-- 1 linha por (user, type) para permitir consultas tipo "esse usuário já
-- recebeu 'budget_exceeded' nos últimos 7 dias?" ou "essa categoria já foi
-- notificada neste mês?".
-- Aplicar manualmente no Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS push_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- Convenções de type:
  --   budget_exceeded                              (gatilho da regra "1x por semana por user")
  --   budget_exceeded:<categoria>:<YYYY-MM>        (dedup mensal por categoria)
  --   due_tomorrow:<recurring_id>:<YYYY-MM>        (dedup por recorrente por mês)
  --   weekly_summary:<YYYY-Www>                    (dedup ISO week)
  type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_notification_log_user_type_sent_idx
  ON push_notification_log (user_id, type, sent_at DESC);

CREATE INDEX IF NOT EXISTS push_notification_log_sent_at_idx
  ON push_notification_log (sent_at DESC);

ALTER TABLE push_notification_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler / gerenciar. Os crons usam a service-role key
-- (admin client), que ignora RLS — então a política aqui só restringe
-- acesso via cliente autenticado.
DROP POLICY IF EXISTS "only admins read push_notification_log" ON push_notification_log;
CREATE POLICY "only admins read push_notification_log" ON push_notification_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );
