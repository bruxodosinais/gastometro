'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getCachedUser } from '@/lib/dataCache';
import { ToastContainer, useToast } from '@/components/Toast';

const MIN_MESSAGE = 20;
const MAX_SUBJECT = 140;
const MAX_MESSAGE = 4000;

export const SUPPORT_EVENT = 'open-support';

export function openSupport() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SUPPORT_EVENT));
  }
}

export default function SupportButton() {
  const { toasts, addToast, removeToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener(SUPPORT_EVENT, onOpen);
    return () => window.removeEventListener(SUPPORT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      const user = await getCachedUser();
      if (!user || !mounted) return;
      const meta = user.user_metadata as Record<string, string> | undefined;
      const resolvedName =
        meta?.display_name ||
        meta?.full_name?.split(' ')[0] ||
        meta?.name?.split(' ')[0] ||
        user.email?.split('@')[0] ||
        '';
      setName(resolvedName);
      setEmail(user.email ?? '');
    })();
    return () => { mounted = false; };
  }, [open]);

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
      setSubject('');
      setMessage('');
      setError('');
    }, 200);
  }

  async function handleSubmit() {
    setError('');
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (!trimmedSubject) {
      setError('Informe o assunto.');
      return;
    }
    if (trimmedMessage.length < MIN_MESSAGE) {
      setError(`Descreva com pelo menos ${MIN_MESSAGE} caracteres.`);
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch('/api/suporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject: trimmedSubject,
          message: trimmedMessage,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) {
        setError(d.error ?? 'Erro ao enviar. Tente novamente.');
        return;
      }
      closeModal();
      addToast('Mensagem enviada! Responderemos em até 48h.', 'success');
    } catch {
      addToast('Erro ao enviar. Tente novamente ou escreva para contato@toorganizado.com.br', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {open && (
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
              Falar com suporte
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>
              Responderemos em até 48 horas úteis
            </p>

            {email && (
              <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                Resposta será enviada para <strong style={{ color: 'var(--text-2)' }}>{email}</strong>
              </p>
            )}

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Assunto
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
              placeholder="Ex.: dúvida sobre upgrade"
              maxLength={MAX_SUBJECT}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                outline: 'none',
                marginBottom: 14,
              }}
            />

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Mensagem
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              placeholder="Descreva com detalhes…"
              rows={6}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                fontFamily: 'inherit',
                fontSize: 14,
                color: 'var(--text)',
                resize: 'vertical',
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
              <span>Mín. {MIN_MESSAGE} caracteres</span>
              <span>{message.length}/{MAX_MESSAGE}</span>
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

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 'var(--r-sm)',
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-2)',
                  cursor: submitting ? 'default' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 800,
                  fontSize: 14,
                  opacity: submitting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                {submitting ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
