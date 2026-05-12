-- Tabela admins
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_own" ON admins FOR ALL USING (auth.uid() = user_id);

-- Tabela user_blocks (para bloquear usuários)
CREATE TABLE IF NOT EXISTS user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_at timestamptz DEFAULT now(),
  blocked_by uuid REFERENCES auth.users(id),
  reason text
);
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Inserir admin inicial
INSERT INTO admins (user_id) VALUES ('fb268455-d27e-44e3-ab16-aac327f2a1e6') ON CONFLICT DO NOTHING;
