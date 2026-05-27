'use client';

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import type { DuplicateCandidate } from '@/lib/utils/detectDuplicate';

interface Props {
  candidates: DuplicateCandidate[];
  onConfirm: () => void;
  onCancel: () => void;
}

function formatDate(dateStr: string): string {
  // "2026-05-27" → "27/05/2026"
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function DuplicateWarningModal({ candidates, onConfirm, onCancel }: Props) {
  const { categories: customCategories } = useCustomCategories();

  // Trava scroll do body enquanto o modal está aberto — mesmo padrão do
  // EditExpenseModal/CategoryPickerSheet.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const shown = candidates.slice(0, 3);
  const extra = candidates.length - shown.length;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onCancel}
      />

      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2">
        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 16,
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            fontFamily: 'Nunito, sans-serif',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'rgba(234,179,8,0.12)',
                  border: '1.5px solid rgba(234,179,8,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={20} color="#eab308" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'var(--text)',
                    margin: 0,
                    marginBottom: 2,
                  }}
                >
                  Lançamento parecido encontrado
                </h2>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', margin: 0 }}>
                  Você já tem um lançamento similar nos últimos 45 dias:
                </p>
              </div>
              <button
                onClick={onCancel}
                aria-label="Fechar"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: 4,
                  marginTop: -2,
                  flexShrink: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Lista de candidatos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {shown.map((c) => {
                const cfg = getCategoryDisplay(c.category, customCategories);
                return (
                  <div
                    key={c.id}
                    style={{
                      background: 'var(--bg)',
                      border: '1.5px solid var(--border)',
                      borderRadius: 12,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        background: 'var(--logo-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      {cfg.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--text)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.description}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
                        {c.category} · {formatDate(c.date)}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {formatCurrency(c.amount)}
                    </span>
                  </div>
                );
              })}
              {extra > 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, textAlign: 'center' }}>
                  + {extra} {extra === 1 ? 'outro lançamento similar' : 'outros lançamentos similares'}
                </p>
              )}
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  background: 'transparent',
                  border: '1.5px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--text-2)',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'Nunito, sans-serif',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: 'Nunito, sans-serif',
                  cursor: 'pointer',
                }}
              >
                Salvar mesmo assim
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
