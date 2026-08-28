'use client';

// Tracker do funil de onboarding. Regras de ouro deste arquivo:
//   1. NUNCA lançar. Um erro de telemetria não pode quebrar o cadastro.
//   2. NUNCA bloquear. Todo envio é fire-and-forget (sem await na UI).
// Se a rede cair, o passo simplesmente não é contado.
//
// O `anon_id` é do DISPOSITIVO e nasce ANTES da conta: é ele que costura o
// funil pré-cadastro (carrossel → quiz → paywall → cadastro), quando ainda não
// existe user_id. Limpar o storage gera um id novo — o funil trata como device
// novo, o que é o comportamento honesto (não temos como saber que é o mesmo).

import { fetchApi } from '@/lib/fetchApi';
import { isNativePlatform } from '@/lib/native';
import type { OnboardingAction } from './steps';

const ANON_KEY = 'to_anon_id';

// Fallback quando o localStorage não está disponível (aba anônima do Safari,
// storage bloqueado): id só de memória, vive enquanto a página viver. Melhor
// contar a sessão uma vez do que não contar nada.
let memoryAnonId: string | null = null;

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* segue pro fallback */
  }
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getAnonId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const created = newId();
    localStorage.setItem(ANON_KEY, created);
    return created;
  } catch {
    if (!memoryAnonId) memoryAnonId = newId();
    return memoryAnonId;
  }
}

function platform(): string {
  if (!isNativePlatform()) return 'web';
  try {
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    return cap?.getPlatform?.() ?? 'native';
  } catch {
    return 'native';
  }
}

// Deduplicação local: o mesmo (passo, ação) só é enviado uma vez por carga de
// página. O índice único da tabela já garante idempotência no servidor; isto
// aqui só evita a requisição inútil (React StrictMode monta o efeito 2x em dev).
const sentThisLoad = new Set<string>();

export function trackOnboarding(step: string, action: OnboardingAction = 'view'): void {
  if (typeof window === 'undefined') return;

  const dedupeKey = `${step}:${action}`;
  if (sentThisLoad.has(dedupeKey)) return;
  sentThisLoad.add(dedupeKey);

  const anonId = getAnonId();
  if (!anonId) return;

  void fetchApi('/api/onboarding/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonId, step, action, platform: platform() }),
    // Mantém o envio vivo se o usuário navegar no mesmo instante (é o caso do
    // 'complete' de um passo, disparado junto com a transição de tela).
    keepalive: true,
  }).catch(() => {
    // Falhou → devolve pro pool: uma tentativa futura na mesma página pode dar certo.
    sentThisLoad.delete(dedupeKey);
  });
}
