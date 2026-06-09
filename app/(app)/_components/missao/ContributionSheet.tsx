'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { formatCurrency, getMonthKey } from '@/lib/calculations';
import { getExpenses } from '@/lib/storage';
import { addContribution, checkAndUnlockBadges } from '@/lib/storage/missions';
import { earnCoins } from '@/lib/gamification/coins';
import CurrencyInput from '@/components/CurrencyInput';

type Props = {
  open: boolean;
  missionId: string;
  userId: string;
  targetAmount: number;
  totalSaved: number;
  monthlyTarget: number;
  alreadySavedThisMonth: number;
  // Indica se o usuário é Pro E ainda não tem desafio do mês — usado para
  // disparar a geração de desafio assíncrono após o aporte.
  shouldGenerateChallenge: boolean;
  // Valor pré-preenchido ao abrir (ex.: economia estimada do desafio em M4).
  // Default 0 (depósito comum). O usuário pode ajustar antes de salvar.
  initialAmount?: number;
  // Texto de contexto opcional sob o título (ex.: "Você completou o desafio…").
  contextLabel?: string;
  onClose: () => void;
  // Chamado após persistir com sucesso. Dashboard usa para recarregar e
  // disparar MilestoneModal se cruzou um marco.
  onSaved: (amount: number) => void;
};

export default function ContributionSheet({
  open,
  missionId,
  userId,
  targetAmount,
  totalSaved,
  monthlyTarget,
  alreadySavedThisMonth,
  shouldGenerateChallenge,
  initialAmount = 0,
  contextLabel,
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset + auto-focus ao abrir.
  useEffect(() => {
    if (!open) return;
    setAmount(initialAmount);
    setSaving(false);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = '';
      clearTimeout(t);
    };
  }, [open, initialAmount]);

  if (!open) return null;

  const handleSave = async () => {
    if (saving || amount <= 0) return;
    setSaving(true);
    const month = getMonthKey(new Date());
    try {
      await addContribution(missionId, userId, month, amount);
    } catch (e) {
      console.error(e);
      setSaving(false);
      return;
    }

    // +50 🪙 por GUARDAR — a ação-herói do app. Único ponto manual de aporte;
    // não há fluxo automático criando mission_contributions. Fire-and-forget:
    // nunca bloqueia o aporte. O label dá a celebração "💰 Aporte registrado!"
    // no toast global (sem empilhar um 2º toast); o badge sobe via COIN_AWARD_EVENT.
    earnCoins('mission_contribution', { label: '💰 Aporte registrado!' }).catch(() => {});

    // Avalia badges automáticos (streak, valor acumulado, comportamento).
    // Fire-and-forget: o aporte já foi persistido — falha no badge não deve
    // bloquear o fluxo nem mostrar erro pro usuário. O loadAll() do dashboard
    // (disparado via onSaved) busca o estado atualizado do banco.
    checkAndUnlockBadges(userId, missionId).catch((err) =>
      console.error('checkAndUnlockBadges:', err),
    );

    // Fire-and-forget: a geração do desafio via IA é assíncrona, não bloqueia
    // o fechamento do sheet. Se a rota não existir/falhar, segue normal.
    if (shouldGenerateChallenge) {
      // Agrupa gastos do mês corrente por categoria para alimentar o prompt.
      // Tudo via cache (getExpenses já é cachedFetch), 0 round-trip extra.
      const expenses = await getExpenses().catch(() => []);
      const byCat = new Map<string, number>();
      for (const e of expenses) {
        if (e.type !== 'expense') continue;
        if (e.date.slice(0, 7) !== month) continue;
        byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
      }
      const recentExpenses = Array.from(byCat.entries())
        .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);

      fetch('/api/missao/gerar-desafio', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          missionId,
          month,
          targetAmount,
          totalSaved: totalSaved + amount,
          monthlyTarget,
          recentExpenses,
        }),
      }).catch(() => {});
    }

    onSaved(amount);
    onClose();
  };

  return (
    <>
      {/* Overlay: clique fora fecha. z-50 = nível dos demais modais do app. */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      {/* Modal centralizado na viewport, independente do sidebar do desktop.
          max-w-sm + mx-4 mantém respiro lateral em telas estreitas. */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4 z-50"
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold" style={{ color: 'var(--text)' }}>
            Registrar depósito
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'var(--bg)' }}
          >
            <X size={16} color="var(--text-2)" />
          </button>
        </div>

        {contextLabel && (
          <p className="mt-2 text-[13px] font-bold" style={{ color: 'var(--accent)' }}>
            {contextLabel}
          </p>
        )}

        {/* Card-display: tocar/clicar dá focus() no input invisível abaixo,
            abrindo o teclado numérico no mobile. */}
        <div
          role="button"
          tabIndex={-1}
          onClick={() => inputRef.current?.focus()}
          className="mt-5 flex cursor-text flex-col items-center rounded-2xl px-4 py-6"
          style={{ background: 'var(--bg)', borderRadius: 'var(--r)' }}
        >
          <span
            className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-3)' }}
          >
            Valor
          </span>
          <span
            className="mt-1 text-[40px] font-extrabold leading-none"
            style={{ color: 'var(--accent)' }}
          >
            {formatCurrency(amount)}
          </span>
          <CurrencyInput
            inputRef={inputRef}
            value={amount}
            onChange={setAmount}
            placeholder="0"
            aria-label="Valor do depósito"
            className="sr-only"
          />
        </div>

        <p
          className="mt-4 text-center text-[13px] font-medium"
          style={{ color: 'var(--text-2)' }}
        >
          Meta deste mês: <strong style={{ color: 'var(--text)' }}>{formatCurrency(monthlyTarget)}</strong>
          {' · '}
          Já guardado: <strong style={{ color: 'var(--text)' }}>{formatCurrency(alreadySavedThisMonth)}</strong>
        </p>

        <button
          onClick={handleSave}
          disabled={saving || amount <= 0}
          className="mt-5 flex h-[54px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: 'var(--accent)',
            borderRadius: 'var(--r)',
            boxShadow: amount > 0 ? '0 6px 20px var(--accent-shadow)' : 'none',
          }}
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : 'Salvar'}
        </button>
      </div>
    </>
  );
}
