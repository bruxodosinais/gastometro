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
                      ? 'bg-mint-50 border-green-500/40 text-mint-500'
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
    </div>
  );
}
