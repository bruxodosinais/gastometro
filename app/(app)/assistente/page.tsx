'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, Loader2, Check, X, RotateCcw } from 'lucide-react';
import { addExpense } from '@/lib/storage';
import { fetchApi } from '@/lib/fetchApi';
import { CustomCategory, EntryType } from '@/lib/types';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { ToastContainer, useToast } from '@/components/Toast';
import { useSubscription } from '@/hooks/useSubscription';
import { PLAN_LIMITS } from '@/lib/planLimits';
import UpgradeBanner from '@/components/UpgradeBanner';
import { createClient } from '@/lib/supabase/client';

function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ExpenseData = {
  description: string;
  amount: number;
  category: string;
  type: EntryType;
  date: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  expense?: ExpenseData;
  expenseStatus?: 'pending' | 'confirmed' | 'cancelled';
};

const SUGGESTIONS = [
  'Onde estou gastando errado?',
  'Como sobrar R$2.000 esse mês?',
  'Como está meu patrimônio?',
  'O que posso cortar esse mês?',
];

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderBotText(text: string): string {
  // Escape HTML to prevent XSS, then apply safe formatting
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function ExpenseCard({
  expense,
  customs,
  onConfirm,
  onCancel,
}: {
  expense: ExpenseData;
  customs: CustomCategory[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isIncome = expense.type === 'income';
  return (
    <div
      className="rounded-xl border p-3.5 space-y-3 max-w-[85%]"
      style={{
        background: 'var(--accent-bg)',
        borderColor: 'var(--accent-soft, rgba(91,91,214,0.3))',
      }}
    >
      <p
        className="text-xs font-semibold"
        style={{ color: isIncome ? 'var(--green)' : 'var(--accent)' }}
      >
        {isIncome ? '💵 Nova receita detectada' : '💳 Novo gasto detectado'}
      </p>
      <div className="space-y-1">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{expense.description}</p>
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
          <span
            className="text-base font-bold"
            style={{ color: isIncome ? 'var(--green)' : 'var(--text)' }}
          >
            {formatCurrency(expense.amount)}
          </span>
          <span>·</span>
          <span>{getCategoryDisplay(expense.category, customs).icon} {expense.category}</span>
          <span>·</span>
          <span>{formatDate(expense.date)}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Check size={12} /> Confirmar
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ color: 'var(--text-2)', background: 'var(--bg)' }}
        >
          <X size={12} /> Cancelar
        </button>
      </div>
    </div>
  );
}

function ConfirmedCard({ expense }: { expense: ExpenseData }) {
  const isIncome = expense.type === 'income';
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{
          background: isIncome ? 'var(--green-bg)' : 'var(--accent-bg)',
          color: isIncome ? 'var(--green)' : 'var(--accent)',
        }}
      >
        <Check size={10} />
      </span>
      {isIncome ? 'Receita registrada' : 'Gasto registrado'} — {expense.description}{' '}
      {formatCurrency(expense.amount)}
    </div>
  );
}

