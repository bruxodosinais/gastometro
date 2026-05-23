-- LGPD: consentimento de marketing e aceite de termos na tabela profiles.
-- terms_accepted_at já foi criada em 20260512_add_terms_accepted_at.sql; mantida aqui
-- como IF NOT EXISTS para que o arquivo descreva o estado completo da feature.
-- Aplicar manualmente no Supabase SQL Editor.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
