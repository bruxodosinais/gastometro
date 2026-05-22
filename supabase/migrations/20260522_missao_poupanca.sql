CREATE TABLE savings_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  months INTEGER NOT NULL CHECK (months IN (3,6,12,18,24)),
  monthly_target NUMERIC(12,2) NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE NOT NULL,
  reminders_enabled BOOLEAN DEFAULT true,
  ai_challenges_enabled BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mission_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES savings_missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  month TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mission_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES savings_missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  month TEXT NOT NULL,
  challenge_text TEXT NOT NULL,
  potential_savings NUMERIC(12,2),
  accepted BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mission_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES savings_missions(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mission_id, badge_key)
);

ALTER TABLE savings_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own" ON savings_missions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own" ON mission_contributions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own" ON mission_challenges FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own" ON mission_badges FOR ALL USING (auth.uid() = user_id);
