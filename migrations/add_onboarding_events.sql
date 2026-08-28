-- FUNIL DE ONBOARDING — rastreio passo a passo (pré-cadastro + pós-cadastro).
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
--
-- POR QUE: até aqui a única evidência de onboarding era o booleano
-- user_metadata.onboarding_completed, gravado só no FIM — e também quando o
-- usuário aperta "Pular tudo" na tela 0. Ou seja: não dava para saber em que
-- passo alguém desiste, e "100% completou" incluía quem pulou tudo.
--
-- anon_id: id do DISPOSITIVO (localStorage), gerado antes do cadastro. É o que
-- costura o funil pré-cadastro (carrossel → quiz → paywall → cadastro), quando
-- ainda não existe user_id. Depois do cadastro os eventos carregam os dois, o
-- que permite ligar a sessão anônima à conta criada.
--
-- user_id ON DELETE SET NULL (e não CASCADE): apagar uma conta não pode apagar
-- o histórico do funil — senão a taxa de conversão passada muda sozinha.

create table if not exists public.onboarding_events (
  id         bigserial primary key,
  anon_id    text not null,
  user_id    uuid references auth.users(id) on delete set null,
  step       text not null,
  action     text not null,
  platform   text,
  created_at timestamptz not null default now()
);

-- Primeiro toque por (device, passo, ação). O insert usa ON CONFLICT DO NOTHING:
-- reentrar no mesmo passo não infla o funil e a tabela não cresce sem limite.
-- Efeito colateral aceito: não medimos quantas VEZES alguém repetiu um passo.
create unique index if not exists onboarding_events_first_touch
  on public.onboarding_events (anon_id, step, action);

create index if not exists onboarding_events_created_at
  on public.onboarding_events (created_at desc);
create index if not exists onboarding_events_user_id
  on public.onboarding_events (user_id) where user_id is not null;

-- RLS LIGADA E SEM NENHUMA POLICY: nem anon nem authenticated leem ou escrevem
-- direto. Toda escrita passa por /api/onboarding/track (service role, com rate
-- limit e allowlist de passos) e toda leitura por /api/admin/onboarding.
alter table public.onboarding_events enable row level security;

notify pgrst, 'reload schema';
