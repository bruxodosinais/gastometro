-- Recorrentes com prazo definido (parcelamentos, financiamentos, contratos).
-- NULL = sem prazo (comportamento padrão, infinito). Inteiro = nº de parcelas.
alter table recurring_expenses add column total_installments integer;
alter table recurring_expenses add constraint recurring_expenses_total_installments_positive
  check (total_installments is null or total_installments >= 1);
