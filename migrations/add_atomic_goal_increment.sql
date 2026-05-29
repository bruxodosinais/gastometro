-- CRÍTICO #4a — Incremento atômico de current_amount em goals.
-- Evita lost update quando dois aportes concorrentes leem/somam/gravam em JS.
-- Rodar manualmente no Supabase Dashboard (SQL Editor).
--
-- SECURITY DEFINER + filtro user_id = auth.uid(): a função roda com privilégio
-- elevado mas só altera a meta do próprio usuário autenticado (respeita o dono
-- mesmo bypassando RLS internamente). search_path fixo evita hijack de schema.

CREATE OR REPLACE FUNCTION increment_goal_amount(p_goal_id uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_amount numeric;
BEGIN
  UPDATE goals
  SET current_amount = current_amount + p_delta
  WHERE id = p_goal_id AND user_id = auth.uid()
  RETURNING current_amount INTO v_new_amount;

  IF v_new_amount IS NULL THEN
    RAISE EXCEPTION 'Meta não encontrada ou acesso negado';
  END IF;

  RETURN v_new_amount;
END;
$$;
