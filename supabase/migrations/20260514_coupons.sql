-- Cupons de trial Pro
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  days integer NOT NULL DEFAULT 30,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON coupons
  FOR ALL USING (auth.role() = 'service_role');
