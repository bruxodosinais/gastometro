-- CRÍTICO #4b — Resgate atômico de cupom.
-- Substitui o read-check-write (lê uses, checa < max_uses, grava uses+1) que
-- permitia a dois resgates concorrentes ultrapassarem max_uses.
-- Rodar manualmente no Supabase Dashboard (SQL Editor).
--
-- A validação (ativo / expirado / esgotado) e o incremento acontecem na MESMA
-- função. O incremento é um UPDATE condicional com RETURNING: sob READ COMMITTED,
-- dois resgates simultâneos serializam na trava da linha e o segundo reavalia
-- `uses < max_uses` já com o valor incrementado — impedindo o estouro do limite.
-- Convenção mantida do código atual: max_uses = 0 significa ILIMITADO.

CREATE OR REPLACE FUNCTION redeem_coupon(p_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon  record;
  v_updated record;
BEGIN
  SELECT * INTO v_coupon FROM coupons WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Cupom não encontrado.');
  END IF;

  IF v_coupon.active = false THEN
    RETURN json_build_object('ok', false, 'error', 'Cupom inativo.');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN json_build_object('ok', false, 'error', 'Cupom expirado.');
  END IF;

  -- Incremento atômico e condicional. max_uses = 0 = ilimitado.
  UPDATE coupons
  SET uses = uses + 1
  WHERE id = v_coupon.id
    AND (max_uses = 0 OR uses < max_uses)
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Cupom esgotado.');
  END IF;

  RETURN json_build_object('ok', true, 'coupon', row_to_json(v_updated));
END;
$$;
