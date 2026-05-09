'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  CreditCard,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  addCreditCard,
  deleteCreditCard,
  getCreditCardFatura,
  getCreditCards,
  getExpensesByCard,
  updateCreditCard,
} from '@/lib/storage';
import { CreditCard as CreditCardType, ExpenseCategory, EXPENSE_CATEGORIES } from '@/lib/types';
import { formatCurrency } from '@/lib/calculations';
import { ToastContainer, useToast } from '@/components/Toast';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardFormData {
  nome: string;
  limite: string;
  diaFechamento: string;
  diaVencimento: string;
}

interface RawTransaction {
  date: string;
  description: string;
  amount: number;
  nubank_category: string;
}

interface PreviewItem extends RawTransaction {
  selectedCategory: ExpenseCategory;
  isDuplicate: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const EMPTY_FORM: CardFormData = { nome: '', limite: '', diaFechamento: '', diaVencimento: '' };

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseNubankCSV(file: File): Promise<RawTransaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = (e.target?.result as string) ?? '';
      const text = raw.replace(/^﻿/, '');
      const lines = text
        .split('\n')
        .map((l) => l.replace(/\r/g, ''))
        .filter((l) => l.trim());

      if (lines.length < 2) {
        reject(new Error('Arquivo vazio'));
        return;
      }

      // Discover column indices dynamically to support both formats:
      //   3-column (current Nubank): date,title,amount
      //   4-column (legacy):         date,category,title,amount
      const headerParts = parseCSVLine(lines[0].toLowerCase());
      const colDate = headerParts.findIndex((h) => h.trim() === 'date');
      const colTitle = headerParts.findIndex((h) => h.trim() === 'title');
      const colAmount = headerParts.findIndex((h) => h.trim() === 'amount');
      const colCategory = headerParts.findIndex((h) => h.trim() === 'category');

      if (colDate === -1 || colTitle === -1 || colAmount === -1) {
        reject(new Error('Arquivo não reconhecido como fatura Nubank'));
        return;
      }

      const result: RawTransaction[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        const date = parts[colDate]?.trim() ?? '';
        const description = parts[colTitle]?.trim() ?? '';
        const amountStr = parts[colAmount]?.trim() ?? '';
        const nubank_category = colCategory !== -1 ? (parts[colCategory]?.trim() ?? '') : '';
        const amount = parseFloat(amountStr);

        if (!date || !description || isNaN(amount)) continue;
        // Nubank exports expenses as positive values; negative = payment received — skip those
        if (amount < 0) continue;

        result.push({ date, description, amount, nubank_category });
      }

