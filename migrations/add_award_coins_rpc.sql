-- GAMIFICAÇÃO — MOTOR DE GANHO DE MOEDAS (Fase 1 · Item 2).
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
--
-- award_coins(p_type): credita moedas com VALOR FIXO definido no banco. O app
-- só diz QUAL ação aconteceu — nunca escolhe o valor nem insere transação
-- direto. O usuário vem de auth.uid() DENTRO da função (nunca por parâmetro),
-- então é impossível creditar outro usuário. A função só insere em
-- coin_transactions; o trigger trg_apply_coin_transaction (Item 1) cuida do
-- balance/total_earned automaticamente.
--
-- Idempotência por período (fuso America/Sao_Paulo, igual ao streak de acesso):
--   app_open       → no máx. 1x por DIA
--   month_positive → no máx. 1x por MÊS
--   weekly_streak  → no máx. 1x por SEMANA ISO
-- Os demais creditam a cada ação. Tipos de valor variável/negativo
-- (milestone_reward, challenge_reward, shop_purchase, freeze_purchase) são
-- REJEITADOS aqui — virão em funções próprias nos Itens 3/6.

create or replace function public.award_coins(p_type text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_amt   integer;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user is null then
    raise exception 'award_coins: sem usuário autenticado';
  end if;

  v_amt := case p_type
    when 'app_open'             then 5
    when 'expense_logged'       then 10
    when 'recurring_paid'       then 15
    when 'mission_contribution' then 50
    when 'ai_challenge'         then 100
    when 'month_positive'       then 200
    when 'weekly_streak'        then 75
    else null
  end;

  if v_amt is null then
    raise exception 'award_coins: tipo inválido ou de valor variável: %', p_type;
  end if;

  -- TODO (refinamento futuro): cap diário anti-abuso por tipo (ex.: no máx. N
  -- expense_logged/dia) para evitar farm de moedas lançando e apagando.

  -- idempotência por período (fuso BR)
  if p_type = 'app_open' then
    if exists (select 1 from public.coin_transactions
               where user_id = v_user and type = 'app_open'
                 and (created_at at time zone 'America/Sao_Paulo')::date = v_today) then
      return 0;
    end if;
  elsif p_type = 'month_positive' then
    if exists (select 1 from public.coin_transactions
               where user_id = v_user and type = 'month_positive'
                 and to_char(created_at at time zone 'America/Sao_Paulo','YYYY-MM')
                   = to_char(v_today,'YYYY-MM')) then
      return 0;
    end if;
  elsif p_type = 'weekly_streak' then
    if exists (select 1 from public.coin_transactions
               where user_id = v_user and type = 'weekly_streak'
                 and to_char(created_at at time zone 'America/Sao_Paulo','IYYY"-W"IW')
                   = to_char(v_today,'IYYY"-W"IW')) then
      return 0;
    end if;
  end if;

  insert into public.coin_transactions (user_id, amount, type, description)
  values (v_user, v_amt, p_type, null);

  return v_amt;
end;
$$;

revoke all on function public.award_coins(text) from public, anon;
grant execute on function public.award_coins(text) to authenticated;

-- Defesa em profundidade: agora que o crédito é SÓ via award_coins, remover o
-- INSERT direto do usuário em coin_transactions (criado no Item 1 como
-- "coin_transactions_insert_own"). A policy de SELECT continua intacta — o
-- usuário ainda lê o próprio extrato, mas não consegue mais inserir à mão.
drop policy if exists "coin_transactions_insert_own" on public.coin_transactions;
