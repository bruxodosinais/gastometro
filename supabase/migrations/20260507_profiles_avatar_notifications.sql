-- Cria tabela profiles (se não existir) com colunas para avatar e preferências de notificação.
-- Aplicar manualmente no Supabase SQL Editor.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  avatar_emoji text,
  notification_preferences jsonb default '{"due_date_alerts": true, "weekly_email_summary": false}'::jsonb,
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

drop policy if exists "Users can upsert own profile" on profiles;
create policy "Users can upsert own profile"
  on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- Se a tabela já existir, adicionar colunas faltantes
do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'avatar_url') then
    alter table profiles add column avatar_url text;
  end if;
  if not exists (select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'avatar_emoji') then
    alter table profiles add column avatar_emoji text;
  end if;
  if not exists (select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'notification_preferences') then
    alter table profiles add column notification_preferences jsonb
      default '{"due_date_alerts": true, "weekly_email_summary": false}'::jsonb;
  end if;
end $$;
