-- GAMIFICAÇÃO — STREAK FREEZE · parte 3b (consumir freeze pra preservar a ofensiva).
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
--
-- O streak de ACESSO é derivado 100% na leitura (calculateStreak anda de hoje
-- pra trás sobre user_activity, em fuso do DISPOSITIVO). NÃO mexemos no cálculo:
-- o "ponte" de um dia perdido é uma linha frozen=true em user_activity, que o
-- cálculo já conta como dia presente. Aqui só: coluna frozen + RPC de consumo.
--
-- LEMBRAR: 3a + 3b sobem JUNTOS pra produção (o freeze é inerte sem o consumo).

-- 1) Coluna de marcação. Linhas existentes viram frozen=false.
alter table public.user_activity
  add column if not exists frozen boolean not null default false;

-- 2) consume_freeze_for_gap(p_today): ponteia o buraco de dias perdidos imediatamente
-- antes de hoje, consumindo 1 freeze por dia — SÓ se cobrir o gap INTEIRO.
--
-- p_today vem do CLIENTE (mesma string de data local que recordActivityToday grava),
-- para o "hoje" bater exatamente com o que o usuário vê. NÃO usamos now()/BR para
-- definir hoje (só num guard leve contra input absurdo).
--
-- IDEMPOTÊNCIA: após pontear, o max(active_date) passa a ser o dia ponteado (ontem),
-- então uma 2ª chamada no mesmo dia calcula gap <= 0 e faz no-op — o decremento de
-- freezes acontece UMA vez naturalmente. O FOR UPDATE no profiles serializa chamadas
-- concorrentes (Home via useAccessStreak + layout via RecurringCheck no mesmo load),
-- garantindo que o segundo veja os dias já ponteados. Por isso decrementar gap_size
-- direto é correto e seguro.
create or replace function public.consume_freeze_for_gap(p_today date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_freezes integer;
  v_last    date;
  v_gap     integer;
  d         date;
begin
  if v_user is null then
    raise exception 'consume_freeze_for_gap: sem usuário autenticado';
  end if;

  -- Guard leve: relógio do cliente absurdamente à frente do horário BR.
  if p_today > ((now() at time zone 'America/Sao_Paulo')::date + 2) then
    return json_build_object('consumed', 0, 'streak_saved', false);
  end if;

  -- Serializa chamadas concorrentes do mesmo usuário.
  select streak_freezes into v_freezes
    from public.profiles where id = v_user for update;

  if coalesce(v_freezes, 0) = 0 then
    return json_build_object('consumed', 0, 'streak_saved', false);
  end if;

  -- Último dia ativo (frozen ou não) ANTES de hoje.
  select max(active_date) into v_last
    from public.user_activity
    where user_id = v_user and active_date < p_today;

  if v_last is null then
    return json_build_object('consumed', 0, 'streak_saved', false);
  end if;

  v_gap := (p_today - v_last) - 1;  -- nº de dias perdidos entre v_last e hoje

  -- Sem buraco (ontem já ativo) → nada a fazer.
  if v_gap <= 0 then
    return json_build_object('consumed', 0, 'streak_saved', false);
  end if;

  -- Gap maior que os freezes disponíveis → NÃO desperdiça (ofensiva quebra como hoje).
  if v_gap > v_freezes then
    return json_build_object('consumed', 0, 'streak_saved', false);
  end if;

  -- Ponteia cada dia perdido com frozen=true (ON CONFLICT garante idempotência).
  d := v_last + 1;
  while d < p_today loop
    insert into public.user_activity (user_id, active_date, frozen)
    values (v_user, d, true)
    on conflict (user_id, active_date) do nothing;
    d := d + 1;
  end loop;

  update public.profiles
    set streak_freezes = streak_freezes - v_gap
    where id = v_user;

  return json_build_object(
    'consumed', v_gap,
    'new_freezes', v_freezes - v_gap,
    'streak_saved', true
  );
end;
$$;

revoke all on function public.consume_freeze_for_gap(date) from public, anon;
grant execute on function public.consume_freeze_for_gap(date) to authenticated;

-- Sem isto o PostgREST não acha a função nova.
notify pgrst, 'reload schema';
