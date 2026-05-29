'use client';

import { InlineCurrencyInput } from './CurrencyInput';
import { OnboardingNav } from './OnboardingNav';
import { OnboardingProgress } from './OnboardingProgress';

export type CardForm = {
  nome: string;
  limite: string;
  fechamento: string;
  vencimento: string;
};

export const EMPTY_CARD: CardForm = {
  nome: '',
  limite: '',
  fechamento: '',
  vencimento: '',
};

export const MAX_CARDS = 3;

type OnboardingStep3CartoesProps = {
  totalSteps: number;
  useCredit: boolean;
  setUseCredit: (v: boolean) => void;
  cards: CardForm[];
  updateCard: (idx: number, patch: Partial<CardForm>) => void;
  addCardRow: () => void;
  removeCardRow: (idx: number) => void;
  saving: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function OnboardingStep3Cartoes({
  totalSteps,
  useCredit,
  setUseCredit,
  cards,
  updateCard,
  addCardRow,
  removeCardRow,
  saving,
  onBack,
  onContinue,
  onSkip,
}: OnboardingStep3CartoesProps) {
  return (
    <div className="flex flex-col gap-0">
      <OnboardingProgress
        filled={3}
        totalSteps={totalSteps}
        label={`Passo 3 de ${totalSteps}`}
      />
      <h2 className="text-xl font-bold text-gray-900 text-center">
        Você usa cartão de crédito?
      </h2>
      <p className="text-sm text-gray-400 text-center mt-1 mb-5">
        Cadastre seus cartões para acompanhar a fatura. Você pode adicionar
        mais depois.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => setUseCredit(false)}
          className="py-2.5 rounded-xl border text-sm font-semibold transition-colors"
          style={
            !useCredit
              ? {
                  background: 'var(--accent-bg)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }
              : {
                  background: '#f9fafb',
                  borderColor: '#f3f4f6',
                  color: '#6b7280',
                }
          }
        >
          Não
        </button>
        <button
          onClick={() => setUseCredit(true)}
          className="py-2.5 rounded-xl border text-sm font-semibold transition-colors"
          style={
            useCredit
              ? {
                  background: 'var(--accent-bg)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }
              : {
                  background: '#f9fafb',
                  borderColor: '#f3f4f6',
                  color: '#6b7280',
                }
          }
        >
          Sim
        </button>
      </div>

      {useCredit && (
        <div className="space-y-3 max-h-80 overflow-y-auto -mx-1 px-1">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-100 p-3 space-y-2"
              style={{ background: '#f9fafb' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Cartão {idx + 1}
                </span>
                {cards.length > 1 && (
                  <button
                    onClick={() => removeCardRow(idx)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Remover
                  </button>
                )}
              </div>
              <input
                type="text"
                value={card.nome}
                onChange={(e) => updateCard(idx, { nome: e.target.value })}
                placeholder="Nome (ex: Nubank, Inter, Itaú)"
                className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
              <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-400 font-medium flex-shrink-0">Limite R$</span>
                <InlineCurrencyInput
                  value={card.limite}
                  onChange={(v) => updateCard(idx, { limite: v })}
                  aria-label={`Limite do cartão ${idx + 1}`}
                  className="min-w-0 flex-1 text-sm bg-transparent outline-none text-right text-gray-900 placeholder:text-gray-300"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 flex-1 bg-white border border-gray-100 rounded-lg px-2 py-2">
                  <span className="text-[10px] text-gray-400 font-medium leading-tight flex-shrink-0">
                    Fecha<br />dia
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={28}
                    value={card.fechamento}
                    onChange={(e) => updateCard(idx, { fechamento: e.target.value })}
                    placeholder="ex: 25"
                    className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                  />
                </div>
                <div className="flex items-center gap-1 flex-1 bg-white border border-gray-100 rounded-lg px-2 py-2">
                  <span className="text-[10px] text-gray-400 font-medium leading-tight flex-shrink-0">
                    Vence<br />dia
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={28}
                    value={card.vencimento}
                    onChange={(e) => updateCard(idx, { vencimento: e.target.value })}
                    placeholder="ex: 5"
                    className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                  />
                </div>
              </div>
            </div>
          ))}

          {cards.length < MAX_CARDS && (
            <button
              onClick={addCardRow}
              className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 transition-colors"
            >
              + Adicionar outro cartão
            </button>
          )}
        </div>
      )}

      <div className="h-5" />
      <OnboardingNav
        onBack={onBack}
        onPrimary={onContinue}
        primaryLabel="Continuar"
        loading={saving}
        onSkip={onSkip}
      />
    </div>
  );
}
