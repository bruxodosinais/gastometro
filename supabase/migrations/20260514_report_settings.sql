-- Adiciona preferências de relatório por e-mail (semanal e mensal) na tabela profiles.
-- Aplicar manualmente no Supabase SQL Editor.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  email_report_weekly boolean NOT NULL DEFAULT true;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  email_report_monthly boolean NOT NULL DEFAULT true;
