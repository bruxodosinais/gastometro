-- Tabela de assinaturas (plano free/pro, integração Kiwify)
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',          -- 'free' | 'pro'
  billing_cycle text,                          -- 'monthly' | 'annual' | null
  status text NOT NULL DEFAULT 'active',      -- 'active' | 'cancelled' | 'past_due'
  kiwify_order_id text,
  kiwify_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role bypassa RLS por padrão; mantemos a policy explícita por clareza.
CREATE POLICY "Service role full access"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tabela auxiliar de uso do GastôBot (contador mensal por usuário)
CREATE TABLE IF NOT EXISTS gastobot_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month text NOT NULL,                         -- YYYY-MM
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE gastobot_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gastobot usage"
  ON gastobot_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gastobot usage"
  ON gastobot_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gastobot usage"
  ON gastobot_usage FOR UPDATE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS gastobot_usage_updated_at ON gastobot_usage;
CREATE TRIGGER gastobot_usage_updated_at
  BEFORE UPDATE ON gastobot_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Inserir registro free para todos os usuários existentes que não têm subscription
INSERT INTO subscriptions (user_id, plan, status)
SELECT id, 'free', 'active' FROM auth.users
WHERE id NOT IN (SELECT user_id FROM subscriptions);
