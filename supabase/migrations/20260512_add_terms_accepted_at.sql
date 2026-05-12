-- Adiciona coluna terms_accepted_at na tabela profiles para conformidade LGPD.
-- Aplicar manualmente no Supabase SQL Editor.

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'terms_accepted_at') then
    alter table profiles add column terms_accepted_at timestamptz;
  end if;
end $$;
