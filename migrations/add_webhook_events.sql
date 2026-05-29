-- CRÍTICO #2 — Idempotência do webhook Kiwify.
-- Registra cada evento processado; uma reentrega (retry da Kiwify) do MESMO
-- evento é detectada por unique violation e ignorada.
-- Rodar manualmente no Supabase Dashboard (SQL Editor).
--
-- Sem RLS (tabela interna, acesso só via service_role no webhook).
-- Sem user_id (eventos podem chegar antes do usuário existir).
--
-- A constraint inclui event_type (além de provider + event_id) DE PROPÓSITO:
-- a Kiwify reusa o mesmo order_id para eventos distintos do mesmo pedido
-- (ex.: order_approved e depois order_refunded). Deduplicar só por order_id
-- faria o estorno ser tratado como "duplicado" da aprovação e perdido.
-- Com event_type na chave, retries do mesmo evento são barrados, mas eventos
-- diferentes do mesmo pedido continuam sendo processados.

CREATE TABLE IF NOT EXISTS webhook_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL,
  event_id      text NOT NULL,
  event_type    text NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_provider_event_key UNIQUE (provider, event_id, event_type)
);
