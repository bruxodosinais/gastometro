-- Adiciona 'Saldo inicial' ao check constraint de expenses.category.
-- Categoria de sistema usada pelo onboarding: o passo "Situação financeira
-- atual" grava o saldo em conta como uma receita (type='income') com esta
-- categoria, definindo o ponto de partida real do usuário.
-- Sem esta categoria na constraint, o INSERT do saldo inicial falha com
-- violação de check e o erro (PostgrestError, não Error) vaza na UI.
-- APLICAR MANUALMENTE no Supabase SQL Editor (este projeto não usa Supabase CLI).

ALTER TABLE expenses DROP CONSTRAINT expenses_category_check;

ALTER TABLE expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    'Delivery', 'Alimentação', 'Transporte', 'Assinaturas',
    'Saúde', 'Lazer', 'Moradia', 'Educação', 'Investimentos',
    'Pet', 'Vestuário', 'Beleza', 'Farmácia', 'Combustível',
    'Internet', 'Telefone', 'Outros', 'Cartão de Crédito',
    'Salário', 'Freela', 'Renda passiva', 'Saldo inicial'
  ));
