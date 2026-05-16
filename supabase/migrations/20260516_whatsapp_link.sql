-- Vinculação de número WhatsApp ao perfil (W2 do roadmap).
-- Aplicar manualmente no Supabase SQL Editor.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_verified boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_otp text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_otp_expires_at timestamptz;
