// Evento de celebração genérico (mensagem-only), substituto do CoinToast após
// a aposentadoria das moedas. Qualquer ação que queira um toast leve de
// reforço dispara `celebrate('mensagem')`; o AchievementToast global exibe.
export const CELEBRATE_EVENT = 'app:celebrate';

export interface CelebrateDetail {
  message: string;
}

export function celebrate(message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CelebrateDetail>(CELEBRATE_EVENT, { detail: { message } }));
}
