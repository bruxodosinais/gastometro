-- SEGURANÇA — Anti-cheat do streak de acesso (endurecer INSERT em user_activity).
-- Rodar manualmente no Supabase Dashboard (SQL Editor). NÃO aplicar via app.
--
-- PROBLEMA: a policy de INSERT atual ("user_activity_insert_own") só checa
-- auth.uid() = user_id, então o usuário pode inserir QUALQUER active_date direto
-- pelo client e forjar uma ofensiva (ex.: 30 dias seguidos) sem nunca ter aberto
-- o app — e então reivindicar streak milestones (que dão moeda).
--
-- FIX: restringe o INSERT do usuário a:
--   • active_date dentro de [hoje_BR - 1, hoje_BR + 1]. A tolerância de ±1 dia
--     acomoda recordActivityToday gravar a data LOCAL do DISPOSITIVO, que perto
--     da meia-noite pode diferir 1 dia do servidor. Permite gravar "hoje",
--     bloqueia montar sequência de dias antigos/futuros.
--   • frozen = false. Dias frozen só entram pela RPC consume_freeze_for_gap
--     (3b), que é SECURITY DEFINER e BYPASSA a RLS — esta policy NÃO a afeta.
--
-- NÃO mexe em recordActivityToday, calculateStreak nem consume_freeze_for_gap.
-- A policy de SELECT ("user_activity_select_own") fica intacta.

drop policy if exists "user_activity_insert_own" on public.user_activity;

create policy "user_activity_insert_own" on public.user_activity
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and frozen = false
    and active_date between (now() at time zone 'America/Sao_Paulo')::date - 1
                        and (now() at time zone 'America/Sao_Paulo')::date + 1
  );

-- Recarrega o schema cache do PostgREST.
notify pgrst, 'reload schema';
