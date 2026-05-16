-- Adiciona 'Cartão de Crédito' ao check constraint de expenses.category.
-- Categoria de sistema usada no pagamento de fatura (botão "Pagar fatura"
-- na tela de detalhe do cartão e no modal de vencimento da Home).
-- Sem esta categoria na constraint, o INSERT do lançamento de pagamento
-- falhava com violação de check, e o erro (objeto PostgrestError, não Error)
-- vazava como "[object Object]" na UI.
-- APLICAR MANUALMENTE no Supabase SQL Editor (este projeto não usa Supabase CLI).

ALTER TABLE expenses DROP CONSTRAINT expenses_category_check;

ALTER TABLE expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    'Delivery', 'Alimentação', 'Transporte', 'Assinaturas',
    'Saúde', 'Lazer', 'Moradia', 'Educação', 'Investimentos',
    'Pet', 'Vestuário', 'Beleza', 'Farmácia', 'Combustível',
    'Internet', 'Telefone', 'Outros', 'Cartão de Crédito',
    'Salário', 'Freela', 'Renda passiva'
  ));
