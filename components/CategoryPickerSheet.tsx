'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { CategoryOption } from '@/hooks/useCategorySelector';

interface Props {
  open: boolean;
  options: CategoryOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  columns?: 2 | 4;
}

export default function CategoryPickerSheet({
  open,
  options,
  selected,
  onSelect,
  onClose,
  columns = 4,
}: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  // Separamos fixas/custom em dois blocos para renderizar um header "Minhas
  // categorias" entre eles. Em CSS grid não dá pra inserir um header de uma
  // linha só direto no fluxo sem duplicar grid-column: 1/-1, então duas grids
  // empilhadas é o caminho mais simples.
  const fixed = options.filter((o) => !o.isCustom);
  const custom = options.filter((o) => o.isCustom);
  const gridCols = columns === 2 ? 'grid-cols-2' : 'grid-cols-4';

  function renderOption(opt: CategoryOption) {
    const active = selected === opt.value;
    return (
      <button
        key={opt.value}
        type="button"
        onClick={() => { onSelect(opt.value); onClose(); }}
        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
          active
            ? 'bg-mint-50 border-green-500/40 text-mint-500'
            : 'bg-gray-50/50 border-gray-200 text-gray-500 hover:border-gray-400'
        }`}
      >
        <span className="text-lg leading-none">{opt.icon}</span>
        <span className="text-[10px] leading-tight text-center">{opt.label}</span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-[90%] max-w-[480px] max-h-[82vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-gray-900 font-semibold text-base">Escolher categoria</h3>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div className={`grid gap-2 ${gridCols}`}>
            {fixed.map(renderOption)}
          </div>

          {custom.length > 0 && (
            <>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mt-5 mb-2">
                Minhas categorias
              </p>
              <div className={`grid gap-2 ${gridCols}`}>
                {custom.map(renderOption)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
