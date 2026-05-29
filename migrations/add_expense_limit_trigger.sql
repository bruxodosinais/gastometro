-- CRÍTICO #6 — Limite de plano (20 lançamentos/mês no free) imposto no servidor.
-- Backstop contra bypass da UI (chamada direta ao Supabase/PostgREST).
-- Rodar manualmente no Supabase Dashboard (SQL Editor).
--
-- Decisões de segurança/consistência (divergem do rascunho original de propósito):
--   • Receitas (type <> 'expense') NUNCA são contadas nem bloqueadas — receita é
--     ilimitada no free; sem isso, o usuário free seria travado ao logar receita.
--   • Inserts auto-gerados de recorrentes (recurring_expense_id IS NOT NULL) passam
--     direto — senão o auto-lançamento (checkAndLaunchRecurring) quebraria no limite.
--   • A contagem usa o mês da PRÓPRIA linha inserida (NEW.date), não CURRENT_DATE,
--     evitando drift de fuso (servidor UTC) e batendo com a contagem por-mês da UI.
--   • Conta só lançamentos manuais de gasto do mês (espelha monthExpenseCount da UI).

CREATE OR REPLACE FUNCTION check_expense_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text;
  v_count int;
  v_limit int := 20;
BEGIN
  -- Receita e recorrente auto-gerada: liberados sempre.
  IF NEW.type IS DISTINCT FROM 'expense' OR NEW.recurring_expense_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO v_plan
  FROM subscriptions
  WHERE user_id = NEW.user_id
    AND status = 'active'
  LIMIT 1;

  -- pro (qualquer ciclo) não tem limite
  IF v_plan = 'pro' THEN
    RETURN NEW;
  END IF;

  -- conta apenas lançamentos manuais de GASTO do mês da linha sendo inserida
  SELECT COUNT(*) INTO v_count
  FROM expenses
  WHERE user_id = NEW.user_id
    AND type = 'expense'
    AND recurring_expense_id IS NULL
    AND date_trunc('month', date::date) = date_trunc('month', NEW.date::date);

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_expense_plan_limit ON expenses;
CREATE TRIGGER enforce_expense_plan_limit
  BEFORE INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION check_expense_plan_limit();
