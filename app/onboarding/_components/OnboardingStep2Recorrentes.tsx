'use client';

import type { ExpenseCategory } from '@/lib/types';
import { OnboardingNav } from './OnboardingNav';
import { OnboardingProgress } from './OnboardingProgress';

export type ChipDef = {
  id: string;
  label: string;
  icon: string;
  category: ExpenseCategory;
};

export const CHIPS: ChipDef[] = [
  { id: 'aluguel',   label: 'Aluguel',         icon: '🏠', category: 'Moradia' },
  { id: 'internet',  label: 'Internet',         icon: '📡', category: 'Internet' },
  { id: 'energia',   label: 'Energia',          icon: '💡', category: 'Moradia' },
  { id: 'agua',      label: 'Água',             icon: '💧', category: 'Moradia' },
  { id: 'academia',  label: 'Academia',         icon: '🏋️', category: 'Saúde' },
  { id: 'streaming', label: 'Streaming',        icon: '📺', category: 'Assinaturas' },
  { id: 'escola',    label: 'Escola/Faculdade', icon: '🎓', category: 'Educação' },
  { id: 'saude',     label: 'Plano de saúde',   icon: '🏥', category: 'Saúde' },
];

type OnboardingStep2RecorrentesProps = {
  totalSteps: number;
  selectedChips: Set<string>;
  toggleChip: (id: string) => void;
  chipValues: Record<string, string>;
  setChipValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  chipDueDays: Record<string, string>;
  setChipDueDays: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  customName: string;
  setCustomName: (v: string) => void;
  customValue: string;
  setCustomValue: (v: string) => void;
  customDueDay: string;
  setCustomDueDay: (v: string) => void;
  showCustomForm: boolean;
  setShowCustomForm: (v: boolean) => void;
  saving: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function OnboardingStep2Recorrentes({
  totalSteps,
  selectedChips,
  toggleChip,
  chipValues,
  setChipValues,
  chipDueDays,
  setChipDueDays,
  customName,
  setCustomName,
  customValue,
  setCustomValue,
  customDueDay,
  setCustomDueDay,
  showCustomForm,
  setShowCustomForm,
  saving,
  onBack,
  onContinue,
  onSkip,
}: OnboardingStep2RecorrentesProps) {
  return (
    <div className="flex flex-col gap-0">
      <OnboardingProgress
        filled={2}
        totalSteps={totalSteps}
        label={`Passo 2 de ${totalSteps}`}
      />
      <h2 className="text-xl font-bold text-gray-900 text-center">
        Você tem contas fixas todo mês?
      </h2>
      <p className="text-sm text-gray-400 text-center mt-1 mb-5">
        Selecione as que se aplicam e informe o valor.
      </p>

      <div className="overflow-y-auto max-h-64 -mx-1 px-1">
        <div className="grid grid-cols-2 gap-2">
          {CHIPS.map((chip) => {
            const selected = selectedChips.has(chip.id);
            return (
              <div key={chip.id}>
                <button
                  onClick={() => toggleChip(chip.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors"
                  style={
                    selected
                      ? {
                          background: 'var(--accent-bg)',
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                        }
                      : {
                          background: '#f9fafb',
                          borderColor: '#f3f4f6',
                          color: '#374151',
                        }
                  }
                >
                  <span>{chip.icon}</span>
                  <span className="truncate">{chip.label}</span>
                </button>
                {selected && (
                  <div className="mt-1 flex gap-1">
                    <div
                      className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1.5 rounded-xl border"
                      style={{
                        background: 'var(--accent-bg)',
                        borderColor: 'var(--accent-soft)',
                      }}
                    >
                      <span
                        className="text-xs font-medium flex-shrink-0"
                        style={{ color: 'var(--accent)' }}
                      >
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={chipValues[chip.id] || ''}
                        onChange={(e) =>
                          setChipValues((prev) => ({
                            ...prev,
                            [chip.id]: e.target.value.replace(/[^0-9.,]/g, ''),
                          }))
                        }
                        placeholder="0,00"
                        className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                      />
                    </div>
                    <div
                      className="flex items-center gap-1 px-2 py-1.5 rounded-xl border w-[88px] flex-shrink-0"
                      style={{
                        background: 'var(--accent-bg)',
                        borderColor: 'var(--accent-soft)',
                      }}
                    >
                      <span
                        className="text-[10px] font-medium leading-tight flex-shrink-0"
                        style={{ color: 'var(--accent)' }}
                      >
                        Vence<br />dia
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={31}
                        value={chipDueDays[chip.id] || ''}
                        onChange={(e) =>
                          setChipDueDays((prev) => ({
                            ...prev,
                            [chip.id]: e.target.value,
                          }))
                        }
                        placeholder="ex: 10"
                        className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showCustomForm ? (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Nome da conta"
              className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors"
            />
            <div className="flex gap-1">
              <div className="flex items-center gap-1 flex-1 min-w-0 bg-white border border-gray-100 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-400 font-medium flex-shrink-0">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customValue}
                  onChange={(e) =>
                    setCustomValue(e.target.value.replace(/[^0-9.,]/g, ''))
                  }
                  placeholder="0,00"
                  className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                />
              </div>
              <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl px-2 py-2 w-[88px] flex-shrink-0">
                <span className="text-[10px] text-gray-400 font-medium leading-tight flex-shrink-0">Vence<br />dia</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={customDueDay}
                  onChange={(e) => setCustomDueDay(e.target.value)}
                  placeholder="ex: 10"
                  className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                />
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomForm(true)}
            className="mt-3 w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 transition-colors"
          >
            + Adicionar outra
          </button>
        )}
      </div>

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
