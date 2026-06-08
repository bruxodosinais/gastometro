-- GAMIFICAÇÃO — STREAK MILESTONES · parte 4a (detecção + recompensa em MOEDAS).
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
--
-- A tabela streak_milestones já existe (Item 1): unique(user_id, milestone_days),
-- colunas milestone_days, unlocked_at, reward_claimed.
--
-- SEGURANÇA: o marco NÃO pode ser concedido na confiança do cliente (vira moeda
-- de graça). Esta RPC RECOMPUTA o streak no servidor a partir de user_activity
-- (maior sequência consecutiva, gaps-and-islands) e só concede se o usuário
-- REALMENTE atingiu o marco. Marco é PERMANENTE: usa a maior sequência já
-- existente, então não se perde se a ofensiva quebrar depois. Dias frozen (3b)
-- contam, pois estão em user_activity — o freeze preservou a ofensiva.
--
-- 4a NÃO mexe em Pro/billing: 30/365 (Pro grátis) e 100 (destaque) só dão moedas
-- + badge aqui; o Pro fica pro 4b (coluna própria). Por isso 365 dá coins 0.

create or replace function public.claim_streak_milestone(p_milestone_days int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_max_run integer;
  v_coins   integer;
begin
  if v_user is null then
    raise exception 'claim_streak_milestone: sem usuário autenticado';
  end if;

  if p_milestone_days not in (7, 14, 30, 60, 100, 365) then
    raise exception 'claim_streak_milestone: marco inválido: %', p_milestone_days;
  end if;

  -- Recompensa fixa no SERVIDOR. 365 = marco sem moeda (só badge / Pro no 4b).
  v_coins := case p_milestone_days
    when 7   then 100
    when 14  then 200
    when 30  then 300
    when 60  then 500
    when 100 then 1000
    when 365 then 0
  end;

  -- Maior sequência consecutiva de dias ativos (gaps-and-islands): dias
  -- consecutivos têm (active_date - row_number) constante; agrupa e pega o maior.
  select coalesce(max(cnt), 0) into v_max_run from (
    select count(*) cnt from (
      select active_date - (row_number() over (order by active_date))::int as grp
      from public.user_activity
      where user_id = v_user
    ) d
    group by grp
  ) t;

  -- ANTI-CHEAT: não atingiu de verdade → não concede.
  if v_max_run < p_milestone_days then
    return json_build_object('unlocked', false, 'reason', 'not_reached');
  end if;

  -- Idempotência: o unique(user_id, milestone_days) + DO NOTHING garante que a
  -- recompensa seja concedida UMA vez. FOUND = true só quando inseriu de fato.
  insert into public.streak_milestones (user_id, milestone_days, reward_claimed)
  values (v_user, p_milestone_days, true)
  on conflict (user_id, milestone_days) do nothing;

  if not found then
    return json_build_object('unlocked', false, 'already', true);
  end if;

  -- Novo marco: credita moedas (se houver). O trigger do Item 1 atualiza o saldo.
  if v_coins > 0 then
    insert into public.coin_transactions (user_id, amount, type, description)
    values (v_user, v_coins, 'milestone_reward', 'Marco de ' || p_milestone_days || ' dias');
  end if;

  return json_build_object(
    'unlocked', true,
    'milestone_days', p_milestone_days,
    'coins', v_coins
  );
end;
$$;

revoke all on function public.claim_streak_milestone(int) from public, anon;
grant execute on function public.claim_streak_milestone(int) to authenticated;

-- Sem isto o PostgREST não acha a função nova.
notify pgrst, 'reload schema';
