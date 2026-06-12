// Copy das notificações (push + intro de e-mail) em tom de coach, com variante
// com/sem Missão. SERVER-SAFE: sem React, sem formatCurrency client — recebe os
// valores JÁ formatados (ex.: o fmtBRL que cada cron já tem) e devolve strings.
// Funções puras; os crons só montam o payload com o retorno.

export interface PushCopy {
  title: string;
  body: string;
}

// due-tomorrow: 1 push por conta. amountBRL já formatado (ex.: "R$ 1.200,00").
export function dueTomorrowCopy(args: {
  description: string;
  amountBRL: string;
  hasMission: boolean;
}): PushCopy {
  const fecho = args.hasMission
    ? 'Pagar em dia mantém o aporte da Missão no caminho.'
    : 'Pagar em dia evita dor de cabeça.';
  return {
    title: `💸 ${args.description} vence amanhã`,
    body: `São ${args.amountBRL}. ${fecho}`,
  };
}

// budget-exceeded: 1 push agrupado por usuário. `categories` já ordenadas pela
// mais crítica primeiro. Mantém o agrupamento atual no multi-categoria.
export function budgetExceededCopy(args: {
  categories: string[];
  hasMission: boolean;
}): PushCopy {
  const fecho = args.hasMission
    ? 'Segurar agora protege sua meta.'
    : 'Segurar agora evita o aperto no fim do mês.';
  const cats = args.categories;

  if (cats.length <= 1) {
    return {
      title: `⚠️ Você passou do orçamento em ${cats[0] ?? 'uma categoria'}`,
      body: fecho,
    };
  }

  const grouped =
    cats.length === 2
      ? `${cats[0]} e ${cats[1]} estouraram o orçamento`
      : `${cats.length} categorias estouraram — ${cats[0]}, ${cats[1]} e mais`;
  return { title: '⚠️ Orçamento estourado', body: `${grouped}. ${fecho}` };
}

// weekly-summary (push). spentBRL = null quando não houve gasto (cai no caso de
// contas pendentes). progressPercent vem de report.missao (null = sem Missão).
export function weeklySummaryCopy(args: {
  spentBRL: string | null;
  pendingCount: number;
  progressPercent: number | null;
}): PushCopy {
  const title = '📊 Seu resumo semanal';

  if (args.spentBRL) {
    const body =
      args.progressPercent != null
        ? `Sua semana: ${args.spentBRL} · Você já está em ${args.progressPercent}% da meta — bora manter o ritmo?`
        : `Sua semana: ${args.spentBRL} · Dá uma olhada no que deu pra economizar.`;
    return { title, body };
  }

  return {
    title,
    body: `Você tem ${args.pendingCount} conta(s) pendente(s) — bora pôr a semana em dia?`,
  };
}

// Intro humana ACIMA das tabelas do relatório (as tabelas seguem no 7b).
// `name` deve vir já escapado para HTML pelo caller (contexto de e-mail).
export function weeklyReportIntro(args: {
  name: string;
  progressPercent: number | null;
}): string {
  const oi = args.name ? `Oi ${args.name}!` : 'Oi!';
  return args.progressPercent != null
    ? `${oi} Semana fechada — e você já está em ${args.progressPercent}% da sua meta. 👇`
    : `${oi} Aqui está sua semana em números. 👇`;
}

export function monthlyReportIntro(args: { name: string }): string {
  const oi = args.name ? `Oi ${args.name}!` : 'Oi!';
  return `${oi} Seu mês em números, pra você ver onde dá pra ajustar. 👇`;
}
