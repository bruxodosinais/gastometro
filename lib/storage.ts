import { Category, Expense } from './types';

const KEY = 'gastometro_expenses';

export function getExpenses(): Expense[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Expense[]) : [];
  } catch {
    return [];
  }
}

export function saveExpenses(list: Expense[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addExpense(data: Omit<Expense, 'id' | 'createdAt'>): Expense {
  const all = getExpenses();
  const exp: Expense = { ...data, id: crypto.randomUUID(), createdAt: Date.now() };
  saveExpenses([...all, exp]);
  return exp;
}

export function deleteExpense(id: string): void {
  saveExpenses(getExpenses().filter((e) => e.id !== id));
}

function make(date: string, category: Category, value: number, description: string): Expense {
  return {
    id: crypto.randomUUID(),
    value,
    description,
    category,
    date,
    createdAt: new Date(date).getTime(),
  };
}

export function seedIfEmpty(): void {
  if (getExpenses().length > 0) return;

  const seed: Expense[] = [
    // Janeiro 2026
    make('2026-01-05', 'Delivery', 120, 'iFood - Pizza'),
    make('2026-01-12', 'Delivery', 85, 'iFood - Hambúrguer'),
    make('2026-01-20', 'Delivery', 95, 'Rappi - Sushi'),
    make('2026-01-03', 'Alimentação', 450, 'Supermercado Extra'),
    make('2026-01-10', 'Alimentação', 150, 'Feira do bairro'),
    make('2026-01-17', 'Alimentação', 80, 'Padaria'),
    make('2026-01-24', 'Alimentação', 120, 'Açougue'),
    make('2026-01-08', 'Transporte', 120, 'Uber (semana)'),
    make('2026-01-15', 'Transporte', 150, 'Combustível'),
    make('2026-01-22', 'Transporte', 30, 'Estacionamento'),
    make('2026-01-01', 'Assinaturas', 40, 'Netflix'),
    make('2026-01-01', 'Assinaturas', 25, 'Spotify'),
    make('2026-01-01', 'Assinaturas', 20, 'Amazon Prime'),
    make('2026-01-01', 'Assinaturas', 30, 'YouTube Premium'),
    make('2026-01-01', 'Assinaturas', 50, 'Academia'),
    make('2026-01-14', 'Saúde', 80, 'Farmácia - remédios'),
    make('2026-01-21', 'Saúde', 150, 'Consulta médica'),
    make('2026-01-19', 'Lazer', 60, 'Cinema'),
    make('2026-01-25', 'Lazer', 120, 'Bar com amigos'),
    make('2026-01-27', 'Lazer', 200, 'Show de música'),
    make('2026-01-11', 'Outros', 80, 'Presente aniversário'),
    make('2026-01-16', 'Outros', 30, 'Papelaria'),

    // Fevereiro 2026
    make('2026-02-04', 'Delivery', 140, 'iFood - Japonês'),
    make('2026-02-11', 'Delivery', 90, 'Rappi - Árabe'),
    make('2026-02-18', 'Delivery', 85, 'iFood - Italiana'),
    make('2026-02-02', 'Alimentação', 480, 'Supermercado Pão de Açúcar'),
    make('2026-02-09', 'Alimentação', 160, 'Feira orgânica'),
    make('2026-02-14', 'Alimentação', 90, 'Padaria'),
    make('2026-02-07', 'Transporte', 100, 'Uber (semana)'),
    make('2026-02-14', 'Transporte', 160, 'Combustível'),
    make('2026-02-21', 'Transporte', 25, 'Ônibus mensal'),
    make('2026-02-01', 'Assinaturas', 40, 'Netflix'),
    make('2026-02-01', 'Assinaturas', 25, 'Spotify'),
    make('2026-02-01', 'Assinaturas', 20, 'Amazon Prime'),
    make('2026-02-01', 'Assinaturas', 30, 'YouTube Premium'),
    make('2026-02-01', 'Assinaturas', 50, 'Academia'),
    make('2026-02-10', 'Saúde', 60, 'Farmácia - vitaminas'),
    make('2026-02-17', 'Saúde', 200, 'Psicólogo'),
    make('2026-02-08', 'Lazer', 50, 'Cinema'),
    make('2026-02-15', 'Lazer', 90, 'Bar - happy hour'),
    make('2026-02-22', 'Lazer', 180, 'Jantar especial'),
    make('2026-02-12', 'Outros', 60, 'Presente'),
    make('2026-02-19', 'Outros', 100, 'Cabeleireiro'),

    // Março 2026
    make('2026-03-03', 'Delivery', 95, 'iFood - Hambúrguer artesanal'),
    make('2026-03-12', 'Delivery', 180, 'Rappi - Pizza família'),
    make('2026-03-21', 'Delivery', 75, 'iFood - Chinês'),
    make('2026-03-01', 'Alimentação', 520, 'Supermercado Extra'),
    make('2026-03-08', 'Alimentação', 140, 'Feira do bairro'),
    make('2026-03-15', 'Alimentação', 70, 'Padaria'),
    make('2026-03-22', 'Alimentação', 120, 'Restaurante almoço'),
    make('2026-03-06', 'Transporte', 130, 'Uber (semana)'),
    make('2026-03-13', 'Transporte', 145, 'Combustível'),
    make('2026-03-20', 'Transporte', 25, 'Pedágio viagem'),
    make('2026-03-01', 'Assinaturas', 40, 'Netflix'),
    make('2026-03-01', 'Assinaturas', 25, 'Spotify'),
    make('2026-03-01', 'Assinaturas', 20, 'Amazon Prime'),
    make('2026-03-01', 'Assinaturas', 30, 'YouTube Premium'),
    make('2026-03-01', 'Assinaturas', 50, 'Academia'),
    make('2026-03-09', 'Saúde', 70, 'Farmácia - antibiótico'),
    make('2026-03-16', 'Saúde', 250, 'Dentista'),
    make('2026-03-14', 'Lazer', 100, 'Bar - aniversário amigo'),
    make('2026-03-22', 'Lazer', 300, 'Festival de música'),
    make('2026-03-28', 'Lazer', 60, 'Cinema'),
    make('2026-03-05', 'Outros', 45, 'Papelaria - escritório'),
    make('2026-03-18', 'Outros', 200, 'Faxineira mensal'),

    // Abril 2026 — mês atual (alertas em Delivery e Lazer)
    make('2026-04-01', 'Assinaturas', 40, 'Netflix'),
    make('2026-04-01', 'Assinaturas', 25, 'Spotify'),
    make('2026-04-01', 'Assinaturas', 20, 'Amazon Prime'),
    make('2026-04-01', 'Assinaturas', 30, 'YouTube Premium'),
    make('2026-04-01', 'Assinaturas', 50, 'Academia'),
    make('2026-04-03', 'Delivery', 160, 'iFood - Pizza premium'),
    make('2026-04-07', 'Delivery', 95, 'Rappi - Temaki'),
    make('2026-04-10', 'Delivery', 140, 'iFood - Hambúrguer gourmet'),
    make('2026-04-14', 'Delivery', 85, 'iFood - Chinês'),
    make('2026-04-18', 'Delivery', 70, 'Rappi - Açaí'),
    make('2026-04-05', 'Alimentação', 480, 'Supermercado'),
    make('2026-04-12', 'Alimentação', 120, 'Feira'),
    make('2026-04-19', 'Alimentação', 50, 'Padaria'),
    make('2026-04-04', 'Transporte', 110, 'Uber'),
    make('2026-04-11', 'Transporte', 145, 'Combustível'),
    make('2026-04-18', 'Transporte', 25, 'Estacionamento'),
    make('2026-04-08', 'Saúde', 80, 'Farmácia'),
    make('2026-04-15', 'Saúde', 50, 'Vitaminas'),
    make('2026-04-06', 'Lazer', 120, 'Bar - churrasco'),
    make('2026-04-13', 'Lazer', 250, 'Viagem final de semana'),
    make('2026-04-20', 'Lazer', 150, 'Jantar especial'),
    make('2026-04-09', 'Outros', 80, 'Presente'),
  ];

  saveExpenses(seed);
}
