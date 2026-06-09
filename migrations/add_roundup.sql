-- TRILHA MISSÃO · M5 — Micro-aporte / Round-up (poupar no automático).
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
-- Só preferências + flag de histórico — sem RPC (o micro-aporte é uma
-- contribution normal do próprio usuário via RLS). profiles.id = auth.uid().

-- Preferências do round-up.
alter table public.profiles
  add column if not exists roundup_enabled boolean not null default false,
  add column if not exists roundup_multiple integer not null default 1
    check (roundup_multiple in (1, 5, 10));

-- Distingue o micro-aporte automático no histórico de depósitos.
alter table public.mission_contributions
  add column if not exists is_roundup boolean not null default false;

-- Sem isto o PostgREST não enxerga as colunas novas.
notify pgrst, 'reload schema';
