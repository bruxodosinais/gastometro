-- Relaxa o CHECK de `months` para aceitar qualquer prazo de 1 a 60 meses,
-- permitindo o input "Outro prazo" no wizard de criação da missão (antes era
-- restrito ao conjunto fixo de pills 3/6/12/18/24).

ALTER TABLE savings_missions DROP CONSTRAINT IF EXISTS savings_missions_months_check;
ALTER TABLE savings_missions ADD CONSTRAINT savings_missions_months_check
  CHECK (months BETWEEN 1 AND 60);
