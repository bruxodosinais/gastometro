'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Bot, Loader2, Check, X, RotateCcw } from 'lucide-react';
import { addExpense } from '@/lib/storage';
import { Category, EntryType } from '@/lib/types';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { ToastContainer, useToast } from '@/components/Toast';

function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ExpenseData = {
  description: string;
  amount: number;
  category: Category;
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

function getCategoryIcon(cat: string) {
  return (CATEGORY_CONFIG as Record<string, { icon: string }>)[cat]?.icon ?? '📦';
}

function ExpenseCard({
  expense,
  onConfirm,
  onCancel,
}: {
  expense: ExpenseData;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isIncome = expense.type === 'income';
  return (
    <div
      className={`rounded-xl border p-3.5 space-y-3 max-w-[85%] ${
        isIncome
          ? 'bg-mint-50 border-emerald-500/30'
          : 'bg-mint-50 border-mint-500/30'
      }`}
    >
      <p className={`text-xs font-semibold ${isIncome ? 'text-mint-500' : 'text-mint-500'}`}>
        {isIncome ? '💵 Nova receita detectada' : '💳 Novo gasto detectado'}
      </p>
      <div className="space-y-1">
        <p className="text-gray-900 text-sm font-medium">{expense.description}</p>
        <p className="text-gray-500 text-xs flex items-center gap-1.5">
          <span className={`text-base font-bold ${isIncome ? 'text-mint-500' : 'text-gray-900'}`}>
            {formatCurrency(expense.amount)}
          </span>
          <span>·</span>
          <span>{getCategoryIcon(expense.category)} {expense.category}</span>
          <span>·</span>
          <span>{formatDate(expense.date)}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-900 transition-colors ${
            isIncome ? 'bg-mint hover:bg-mint' : 'bg-mint hover:bg-mint-700'
          }`}
        >
          <Check size={12} /> Confirmar
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-300 transition-colors"
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
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          isIncome ? 'bg-mint-50 text-mint-500' : 'bg-mint-50 text-mint-500'
        }`}
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
      <div className="w-14 h-14 rounded-2xl bg-mint-50 flex items-center justify-center">
        <Bot size={28} className="text-mint-500" />
      </div>
      <div className="text-center space-y-1.5">
        <h2 className="text-gray-900 font-semibold text-base">Olá! Sou o GastôBot</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          Posso registrar lançamentos, analisar seus gastos e responder dúvidas financeiras.
        </p>
      </div>
      <div className="w-full max-w-sm space-y-2">
        <p className="text-xs text-gray-500 text-center">Sugestões</p>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="w-full text-left text-sm text-gray-500 hover:text-gray-900 bg-gray-50/60 hover:bg-gray-50 border border-gray-200/50 hover:border-slate-600 px-4 py-2.5 rounded-xl transition-colors"
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
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      // ignore parse errors
    }
  }, []);

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
      const res = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history, todayStr: localDateStr() }),
      });

      const data = await res.json();

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
      router.refresh();
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
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen bg-white">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-mint-50 flex items-center justify-center">
          <Bot size={20} className="text-mint-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-gray-900">GastôBot</h1>
          <p className="text-[11px] text-gray-500">Assistente financeiro com IA</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={newConversation}
            title="Nova conversa"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
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
                <div className="max-w-[80%] bg-mint text-gray-900 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={14} className="text-mint-500" />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div
                    className="inline-block max-w-[90%] bg-gray-50 text-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderBotText(msg.text) }}
                  />

                  {msg.expense && msg.expenseStatus === 'pending' && (
                    <ExpenseCard
                      expense={msg.expense}
                      onConfirm={() => confirmExpense(msg.id, msg.expense!)}
                      onCancel={() => cancelExpense(msg.id)}
                    />
                  )}
                  {msg.expense && msg.expenseStatus === 'confirmed' && (
                    <ConfirmedCard expense={msg.expense} />
                  )}
                  {msg.expense && msg.expenseStatus === 'cancelled' && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
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
            <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-mint-500" />
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3.5">
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Gastei R$ 50 no iFood hoje…"
            className="flex-1 bg-gray-50 text-gray-900 placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-violet-500 border border-gray-200 focus:border-mint-500 transition-colors"
            disabled={loading}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-mint hover:bg-mint-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin text-gray-900" />
            ) : (
              <Send size={16} className="text-gray-900" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
