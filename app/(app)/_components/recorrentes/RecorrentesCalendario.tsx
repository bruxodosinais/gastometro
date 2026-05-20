'use client';

import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type Props = {
  selectedMonth: string;
  todayMonthKey: string;
  selectedMonthLabel: string;
  selectedMonthLabelCap: string;
  loadingMonth: boolean;
  isCurrentMonth: boolean;
  pickerOpen: boolean;
  pickerYear: number;
  onSelectMonth: (monthKey: string) => void;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onChangePickerYear: (delta: number) => void;
};

export default function RecorrentesCalendario({
  selectedMonth,
  todayMonthKey,
  selectedMonthLabel,
  selectedMonthLabelCap,
  loadingMonth,
  isCurrentMonth,
  pickerOpen,
  pickerYear,
  onSelectMonth,
  onOpenPicker,
  onClosePicker,
  onChangePickerYear,
}: Props) {
  return (
    <>
      {/* Seletor de mês */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          padding: '4px 6px',
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => onSelectMonth(shiftMonth(selectedMonth, -1))}
          style={{
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-2)',
            background: 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={onOpenPicker}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {selectedMonthLabelCap}
          </span>
          <ChevronDown size={12} color="var(--text-3)" />
          {loadingMonth && <Loader2 size={12} className="animate-spin" color="var(--text-3)" />}
        </button>
        <button
          onClick={() => onSelectMonth(shiftMonth(selectedMonth, 1))}
          style={{
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-2)',
            background: 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Aviso mês diferente */}
      {!isCurrentMonth && (
        <div
          style={{
            marginBottom: 10,
            padding: '9px 13px',
            background: 'var(--yellow-bg)',
            border: '1.5px solid rgba(255,184,0,0.2)',
            borderRadius: 'var(--r-sm)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--yellow-text)',
          }}
        >
          Visualizando {selectedMonthLabel} — volte ao mês atual para gerenciar pagamentos
        </div>
      )}

      {/* ── PICKER MODAL: mês/ano ────────────────────────────────────────────── */}
      {pickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={onClosePicker}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              style={{
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                borderRadius: 20,
                padding: 20,
                width: '100%',
                maxWidth: 300,
                boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
              }}
              className="pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Navegação de ano */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <button
                  onClick={() => onChangePickerYear(-1)}
                  style={{
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-2)',
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                  aria-label="Ano anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{pickerYear}</span>
                <button
                  onClick={() => onChangePickerYear(1)}
                  style={{
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-2)',
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                  aria-label="Próximo ano"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Grade de meses */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {MONTHS.map((name, idx) => {
                  const month = idx + 1;
                  const key = `${pickerYear}-${String(month).padStart(2, '0')}`;
                  const isSelected = key === selectedMonth;
                  const isNow = key === todayMonthKey;
                  return (
                    <button
                      key={month}
                      onClick={() => { onSelectMonth(key); onClosePicker(); }}
                      style={{
                        padding: '10px 0',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'Nunito, sans-serif',
                        cursor: 'pointer',
                        border: isNow && !isSelected ? '1.5px solid var(--accent-soft)' : 'none',
                        background: isSelected ? 'var(--accent)' : isNow ? 'var(--accent-bg)' : 'var(--bg)',
                        color: isSelected ? 'white' : isNow ? 'var(--accent)' : 'var(--text-2)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
