-- TRILHA MISSÃO · M4 — Completar desafio de IA dá +100 🪙 e marca concluído.
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
--
-- "Completar" = "já guardei esse valor": o APORTE em si é criado pelo fluxo
-- normal (addContribution, que já dá +50 via M1 e dispara marcos da meta M2).
-- Esta RPC só MARCA o desafio como concluído e credita o +100 do desafio.
-- O tipo 'ai_challenge' já existe no CoinTransactionType; nunca era chamado.

-- 1) Colunas de conclusão. mission_challenges já tem RLS (FOR ALL own).
alter table public.mission_challenges
  add column if not exists completed boolean not null default false,
  add column if not exists completed_at timestamptz;

-- 2) RPC: marca concluído (idempotente) + credita +100. SECURITY DEFINER,
-- ownership por auth.uid(). FOR UPDATE serializa cliques concorrentes.
create or replace function public.complete_challenge(p_challenge_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_completed boolean;
  v_dismissed boolean;
begin
  if v_user is null then
    raise exception 'complete_challenge: sem usuário autenticado';
  end if;

  select completed, dismissed into v_completed, v_dismissed
    from public.mission_challenges
    where id = p_challenge_id and user_id = v_user
    for update;

  if not found then
    return json_build_object('ok', false, 'reason', 'not_owner');
  end if;
  if v_dismissed then
    return json_build_object('ok', false, 'reason', 'dismissed');
  end if;
  if v_completed then
    -- Idempotente: não credita moeda 2x.
    return json_build_object('ok', false, 'already', true);
  end if;

  update public.mission_challenges
    set completed = true, completed_at = now()
    where id = p_challenge_id and user_id = v_user;

  -- +100 do desafio. O trigger do Item 1 atualiza o saldo.
  insert into public.coin_transactions (user_id, amount, type, description)
  values (v_user, 100, 'ai_challenge', '🤖 Desafio de IA concluído');

  return json_build_object('ok', true, 'coins', 100);
end;
$$;

revoke all on function public.complete_challenge(uuid) from public, anon;
grant execute on function public.complete_challenge(uuid) to authenticated;

-- Sem isto o PostgREST não acha a função nova.
notify pgrst, 'reload schema';
