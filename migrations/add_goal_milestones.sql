-- TRILHA MISSÃO · M2 — Marcos da Meta em moedas (25/50/75/100%).
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
--
-- Gêmeo do claim_streak_milestone (Item 4a), mas sobre o % da META de poupança.
-- Server-authoritative (recompute do total a partir de mission_contributions),
-- idempotente POR MISSÃO (cada missão tem sua jornada 25/50/75/100), com guard
-- anti-farming. NÃO mexe em billing nem nos badges existentes da Missão.

-- 1) Tabela de marcos de meta reivindicados (1 por missão/percent).
create table if not exists public.mission_goal_milestones (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.savings_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  percent integer not null,                 -- 25, 50, 75, 100
  unlocked_at timestamptz not null default now(),
  reward_coins integer not null default 0,  -- 0 quando guard anti-farming zera
  unique (mission_id, percent)
);

-- RLS: usuário lê os próprios marcos; escrita só via RPC (SECURITY DEFINER).
alter table public.mission_goal_milestones enable row level security;
drop policy if exists "mission_goal_milestones_select_own" on public.mission_goal_milestones;
create policy "mission_goal_milestones_select_own" on public.mission_goal_milestones
  for select using (auth.uid() = user_id);

-- 2) RPC: reivindica um marco de meta. Recompute server-side + anti-cheat +
-- anti-farming + idempotência via unique(mission_id, percent).
create or replace function public.claim_goal_milestone(p_mission_id uuid, p_percent int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_target numeric;
  v_saved  numeric;
  v_pct    numeric;
  v_coins  integer;
begin
  if v_user is null then
    raise exception 'claim_goal_milestone: sem usuário autenticado';
  end if;

  if p_percent not in (25, 50, 75, 100) then
    raise exception 'claim_goal_milestone: percent inválido: %', p_percent;
  end if;

  -- Ownership server-side: só a missão do próprio usuário.
  select target_amount into v_target
    from public.savings_missions
    where id = p_mission_id and user_id = v_user;

  if v_target is null then
    return json_build_object('unlocked', false, 'reason', 'not_owner');
  end if;

  -- Recompute do total guardado (autoridade do servidor; não confia no cliente).
  select coalesce(sum(amount), 0) into v_saved
    from public.mission_contributions
    where mission_id = p_mission_id and user_id = v_user;

  v_pct := case when v_target > 0 then (v_saved / v_target) * 100 else 0 end;

  -- ANTI-CHEAT: não atingiu de verdade → não registra nada.
  if v_pct < p_percent then
    return json_build_object('unlocked', false, 'reason', 'not_reached');
  end if;

  v_coins := case p_percent
    when 25  then 100
    when 50  then 250
    when 75  then 500
    when 100 then 1000
  end;

  -- ANTI-FARMING: metas pequenas (< R$1.000) registram o marco mas com 0 moeda.
  if v_target < 1000 then
    v_coins := 0;
  end if;

  -- Idempotência POR MISSÃO: unique(mission_id, percent) + DO NOTHING.
  -- FOUND = true só quando inseriu de fato.
  insert into public.mission_goal_milestones (mission_id, user_id, percent, reward_coins)
  values (p_mission_id, v_user, p_percent, v_coins)
  on conflict (mission_id, percent) do nothing;

  if not found then
    return json_build_object('unlocked', false, 'already', true);
  end if;

  -- Novo marco: credita (se houver). O trigger do Item 1 atualiza o saldo.
  if v_coins > 0 then
    insert into public.coin_transactions (user_id, amount, type, description)
    values (v_user, v_coins, 'goal_milestone_reward', '🎯 Marco de ' || p_percent || '% da meta');
  end if;

  return json_build_object('unlocked', true, 'percent', p_percent, 'coins', v_coins);
end;
$$;

revoke all on function public.claim_goal_milestone(uuid, int) from public, anon;
grant execute on function public.claim_goal_milestone(uuid, int) to authenticated;

-- Sem isto o PostgREST não acha a função nova.
notify pgrst, 'reload schema';
