-- GAMIFICAÇÃO — FUNDAÇÃO (Fase 1 · Item 1): Moedas, Milestones, Desafios.
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
--
-- Esta migration é só o alicerce: tabelas, RLS, trigger de saldo e índices.
-- Nada de lógica de ganho/gasto de moedas aqui (vem no Item 2).
--
-- DECISÕES DE ARQUITETURA (travadas):
--   • coin_transactions é o LIVRO-RAZÃO append-only (imutável). user_coins.balance
--     é saldo DERIVADO dele, mantido por TRIGGER no Postgres — o app nunca escreve
--     em user_coins, só insere a transação. Saldo não pode divergir do extrato.
--   • O trigger usa SECURITY DEFINER (escreve em user_coins ignorando o RLS do
--     usuário), mas só age sobre o user_id da própria transação inserida.
--   • Idempotência de recompensas via UNIQUE em streak_milestones e
--     weekly_challenges — moeda é dinheiro do jogo; conceder 2x é crítico.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) user_coins: saldo atual (1 linha por usuário, escrito SÓ pelo trigger)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_coins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) coin_transactions: livro-razão append-only
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,                 -- positivo = ganho, negativo = gasto
  type text not null,                       -- 'expense_logged','recurring_paid','app_open',
                                            -- 'mission_contribution','ai_challenge','month_positive',
                                            -- 'weekly_streak','milestone_reward','challenge_reward',
                                            -- 'shop_purchase','freeze_purchase'
  description text,
  created_at timestamptz not null default now()
);
create index if not exists idx_coin_tx_user_created
  on public.coin_transactions (user_id, created_at desc);

-- 2b) TRIGGER: mantém user_coins em sincronia a cada transação inserida.
-- SECURITY DEFINER + search_path fixo (mesmo padrão de increment_goal_amount
-- e check_expense_plan_limit). Cria a linha do usuário se não existir; soma no
-- balance e — quando amount > 0 — soma também em total_earned.
--
-- UPDATE-first (não INSERT ... ON CONFLICT): com amount negativo (gasto), o
-- ON CONFLICT avaliava o CHECK (balance >= 0) na linha CANDIDATA do INSERT
-- (balance = amount = -4) ANTES de cair no DO UPDATE, estourando erro 23514 e
-- quebrando qualquer gasto. Fazendo UPDATE primeiro, o CHECK só roda sobre o
-- saldo já somado (balance + new.amount), que é o comportamento correto — e o
-- CHECK continua protegendo contra gastar mais do que se tem.
create or replace function public.apply_coin_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_coins
    set balance      = balance + new.amount,
        total_earned = total_earned + greatest(new.amount, 0),
        updated_at   = now()
  where user_id = new.user_id;

  if not found then
    insert into public.user_coins (user_id, balance, total_earned, updated_at)
    values (new.user_id, new.amount, greatest(new.amount, 0), now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_coin_transaction on public.coin_transactions;
create trigger trg_apply_coin_transaction
  after insert on public.coin_transactions
  for each row execute function public.apply_coin_transaction();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) streak_milestones: marcos atingidos + controle de recompensa
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.streak_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_days integer not null,          -- 7,14,30,60,100,365
  unlocked_at timestamptz not null default now(),
  reward_claimed boolean not null default false,
  unique (user_id, milestone_days)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) weekly_challenges: desafios da semana por usuário
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.weekly_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week text not null,                       -- ISO 'YYYY-Www' (ex '2026-W24')
  challenge_type text not null,             -- 'log_5_days','no_category_overflow',
                                            -- 'mission_contribution','categorize_card',
                                            -- 'positive_week','open_app_7_days'
  target integer not null default 1,
  progress integer not null default 0,
  completed boolean not null default false,
  reward_coins integer not null default 0,
  accepted_at timestamptz,                  -- null = oferecido mas não aceito
  completed_at timestamptz,
  unique (user_id, week, challenge_type)
);
create index if not exists idx_weekly_challenges_user_week
  on public.weekly_challenges (user_id, week);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Streak Freeze: colunas em profiles (Pilar 2). profiles já tem RLS — só
--    adicionamos colunas, sem recriar policies.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists streak_freezes integer not null default 0
    check (streak_freezes >= 0 and streak_freezes <= 2),
  add column if not exists streak_last_freeze_week text;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — estilo granular nomeado (igual user_activity / enable_rls.sql).
-- DROP POLICY IF EXISTS antes de CREATE para a migration ser re-executável.
-- ─────────────────────────────────────────────────────────────────────────────

-- user_coins → APENAS SELECT (escrita só pelo trigger; sem INSERT/UPDATE/DELETE).
alter table public.user_coins enable row level security;
drop policy if exists "user_coins_select_own" on public.user_coins;
create policy "user_coins_select_own" on public.user_coins
  for select using (auth.uid() = user_id);

-- coin_transactions → SELECT + INSERT (livro-razão imutável; sem UPDATE/DELETE).
alter table public.coin_transactions enable row level security;
drop policy if exists "coin_transactions_select_own" on public.coin_transactions;
create policy "coin_transactions_select_own" on public.coin_transactions
  for select using (auth.uid() = user_id);
drop policy if exists "coin_transactions_insert_own" on public.coin_transactions;
create policy "coin_transactions_insert_own" on public.coin_transactions
  for insert with check (auth.uid() = user_id);

-- streak_milestones → SELECT + INSERT + UPDATE.
alter table public.streak_milestones enable row level security;
drop policy if exists "streak_milestones_select_own" on public.streak_milestones;
create policy "streak_milestones_select_own" on public.streak_milestones
  for select using (auth.uid() = user_id);
drop policy if exists "streak_milestones_insert_own" on public.streak_milestones;
create policy "streak_milestones_insert_own" on public.streak_milestones
  for insert with check (auth.uid() = user_id);
drop policy if exists "streak_milestones_update_own" on public.streak_milestones;
create policy "streak_milestones_update_own" on public.streak_milestones
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- weekly_challenges → SELECT + INSERT + UPDATE.
alter table public.weekly_challenges enable row level security;
drop policy if exists "weekly_challenges_select_own" on public.weekly_challenges;
create policy "weekly_challenges_select_own" on public.weekly_challenges
  for select using (auth.uid() = user_id);
drop policy if exists "weekly_challenges_insert_own" on public.weekly_challenges;
create policy "weekly_challenges_insert_own" on public.weekly_challenges
  for insert with check (auth.uid() = user_id);
drop policy if exists "weekly_challenges_update_own" on public.weekly_challenges;
create policy "weekly_challenges_update_own" on public.weekly_challenges
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
