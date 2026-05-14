CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL, -- 'bug' | 'sugestao' | 'elogio' | 'outro'
  message text NOT NULL,
  page text,              -- tela onde estava quando enviou
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON feedback FOR ALL USING (auth.role() = 'service_role');
