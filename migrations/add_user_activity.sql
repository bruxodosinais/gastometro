-- Streak por ACESSO: registra os dias em que o usuário abriu o app.
-- Fonte de verdade única no servidor (antes era localStorage, que não
-- sincroniza entre dispositivos e é despejado pelo navegador mobile).
-- active_date é a data LOCAL do usuário, gravada pelo cliente (não NOW()),
-- para casar com o cálculo de "hoje" feito em horário local na UI.
CREATE TABLE IF NOT EXISTS user_activity (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_date DATE NOT NULL,
  PRIMARY KEY (user_id, active_date)
);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_activity_select_own" ON user_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_activity_insert_own" ON user_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);
