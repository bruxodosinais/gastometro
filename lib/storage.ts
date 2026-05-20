// Mantido como re-export para preservar `import ... from '@/lib/storage'`
// em todos os call sites. A implementação foi dividida por domínio em
// `lib/storage/` (expenses, recurring, cards, plans, goals, assets, budgets).
export * from './storage/index';
