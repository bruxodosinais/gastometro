'use client';

import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePeriod } from '@/lib/periodContext';
import { getMonthLabel } from '@/lib/calculations';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PeriodSelector({ compact = false }: { compact?: boolean }) {
  const { period, setPeriod } = usePeriod();
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => parseInt(period.split('-')[0]));

  const label = getMonthLabel(period);
  const labelCap = label.charAt(0).toUpperCase() + label.slice(1);
  const [selYear, selMonth] = period.split('-').map(Number);
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;

  function openPicker() {
    setPickerYear(selYear);
    setOpen(true);
  }

  function pick(month: number) {
    setPeriod(`${pickerYear}-${String(month).padStart(2, '0')}`);
    setOpen(false);
  }

  return (
    <>
      {/* Barra de navegação */}
      {compact ? (
        <div className="inline-flex items-center bg-slate-900 border border-slate-800 rounded-xl px-1 py-1 gap-0.5">
          <button
            onClick={() => setPeriod(shiftMonth(period, -1))}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={openPicker}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <span className="text-white font-semibold text-xs whitespace-nowrap">{labelCap}</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>
          <button
            onClick={() => setPeriod(shiftMonth(period, 1))}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-2 py-2 mb-5">
          <button
            onClick={() => setPeriod(shiftMonth(period, -1))}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={openPicker}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <span className="text-white font-semibold text-sm">{labelCap}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          <button
            onClick={() => setPeriod(shiftMonth(period, 1))}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Modal picker */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Card centralizado */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Navegação de ano */}
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={() => setPickerYear((y) => y - 1)}
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                  aria-label="Ano anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-white font-bold text-xl">{pickerYear}</span>
                <button
                  onClick={() => setPickerYear((y) => y + 1)}
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                  aria-label="Próximo ano"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Grade de meses (3 × 4) */}
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((name, idx) => {
                  const month = idx + 1;
                  const isSelected = pickerYear === selYear && month === selMonth;
                  const isNow = pickerYear === nowYear && month === nowMonth;

                  return (
                    <button
                      key={month}
                      onClick={() => pick(month)}
                      className={`py-3 rounded-xl text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                          : isNow
                          ? 'bg-slate-800 text-violet-400 ring-1 ring-violet-500/40'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
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
