'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { apiUrl } from '@/lib/native';

type Category = 'bug' | 'sugestao' | 'elogio' | 'outro';

const CATEGORIES: { value: Category; emoji: string; label: string }[] = [
  { value: 'bug', emoji: '🐛', label: 'Bug' },
  { value: 'sugestao', emoji: '💡', label: 'Sugestão' },
  { value: 'elogio', emoji: '❤️', label: 'Elogio' },
  { value: 'outro', emoji: '💬', label: 'Outro' },
];

const MIN_LEN = 10;
const MAX_LEN = 500;

export const FEEDBACK_EVENT = 'open-feedback';

export function openFeedback() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FEEDBACK_EVENT));
  }
}

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener(FEEDBACK_EVENT, onOpen);
    return () => window.removeEventListener(FEEDBACK_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function closeModal() {
    setOpen(false);
    setTimeout(() => {
      setCategory(null);
      setMessage('');
      setError('');
      setSent(false);
    }, 200);
  }

  async function handleSubmit() {
    setError('');
    if (!category) {
      setError('Selecione uma categoria.');
      return;
    }
    const trimmed = message.trim();
    if (trimmed.length < MIN_LEN) {
      setError(`Descreva com pelo menos ${MIN_LEN} caracteres.`);
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch(apiUrl('/api/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: trimmed,
          page: pathname ?? null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) {
        setError(d.error ?? 'Erro ao enviar. Tente novamente.');
        return;
      }
      setSent(true);
      setTimeout(() => closeModal(), 1600);
    } catch {
      setError('Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r)',
              padding: 24,
              maxWidth: 460,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Fechar"
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} color="var(--text-2)" />
            </button>

            <h2 style={{ margin: '0 0 4px', fontWeight: 900, fontSize: 20, color: 'var(--text)' }}>
              Seu feedback
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>
              Nos ajude a melhorar o TôOrganizado
            </p>

            {sent ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 8px',
                }}
              >
                <div style={{ fontSize: 40 }} aria-hidden="true">✅</div>
                <p style={{ marginTop: 8, fontWeight: 800, color: 'var(--text)', fontSize: 16 }}>
                  Obrigado pelo feedback!
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  {CATEGORIES.map((c) => {
                    const active = category === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          padding: '12px 4px',
                          background: active ? 'var(--accent-bg)' : 'var(--bg)',
                          border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 12,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          color: 'var(--text)',
                          fontSize: 12,
                          fontWeight: 700,
                          transition: 'border-color 150ms, background 150ms',
                        }}
                      >
                        <span style={{ fontSize: 22 }} aria-hidden="true">{c.emoji}</span>
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
                  placeholder="Descreva com detalhes..."
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    color: 'var(--text)',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--text-3)',
                    marginTop: 6,
                    fontWeight: 600,
                  }}
                >
                  <span>Mín. {MIN_LEN} caracteres</span>
                  <span>{message.length}/{MAX_LEN}</span>
                </div>

                {error && (
                  <p
                    style={{
                      margin: '12px 0 0',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--red-bg)',
                      color: 'var(--red)',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    marginTop: 16,
                    padding: '12px 18px',
                    background: 'var(--accent)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    cursor: submitting ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 800,
                    fontSize: 15,
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Enviando…' : 'Enviar feedback'}
                </button>
              </>
            )}
          </div>
        </div>
  );
}
