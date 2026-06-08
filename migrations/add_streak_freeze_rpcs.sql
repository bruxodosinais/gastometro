-- GAMIFICAÇÃO — STREAK FREEZE · parte 3a (ganhar 1/semana + comprar com moedas).
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
--
-- As colunas profiles.streak_freezes (integer, CHECK between 0 and 2) e
-- profiles.streak_last_freeze_week (text) JÁ existem desde o Item 1. NÃO criar
-- tabela. profiles tem chave `id` (não user_id) → filtrar por id = auth.uid().
--
-- Mesmo princípio do award_coins: o BANCO decide valores/regras; o cliente só
-- dispara a ação. Ambas SECURITY DEFINER, usuário via auth.uid() interno,
-- grant execute só para authenticated. Esta etapa NÃO mexe no cálculo do
-- streak nem no consumo do freeze (isso é o 3b).

-- ─────────────────────────────────────────────────────────────────────────────
-- grant_weekly_freeze(): +1 freeze grátis por SEMANA ISO (fuso BR), idempotente.
-- Se já ganhou nesta semana → no-op. Senão marca a semana atual e, se houver
-- espaço (< 2), incrementa. Cheio (== 2): marca a semana mas não incrementa
-- ("use ou perca", comportamento esperado).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.grant_weekly_freeze()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_week    text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'IYYY"-W"IW');
  v_last    text;
  v_freezes integer;
  v_granted boolean := false;
begin
  if v_user is null then
    raise exception 'grant_weekly_freeze: sem usuário autenticado';
  end if;

  -- FOR UPDATE serializa concorrência sobre a própria linha do usuário.
  select streak_last_freeze_week, streak_freezes
    into v_last, v_freezes
    from public.profiles
    where id = v_user
    for update;

  -- Já ganhou nesta semana → no-op.
  if v_last is not distinct from v_week then
    return json_build_object('granted', false, 'new_freezes', v_freezes);
  end if;

  if v_freezes < 2 then
    update public.profiles
      set streak_freezes = streak_freezes + 1,
          streak_last_freeze_week = v_week
      where id = v_user
      returning streak_freezes into v_freezes;
    v_granted := true;
  else
    update public.profiles
      set streak_last_freeze_week = v_week
      where id = v_user;
  end if;

  return json_build_object('granted', v_granted, 'new_freezes', v_freezes);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- buy_streak_freeze(): compra 1 freeze por 50 🪙 (custo FIXO na função, atômico).
-- max 2 → {ok:false, reason:'max'}; saldo < 50 → {ok:false, reason:'coins'}.
-- Sucesso: insere -50 em coin_transactions (o trigger do Item 1 debita o
-- balance) E incrementa streak_freezes. Os CHECKs (balance>=0, freezes 0..2)
-- são o backstop; as validações aqui são para UX amigável.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.buy_streak_freeze()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_cost    integer := 50;
  v_freezes integer;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'buy_streak_freeze: sem usuário autenticado';
  end if;

  -- FOR UPDATE na linha do profile serializa compras concorrentes do usuário.
  select streak_freezes into v_freezes
    from public.profiles where id = v_user for update;

  if v_freezes >= 2 then
    return json_build_object('ok', false, 'reason', 'max');
  end if;

  select balance into v_balance
    from public.user_coins where user_id = v_user;
  v_balance := coalesce(v_balance, 0);

  if v_balance < v_cost then
    return json_build_object('ok', false, 'reason', 'coins');
  end if;

  -- Debita via livro-razão (trigger atualiza user_coins.balance) ...
  insert into public.coin_transactions (user_id, amount, type, description)
  values (v_user, -v_cost, 'freeze_purchase', 'Compra de Streak Freeze');

  -- ... e incrementa o contador de freezes.
  update public.profiles
    set streak_freezes = streak_freezes + 1
    where id = v_user
    returning streak_freezes into v_freezes;

  return json_build_object(
    'ok', true,
    'new_freezes', v_freezes,
    'new_balance', v_balance - v_cost
  );
end;
$$;

revoke all on function public.grant_weekly_freeze() from public, anon;
grant execute on function public.grant_weekly_freeze() to authenticated;
revoke all on function public.buy_streak_freeze() from public, anon;
grant execute on function public.buy_streak_freeze() to authenticated;

-- Sem isto o PostgREST não acha as funções novas (aconteceu no Item 2).
notify pgrst, 'reload schema';
