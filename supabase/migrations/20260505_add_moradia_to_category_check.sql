-- Adiciona 'Moradia' ao check constraint de expenses.category.
-- O constraint original foi criado sem esta categoria, causando falha silenciosa
-- ao tentar inserir lançamentos de recorrentes com categoria Moradia.
-- Aplicado manualmente em 2026-05-05 via Supabase SQL Editor.

ALTER TABLE expenses DROP CONSTRAINT expenses_category_check;

ALTER TABLE expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    'Delivery', 'Alimentação', 'Transporte', 'Assinaturas',
    'Saúde', 'Lazer', 'Moradia', 'Educação', 'Investimentos',
    'Pet', 'Vestuário', 'Beleza', 'Farmácia', 'Combustível',
    'Internet', 'Telefone', 'Outros',
    'Salário', 'Freela', 'Renda passiva'
  ));
