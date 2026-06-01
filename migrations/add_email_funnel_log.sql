CREATE TABLE IF NOT EXISTS email_funnel_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  email_type  TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_funnel_log_unique UNIQUE (user_id, email_type)
);
-- sem RLS — acesso só via service_role no cron
