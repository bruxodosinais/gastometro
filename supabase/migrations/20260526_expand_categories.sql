-- Expande o catálogo fixo de categorias (V-01).
-- Adiciona 18 novas categorias de despesa e 5 de receita ao check constraint
-- de expenses.category. Total final: 41 categorias permitidas.
--
-- Categorias novas (despesa): Academia, Água, Luz, Gás, Condomínio, Streaming,
-- Games, Cuidados pessoais, Médico, Dentista, Psicólogo, Crianças, Trabalho,
-- Doação, Imposto, Seguro, Manutenção, Compras online.
--
-- Categorias novas (receita): Bônus, 13º salário, Aluguel recebido,
-- Dividendos, Venda.
--
-- A fonte da verdade dos tipos vive em lib/types.ts (ExpenseCategory /
-- IncomeCategory). Este constraint só impede inserts inválidos no banco.
--
-- APLICAR MANUALMENTE no Supabase SQL Editor (este projeto não usa Supabase CLI).

ALTER TABLE expenses DROP CONSTRAINT expenses_category_check;

ALTER TABLE expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    -- Despesas existentes
    'Delivery', 'Alimentação', 'Transporte', 'Assinaturas',
    'Saúde', 'Lazer', 'Moradia', 'Educação', 'Investimentos',
    'Pet', 'Vestuário', 'Beleza', 'Farmácia', 'Combustível',
    'Internet', 'Telefone', 'Outros', 'Cartão de Crédito',
    'Presente', 'Viagem',
    -- Despesas novas (V-01)
    'Academia', 'Água', 'Luz', 'Gás', 'Condomínio', 'Streaming',
    'Games', 'Cuidados pessoais', 'Médico', 'Dentista', 'Psicólogo',
    'Crianças', 'Trabalho', 'Doação', 'Imposto', 'Seguro',
    'Manutenção', 'Compras online',
    -- Receitas existentes
    'Salário', 'Freela', 'Renda passiva', 'Saldo inicial',
    -- Receitas novas (V-01)
    'Bônus', '13º salário', 'Aluguel recebido', 'Dividendos', 'Venda'
  ));

-- recurring_expenses: nenhuma migration anterior criou CHECK aqui, mas o
-- schema original foi criado direto no dashboard. Recria defensivamente se
-- houver um constraint chamado recurring_expenses_category_check.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recurring_expenses_category_check'
      AND conrelid = 'recurring_expenses'::regclass
  ) THEN
    ALTER TABLE recurring_expenses DROP CONSTRAINT recurring_expenses_category_check;

    ALTER TABLE recurring_expenses ADD CONSTRAINT recurring_expenses_category_check
      CHECK (category IN (
        'Delivery', 'Alimentação', 'Transporte', 'Assinaturas',
        'Saúde', 'Lazer', 'Moradia', 'Educação', 'Investimentos',
        'Pet', 'Vestuário', 'Beleza', 'Farmácia', 'Combustível',
        'Internet', 'Telefone', 'Outros', 'Cartão de Crédito',
        'Presente', 'Viagem',
        'Academia', 'Água', 'Luz', 'Gás', 'Condomínio', 'Streaming',
        'Games', 'Cuidados pessoais', 'Médico', 'Dentista', 'Psicólogo',
        'Crianças', 'Trabalho', 'Doação', 'Imposto', 'Seguro',
        'Manutenção', 'Compras online',
        'Salário', 'Freela', 'Renda passiva', 'Saldo inicial',
        'Bônus', '13º salário', 'Aluguel recebido', 'Dividendos', 'Venda'
      ));
  END IF;
END$$;