function WelcomeScreen({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 space-y-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--accent-bg)' }}
      >
        <Bot size={28} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="text-center space-y-1.5">
        <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>Olá! Sou o GastôBot</h2>
        <p className="text-sm max-w-xs" style={{ color: 'var(--text-2)' }}>
          Posso registrar lançamentos, analisar seus gastos e responder dúvidas financeiras.
        </p>
      </div>
      <div className="w-full max-w-sm space-y-2">
        <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>Sugestões</p>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="w-full text-left text-sm px-4 py-2.5 rounded-xl transition-colors"
            style={{
              color: 'var(--text-2)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

const STORAGE_KEY = 'gastometro_chat_history';

export default function AssistentePage() {
  const { toasts, addToast, removeToast } = useToast();
  const subscription = useSubscription();
  const { categories: customs } = useCustomCategories();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const freeLimit = PLAN_LIMITS.free.gastoBotRequests;
  const isBlocked =
    subscription.isFree && usageCount !== null && usageCount >= freeLimit;

  // Clear any stale history so the assistant always opens with a clean state
  useEffect(() => {
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Fetch usage do mês para Free
  useEffect(() => {
    if (subscription.loading) return;
    if (!subscription.isFree) {
      setUsageCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const monthKey = new Date().toISOString().slice(0, 7);
        const { data } = await supabase
          .from('gastobot_usage')
          .select('count')
          .eq('user_id', user.id)
          .eq('month', monthKey)
          .maybeSingle();
        if (!cancelled) setUsageCount(data?.count ?? 0);
      } catch {
        if (!cancelled) setUsageCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [subscription.loading, subscription.isFree]);

  // Persist to sessionStorage whenever messages change
  const persistMessages = useCallback((msgs: Message[]) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function newConversation() {
    sessionStorage.removeItem(STORAGE_KEY);
    setMessages([]);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    if (isBlocked) return;

    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: text.trim() };

    setMessages((prev) => {
      const next = [...prev, userMsg];
      persistMessages(next);
      return next;
    });
    setInput('');
    setLoading(true);

    try {
      const res = await fetchApi('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history, todayStr: localDateStr() }),
      });

      const data = await res.json();

      if (res.status === 402 && data?.type === 'upgrade_required') {
        setUsageCount(freeLimit);
        const blockedMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.message || 'Limite gratuito atingido. Assine o Pro para acesso ilimitado.',
        };
        setMessages((prev) => {
          const next = [...prev, blockedMsg];
          persistMessages(next);
          return next;
        });
        return;
      }

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.message || 'Desculpe, não entendi.',
        ...(data.type === 'expense_detected' && data.expense
          ? { expense: data.expense, expenseStatus: 'pending' }
          : {}),
      };

      setMessages((prev) => {
        const next = [...prev, assistantMsg];
        persistMessages(next);
        return next;
      });

      if (subscription.isFree) {
        setUsageCount((c) => (c ?? 0) + 1);
      }
    } catch {
      setMessages((prev) => {
        const next = [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant' as const,
            text: 'Desculpe, ocorreu um erro. Tente novamente.',
          },
        ];
        persistMessages(next);
        return next;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function confirmExpense(msgId: string, expense: ExpenseData) {
    try {
      // Coerce amount to number in case it arrived as string from JSON
      await addExpense({ ...expense, amount: Number(expense.amount) });
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === msgId ? { ...m, expenseStatus: 'confirmed' as const } : m));
        persistMessages(next);
        return next;
      });
      addToast('Lançamento registrado!', 'success');
      // router.refresh() removido: a Home/Histórico são client-side. addExpense
      // já invalidou a cache de 'expenses'; o evento abaixo avisa o Histórico
      // (que escuta 'gastometro_expense_added') para recarregar na hora.
      window.dispatchEvent(new CustomEvent('gastometro_expense_added'));
    } catch (err) {
      console.error('confirmExpense:', err);
      const msg = err instanceof Error ? err.message : 'Erro ao salvar lançamento';
      addToast(msg, 'error');
    }
  }

  function cancelExpense(msgId: string) {
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === msgId ? { ...m, expenseStatus: 'cancelled' as const } : m));
      persistMessages(next);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen" style={{ background: 'var(--bg)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent-bg)' }}
        >
          <Bot size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>GastôBot</h1>
          <p className="text-[11px]" style={{ color: 'var(--text-2)' }}>Assistente financeiro com IA</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={newConversation}
            title="Nova conversa"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color: 'var(--text-2)', background: 'var(--bg)' }}
          >
            <RotateCcw size={13} />
            Nova
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <WelcomeScreen onSuggest={sendMessage} />
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div
                  className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {msg.text}
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5 items-start">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--accent-bg)' }}
                >
                  <Bot size={14} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div
                    className="inline-block max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    dangerouslySetInnerHTML={{ __html: renderBotText(msg.text) }}
                  />

                  {msg.expense && msg.expenseStatus === 'pending' && (
                    <ExpenseCard
                      expense={msg.expense}
                      customs={customs}
                      onConfirm={() => confirmExpense(msg.id, msg.expense!)}
                      onCancel={() => cancelExpense(msg.id)}
                    />
                  )}
                  {msg.expense && msg.expenseStatus === 'confirmed' && (
                    <ConfirmedCard expense={msg.expense} />
                  )}
                  {msg.expense && msg.expenseStatus === 'cancelled' && (
                    <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-2)' }}>
                      <X size={11} /> Lançamento cancelado
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 items-start">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-bg)' }}
            >
              <Bot size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: 'var(--text-3)' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: 'var(--text-3)' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: 'var(--text-3)' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input ou Upgrade Banner */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
      >
        {isBlocked ? (
          <UpgradeBanner
            variant="inline"
            feature="gastobot"
            message={`Você usou sua ${freeLimit === 1 ? '1 consulta gratuita' : `${freeLimit} consultas gratuitas`} do GastôBot este mês.`}
          />
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex: Gastei R$ 50 no iFood hoje…"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              disabled={loading}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-opacity hover:opacity-90 flex-shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" color="#fff" />
              ) : (
                <Send size={16} color="#fff" />
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
