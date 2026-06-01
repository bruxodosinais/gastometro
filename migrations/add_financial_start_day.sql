ALTER TABLE profiles ADD COLUMN IF NOT EXISTS financial_start_day INT
  CHECK (financial_start_day >= 1 AND financial_start_day <= 31);
