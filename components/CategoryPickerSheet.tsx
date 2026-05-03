'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { Category } from '@/lib/types';

interface Props {
  open: boolean;
  categories: Category[];
  selected: Category;
  onSelect: (cat: Category) => void;
  onClose: () => void;
  columns?: 2 | 4;
}

export default function CategoryPickerSheet({
  open,
  categories,
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />

      {/* Bottom sheet (mobile) / centered modal (desktop) */}
      <div className="fixed z-50 bg-white left-0 right-0 bottom-0 rounded-t-[16px] md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-w-[90vw] md:rounded-xl max-h-[82vh] overflow-y-auto">
        <div className="p-5 pb-8 md:pb-5">
          {/* Header */}
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

          {/* Category grid */}
          <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
            {categories.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const active = selected === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { onSelect(cat); onClose(); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
                    active
                      ? 'bg-violet-50 border-violet-400/60 text-violet-700'
                      : 'bg-gray-50/50 border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  <span className="text-lg leading-none">{cfg.icon}</span>
                  <span className="text-[10px] leading-tight text-center">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