      resolve(result);
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

function mapToAppCategory(nubankCat: string): ExpenseCategory {
  const map: Record<string, ExpenseCategory> = {
    'alimentação': 'Alimentação',
    'supermercado': 'Alimentação',
    'restaurante': 'Alimentação',
    'transporte': 'Transporte',
    'moradia': 'Moradia',
    'saúde': 'Saúde',
    'lazer': 'Lazer',
    'educação': 'Educação',
    'vestuário': 'Vestuário',
    'delivery': 'Delivery',
    'internet': 'Internet',
    'assinatura': 'Assinaturas',
    'assinaturas': 'Assinaturas',
    'farmácia': 'Farmácia',
    'farmacia': 'Farmácia',
    'combustível': 'Combustível',
    'telefone': 'Telefone',
    'beleza': 'Beleza',
    'pet': 'Pet',
    'viagem': 'Viagem',
    'investimentos': 'Investimentos',
  };
  return map[nubankCat.toLowerCase().trim()] ?? 'Outros';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CartoesPage() {
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [faturas, setFaturas] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
  const [deletingCard, setDeletingCard] = useState<CreditCardType | null>(null);
  const [form, setForm] = useState<CardFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  // Import state
  const importRef = useRef<HTMLInputElement>(null);
  const importingCardIdRef = useRef<string | null>(null);
  const [importFlow, setImportFlow] = useState<'idle' | 'parsing' | 'preview' | 'inserting'>(
    'idle'
  );
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);

  const period = todayPeriod();

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    function close() { setOpenMenuId(null); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  async function loadAll() {
    const c = await getCreditCards();
    setCards(c);
    const fatMap: Record<string, number> = {};
    await Promise.all(
      c.map(async (card) => {
        fatMap[card.id] = await getCreditCardFatura(card.id, period);
      })
    );
    setFaturas(fatMap);
    setReady(true);
  }

  function openAdd() {
    setEditingCard(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(card: CreditCardType) {
    setEditingCard(card);
    setForm({
      nome: card.nome,
      limite: String(card.limite),
      diaFechamento: String(card.diaFechamento),
      diaVencimento: String(card.diaVencimento),
    });
    setFormError(null);
    setShowModal(true);
  }

  function validateForm(): string | null {
    if (!form.nome.trim()) return 'Informe o nome do cartão';
    const limite = parseFloat(form.limite.replace(',', '.'));
    if (!limite || limite <= 0) return 'Informe o limite do cartão';
    const fech = parseInt(form.diaFechamento);
    if (!fech || fech < 1 || fech > 28) return 'Dia de fechamento deve ser entre 1 e 28';
    const venc = parseInt(form.diaVencimento);
    if (!venc || venc < 1 || venc > 28) return 'Dia de vencimento deve ser entre 1 e 28';
    return null;
  }

  async function handleSave() {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        nome: form.nome.trim(),
        limite: parseFloat(form.limite.replace(',', '.')),
        diaFechamento: parseInt(form.diaFechamento),
        diaVencimento: parseInt(form.diaVencimento),
        ativo: true,
      };
      if (editingCard) {
        const updated = await updateCreditCard(editingCard.id, payload);
        setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        addToast('Cartão atualizado', 'success');
      } else {
        const created = await addCreditCard(payload);
        setCards((prev) => [...prev, created]);
        setFaturas((prev) => ({ ...prev, [created.id]: 0 }));
        addToast('Cartão adicionado', 'success');
      }
      setShowModal(false);
    } catch {
      setFormError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Import handlers ────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const cardId = importingCardIdRef.current;
    if (!cardId) return;

    setImportFlow('parsing');
    try {
      const raw = await parseNubankCSV(file);
      if (raw.length === 0) {
        addToast('Nenhuma transação encontrada no arquivo.', 'error');
        setImportFlow('idle');
        return;
      }

      // Categorize via AI
      let categorized: Array<{ id: number; category: string }> = [];
      try {
        const res = await fetch('/api/categorizar-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactions: raw.map((t, i) => ({
              id: i,
              description: t.description,
              nubank_category: t.nubank_category,
            })),
          }),
        });
        const json = await res.json();
        categorized = json.categories ?? [];
      } catch {
        // Fallback: mapToAppCategory used below
      }

      // Check duplicates
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const importDates = raw.map((t) => t.date).sort();
      let existingRows: Array<{ date: string; description: string; amount: number }> = [];
      if (user) {
        const { data } = await supabase
          .from('expenses')
          .select('date, description, amount')
          .eq('credit_card_id', cardId)
          .eq('user_id', user.id)
          .eq('is_credit', true)
          .gte('date', importDates[0])
          .lte('date', importDates[importDates.length - 1]);
        existingRows = (data ?? []) as Array<{
          date: string;
          description: string;
          amount: number;
        }>;
      }

      const items: PreviewItem[] = raw.map((t, i) => {
        const catEntry = categorized.find((c) => c.id === i);
        const aiCatStr = catEntry?.category;
        const selectedCategory: ExpenseCategory =
          aiCatStr && (EXPENSE_CATEGORIES as string[]).includes(aiCatStr)
            ? (aiCatStr as ExpenseCategory)
            : mapToAppCategory(t.nubank_category);

        const isDuplicate = existingRows.some(
          (e) =>
            e.date === t.date &&
            e.description.toLowerCase() === t.description.toLowerCase() &&
            Math.abs(e.amount - t.amount) < 0.01
        );

        return { ...t, selectedCategory, isDuplicate };
      });

      setPreviewItems(items);
      setImportFlow('preview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      addToast(msg, 'error');
      setImportFlow('idle');
    }
  }

  function updatePreviewCategory(index: number, category: ExpenseCategory) {
    setPreviewItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selectedCategory: category } : item))
    );
  }

  async function handleConfirmImport() {
    const cardId = importingCardIdRef.current;
    if (!cardId) return;

    const toInsert = previewItems.filter((t) => !t.isDuplicate);
    if (toInsert.length === 0) {
      setImportFlow('idle');
      setPreviewItems([]);
      return;
    }

    setImportFlow('inserting');
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const rows = toInsert.map((t) => ({
        user_id: user.id,
        amount: t.amount,
        description: t.description,
        category: t.selectedCategory,
        date: t.date,
        is_credit: true,
        credit_card_id: cardId,
        type: 'expense',
      }));

      const { error } = await supabase.from('expenses').insert(rows);
      if (error) throw error;

      const count = toInsert.length;
      addToast(
        `${count} transaç${count !== 1 ? 'ões' : 'ão'} importada${count !== 1 ? 's' : ''}!`,
        'success'
      );
      setImportFlow('idle');
      setPreviewItems([]);

      // Refresh fatura do cartão importado
      const [newFatura] = await Promise.all([
        getCreditCardFatura(cardId, period),
        // Também recarregar os outros campos se necessário
        getExpensesByCard(cardId, period),
      ]);
      setFaturas((prev) => ({ ...prev, [cardId]: newFatura }));
    } catch {
      addToast('Erro ao importar. Tente novamente.', 'error');
      setImportFlow('preview');
    }
  }

  const showPreviewModal = importFlow === 'preview' || importFlow === 'inserting';
  const nonDupsWithIdx = previewItems
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !item.isDuplicate);
  const dupCount = previewItems.length - nonDupsWithIdx.length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <main className="max-w-lg md:max-w-[600px] mx-auto px-4 pt-8 pb-28">
        <div className="skeleton h-7 w-36 rounded-lg mb-2" />
        <div className="skeleton h-4 w-52 rounded mb-6" />
        {[0, 1].map((i) => <div key={i} className="skeleton h-32 rounded-2xl mb-3" />)}
      </main>
    );
  }

  return (
    <>
      <main className="max-w-lg md:max-w-[600px] mx-auto px-4 pt-8 pb-28">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Cartões</h1>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
          >
            <Plus size={16} />
            Adicionar
          </button>
        </div>
        <p className="text-gray-500 text-sm mb-6">Gerencie seus cartões de crédito</p>

        {cards.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-5xl mb-3">💳</p>
            <p className="text-gray-900 font-semibold text-lg mb-2">Nenhum cartão cadastrado</p>
            <p className="text-gray-500 text-sm mb-5 max-w-[260px] mx-auto">
              Adicione seus cartões de crédito para controlar as faturas mensais.
            </p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
            >
              <Plus size={16} />
              Adicionar cartão
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => {
              const fatura = faturas[card.id] ?? 0;
              const fatPct = card.limite > 0 ? Math.min((fatura / card.limite) * 100, 100) : 0;
              const isMenuOpen = openMenuId === card.id;
              const isImporting = importFlow !== 'idle' && importingCardIdRef.current === card.id;

              return (
                <div
                  key={card.id}
                  className="bg-white border border-gray-100 rounded-2xl p-4 relative cursor-pointer transition-shadow hover:shadow-md"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  {/* Full-card navigation link */}
                  <Link
                    href={`/cartoes/${card.id}`}
                    className="absolute inset-0 rounded-2xl z-0"
                    aria-label={`Ver fatura ${card.nome}`}
                  />

                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <CreditCard size={18} color="#3b82f6" />
                      </div>
                      <div>
                        <p className="text-gray-900 font-semibold text-sm">{card.nome}</p>
                        <p className="text-gray-500 text-xs">Limite {formatCurrency(card.limite)}</p>
                      </div>
                    </div>

                    {/* Chevron + menu — z-10 to be above the Link */}
                    <div className="relative flex-shrink-0 z-10 flex items-center gap-0.5">
                      <ChevronRight size={15} className="text-gray-300" aria-hidden="true" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : card.id);
                        }}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                        aria-label="Opções"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {isMenuOpen && (
                        <div className="absolute right-0 top-8 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[120px]">
                          <button
                            onClick={() => { openEdit(card); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          <button
                            onClick={() => { setDeletingCard(card); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex gap-4 mb-3 text-xs text-gray-500">
                    <span>Fecha dia {card.diaFechamento}</span>
                    <span>Vence dia {card.diaVencimento}</span>
                  </div>

                  {/* Fatura row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">
                      Fatura {period.slice(5, 7)}/{period.slice(0, 4)}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: fatura > 0 ? '#f04e5e' : '#9ca3af' }}
                    >
                      {formatCurrency(fatura)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${fatPct}%`,
                        background:
                          fatPct >= 90 ? '#ef4444' : fatPct >= 70 ? '#f97316' : '#3b82f6',
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {Math.round(fatPct)}% do limite utilizado
                  </p>

                  {/* Navigation hint */}
                  <p className="text-[11px] text-gray-400 mt-0.5">Ver lançamentos →</p>

                  {/* Import button — z-10 to be above the Link */}
                  <div className="relative z-10 mt-3">
                    <button
                      onClick={() => {
                        importingCardIdRef.current = card.id;
                        importRef.current?.click();
                      }}
                      disabled={importFlow !== 'idle'}
                      className="w-full py-2 rounded-xl text-xs font-medium text-blue-600 border border-blue-100 bg-blue-50/60 hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isImporting && importFlow === 'parsing' ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Upload size={12} />
                      )}
                      Importar fatura CSV
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Hidden file input */}
      <input
        ref={importRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Parsing overlay */}
      {importFlow === 'parsing' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div
            className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 mx-4"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.16)' }}
          >
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-gray-700 font-semibold text-sm text-center">
              Analisando transações com IA...
            </p>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '85vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-gray-900 font-bold text-lg">Importar fatura Nubank</h2>
              <p className="text-gray-500 text-sm mt-0.5">
                {nonDupsWithIdx.length} transaç
                {nonDupsWithIdx.length !== 1 ? 'ões' : 'ão'} encontrada
                {nonDupsWithIdx.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {nonDupsWithIdx.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-gray-500 text-sm">Todas as transações já existem.</p>
                </div>
              ) : (
                nonDupsWithIdx.map(({ item, i }) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-10 flex-shrink-0 font-mono tabular-nums">
                      {item.date.slice(8)}/{item.date.slice(5, 7)}
                    </span>
                    <span className="flex-1 text-sm text-gray-900 truncate min-w-0">
                      {item.description.charAt(0).toUpperCase() + item.description.slice(1)}
                    </span>
                    <select
                      value={item.selectedCategory}
                      onChange={(e) =>
                        updatePreviewCategory(i, e.target.value as ExpenseCategory)
                      }
                      disabled={importFlow === 'inserting'}
                      className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 text-gray-700 bg-white flex-shrink-0 max-w-[108px] disabled:opacity-60"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <span className="text-red-500 font-semibold text-xs whitespace-nowrap flex-shrink-0">
                      −{formatCurrency(item.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
              {dupCount > 0 && (
                <p className="text-gray-400 text-xs mb-3 text-center">
                  {dupCount} item{dupCount !== 1 ? 's' : ''} ignorado
                  {dupCount !== 1 ? 's' : ''} (já existem)
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setImportFlow('idle');
                    setPreviewItems([]);
                  }}
                  disabled={importFlow === 'inserting'}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importFlow === 'inserting' || nonDupsWithIdx.length === 0}
                  className="py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                  style={{ flex: 2, background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  {importFlow === 'inserting' ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Importando...
                    </>
                  ) : (
                    'Confirmar importação'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal add/edit */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 md:inset-0 md:flex md:items-center md:justify-center md:px-4">
            <div className="bg-white border-t border-gray-100 rounded-t-2xl md:border md:rounded-2xl md:w-full md:max-w-md">
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
              <div className="px-5 pb-6 pt-3 md:pt-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-gray-900 font-semibold text-base">
                    {editingCard ? 'Editar cartão' : 'Novo cartão'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-500 hover:text-gray-900 transition-colors p-1"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-500 text-xs font-medium block mb-1.5">
                      Nome do cartão
                    </label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                      placeholder="Ex: Nubank, Inter, Itaú..."
                      maxLength={40}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 text-xs font-medium block mb-1.5">
                      Limite (R$)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={form.limite}
                      onChange={(e) => setForm((f) => ({ ...f, limite: e.target.value }))}
                      placeholder="0,00"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-500 text-xs font-medium block mb-1.5">
                        Dia de fechamento
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={28}
                        value={form.diaFechamento}
                        onChange={(e) => setForm((f) => ({ ...f, diaFechamento: e.target.value }))}
                        placeholder="Ex: 10"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium block mb-1.5">
                        Dia de vencimento
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={28}
                        value={form.diaVencimento}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, diaVencimento: e.target.value }))
                        }
                        placeholder="Ex: 20"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                      />
                    </div>
                  </div>

                  {formError && <p className="text-red-400 text-sm">{formError}</p>}

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
                  >
                    {saving
                      ? 'Salvando...'
                      : editingCard
                      ? 'Salvar alterações'
                      : 'Adicionar cartão'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {deletingCard && (
        <ConfirmDeleteModal
          title="Excluir cartão"
          description={`"${deletingCard.nome}" será desativado. Os lançamentos vinculados a este cartão serão mantidos.`}
          onConfirm={async () => {
            await deleteCreditCard(deletingCard.id);
            setCards((prev) => prev.filter((c) => c.id !== deletingCard.id));
            addToast('Cartão removido', 'success');
          }}
          onClose={() => setDeletingCard(null)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
