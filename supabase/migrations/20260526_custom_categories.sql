-- Categorias personalizadas por usuário (V-02).
--
-- Cada usuário pode criar até 30 categorias custom além das fixas definidas
-- em lib/types.ts. As fixas continuam vivendo no código (constantes); o
-- banco só armazena as custom.
--
-- O campo expenses.category e recurring_expenses.category passam a aceitar
-- qualquer string (custom ou fixa). A validação de "categoria existe" agora
-- é responsabilidade do frontend (composto de EXPENSE/INCOME_CATEGORIES +
-- linhas desta tabela). Sem o CHECK constraint, custom names arbitrários
-- são aceitos sem precisar atualizar o schema a cada nova categoria.
--
-- APLICAR MANUALMENTE no Supabase SQL Editor (este projeto não usa Supabase CLI).

CREATE TABLE custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  type text NOT NULL CHECK (type IN ('expense', 'income')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_categories" ON custom_categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX custom_categories_user_id_idx ON custom_categories(user_id);

-- Categoria agora é string livre. Validação do conjunto válido (fixas + custom
-- do usuário) virou responsabilidade do frontend.
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE recurring_expenses DROP CONSTRAINT IF EXISTS recurring_expenses_category_check;
