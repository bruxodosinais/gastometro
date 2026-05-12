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
import { formatCurrency, getBillingMonthOptions, getMonthLabel } from '@/lib/calculations';
import { ToastContainer, useToast } from '@/components/Toast';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';

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

interface BankMapping {
  bankName: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  negativeIsExpense: boolean;
  creditCardId: string;
}

interface MappingFormData {
  bankName: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  negativeIsExpense: boolean;
  selectedCardId: string;
}

interface CSVData {
  headers: string[];
  rows: string[][];
}

interface ParseResult {
  transactions: RawTransaction[];
  skippedCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: CardFormData = { nome: '', limite: '', diaFechamento: '', diaVencimento: '' };
const LS_MAPPINGS_PREFIX = 'gastometro_bank_mappings';
const LS_MAPPINGS_VERSION = '3';

function lsKey(userId: string) {
  return `${LS_MAPPINGS_PREFIX}_${userId}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface MappingsStore {
  version: string;
  mappings: Record<string, BankMapping>;
}

function getBankMappings(userId: string): Record<string, BankMapping> {
  if (!userId) return {};
  try {
    const store: MappingsStore = JSON.parse(localStorage.getItem(lsKey(userId)) ?? '{}');
    if (store.version !== LS_MAPPINGS_VERSION) return {};
    return store.mappings ?? {};
  } catch {
    return {};
  }
}

function saveBankMapping(userId: string, headerKey: string, mapping: BankMapping) {
  if (!userId) return;
  const mappings = getBankMappings(userId);
  mappings[headerKey] = mapping;
  const store: MappingsStore = { version: LS_MAPPINGS_VERSION, mappings };
  localStorage.setItem(lsKey(userId), JSON.stringify(store));
}

// RFC 4180–compliant parser that handles quoted fields with embedded separators
function parseCSVLine(line: string, separator = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ─── Etapa 1: readCSVRobust ───────────────────────────────────────────────────

function readCSVRobust(file: File): Promise<CSVData> {
  function parseText(text: string): CSVData {
    const clean = text.replace(/^﻿/, '');
    const nonEmpty = clean
      .split('\n')
      .map((l) => l.replace(/\r/g, ''))
      .filter((l) => l.trim().length > 0);

    if (nonEmpty.length === 0) return { headers: [], rows: [] };

    const headerLine = nonEmpty[0].replace(/^﻿/, '');
    const sep = headerLine.includes(';') ? ';' : ',';
    const headers = parseCSVLine(headerLine, sep).map((h) => h.trim());
    const rows = nonEmpty.slice(1).map((l) =>
      parseCSVLine(l, sep).map((c) => c.trim())
    );
    return { headers, rows };
  }

  return new Promise((resolve, reject) => {
    const utf8Reader = new FileReader();
    utf8Reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      if (text.includes('�')) {
        const latinReader = new FileReader();
        latinReader.onload = (e2) => resolve(parseText((e2.target?.result as string) ?? ''));
        latinReader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        latinReader.readAsText(file, 'ISO-8859-1');
      } else {
        resolve(parseText(text));
      }
    };
    utf8Reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    utf8Reader.readAsText(file, 'UTF-8');
  });
}

// ─── parseNubankCSV (unchanged) ───────────────────────────────────────────────

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
        reject(new Error('not_nubank'));
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

// ─── Etapa 4: parseWithMapping ────────────────────────────────────────────────

function parseAmountBR(raw: string): number {
  const clean = raw
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  return parseFloat(clean);
}

function parseDateToISO(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return isNaN(new Date(raw).getTime()) ? null : raw;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('/');
    const iso = `${y}-${m}-${d}`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
  }
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(raw)) {
    const [d, m, y] = raw.split('/');
    const iso = `20${y}-${m}-${d}`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
  }
  return null;
}

function parseWithMapping(
  headers: string[],
  rows: string[][],
  mapping: BankMapping
): ParseResult {
  const colDate = headers.indexOf(mapping.dateColumn);
  const colDesc = headers.indexOf(mapping.descriptionColumn);
  const colAmount = headers.indexOf(mapping.amountColumn);

  if (colDate === -1 || colDesc === -1 || colAmount === -1) {
    return { transactions: [], skippedCount: rows.length };
  }

  const transactions: RawTransaction[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    const rawDate = row[colDate]?.trim() ?? '';
    const description = row[colDesc]?.trim() ?? '';
    const rawAmount = row[colAmount]?.trim() ?? '';

    const date = parseDateToISO(rawDate);
    const amount = parseAmountBR(rawAmount);

    if (!date || !description || isNaN(amount)) {
      skippedCount++;
      continue;
    }
    if (amount === 0) continue;

    if (mapping.negativeIsExpense) {
      if (amount >= 0) continue;
      transactions.push({ date, description, amount: Math.abs(amount), nubank_category: '' });
    } else {
      if (amount <= 0) continue;
      transactions.push({ date, description, amount, nubank_category: '' });
    }
  }

  return { transactions, skippedCount };
}

// ─── mapToAppCategory (unchanged) ────────────────────────────────────────────

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
  const [deletingCard, setDeletingCard] = useState<CreditCardType | null>(null);
  const [form, setForm] = useState<CardFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  // Authenticated user id — used to scope localStorage keys
  const userIdRef = useRef<string>('');

  // Import — core flow
  const importRef = useRef<HTMLInputElement>(null);
  const importingCardIdRef = useRef<string | null>(null);
  const [importFlow, setImportFlow] = useState<'idle' | 'parsing' | 'preview' | 'inserting'>(
    'idle'
  );
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [currentBankName, setCurrentBankName] = useState('Nubank');
  const [skippedCount, setSkippedCount] = useState(0);
  const [importBillingMonth, setImportBillingMonth] = useState(todayPeriod());

  // Import — card picker sheet (Nubank + stale savedMapping)
  const [showCardPickerSheet, setShowCardPickerSheet] = useState(false);
  const [cardPickerSelectedId, setCardPickerSelectedId] = useState('');
  const pendingNubankTransactionsRef = useRef<RawTransaction[]>([]);
  const pendingMappingAfterCardPickRef = useRef<BankMapping | null>(null);

  // Import — raw data preview
  const [showRawPreview, setShowRawPreview] = useState(false);
  const [csvRawData, setCsvRawData] = useState<CSVData>({ headers: [], rows: [] });

  // Import — mapping modal
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingForm, setMappingForm] = useState<MappingFormData>({
    bankName: '',
    dateColumn: '',
    descriptionColumn: '',
    amountColumn: '',
    negativeIsExpense: false,
    selectedCardId: '',
  });
  const pendingHeaderKeyRef = useRef<string>('');

  // Import — inline new card form (inside mapping modal)
  const [showNewCardInline, setShowNewCardInline] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardClosingDay, setNewCardClosingDay] = useState('');
  const [newCardDueDay, setNewCardDueDay] = useState('');
  const [creatingNewCard, setCreatingNewCard] = useState(false);

  const period = todayPeriod();

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!openMenuId) return;
    function close() { setOpenMenuId(null); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  async function loadAll() {
    setLoadError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userIdRef.current = user.id;
        const key = lsKey(user.id);
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const store = JSON.parse(raw);
            if (store.version !== LS_MAPPINGS_VERSION) localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
      const c = await getCreditCards();
      setCards(c);
      const fatMap: Record<string, number> = {};
      await Promise.all(
        c.map(async (card) => { fatMap[card.id] = await getCreditCardFatura(card.id, period); })
      );
      setFaturas(fatMap);
      setReady(true);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
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
      diaFechamento: card.diaFechamento != null ? String(card.diaFechamento) : '',
      diaVencimento: card.diaVencimento != null ? String(card.diaVencimento) : '',
    });
    setFormError(null);
    setShowModal(true);
  }

  function validateForm(): string | null {
    if (!form.nome.trim()) return 'Informe o nome do cartão';
    const limite = parseFloat(form.limite.replace(',', '.'));
    if (!limite || limite <= 0) return 'Informe o limite do cartão';
    if (form.diaFechamento) {
      const fech = parseInt(form.diaFechamento);
      if (isNaN(fech) || fech < 1 || fech > 28) return 'Dia de fechamento deve ser entre 1 e 28';
    }
    if (form.diaVencimento) {
      const venc = parseInt(form.diaVencimento);
      if (isNaN(venc) || venc < 1 || venc > 28) return 'Dia de vencimento deve ser entre 1 e 28';
    }
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
        diaFechamento: form.diaFechamento ? parseInt(form.diaFechamento) : null,
        diaVencimento: form.diaVencimento ? parseInt(form.diaVencimento) : null,
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

  // Unchanged: AI categorization + duplicate check + preview setup
  async function processTransactions(raw: RawTransaction[], cardId: string) {
    if (raw.length === 0) {
      addToast('Nenhuma transação encontrada no arquivo.', 'error');
      setImportFlow('idle');
      return;
    }

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

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

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
      existingRows = (data ?? []) as Array<{ date: string; description: string; amount: number }>;
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
  }

  async function handleProcessWithMapping(mapping: BankMapping, cardId: string) {
    importingCardIdRef.current = cardId;

    const { transactions, skippedCount: sc } = parseWithMapping(
      csvRawData.headers,
      csvRawData.rows,
      mapping
    );
    setSkippedCount(sc);

    if (transactions.length === 0) {
      const msg =
        sc > 0
          ? `Nenhuma transação válida. ${sc} linha${sc !== 1 ? 's' : ''} com dados inválidos.`
          : 'Nenhuma transação encontrada no arquivo.';
      addToast(msg, 'error');
      return;
    }

    setImportFlow('parsing');
    try {
      await processTransactions(transactions, cardId);
    } catch {
      addToast('Erro ao processar arquivo', 'error');
      setImportFlow('idle');
    }
  }

  // Step 1: read file → Nubank goes to card picker, generic goes to raw preview
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportFlow('parsing');
    setImportBillingMonth(todayPeriod());

    // Try Nubank first
    let nubankResult: RawTransaction[] | null = null;
    let nubankError: Error | null = null;
    try {
      nubankResult = await parseNubankCSV(file);
    } catch (err) {
      nubankError = err instanceof Error ? err : new Error('Erro ao processar arquivo');
    }

    if (nubankError && nubankError.message !== 'not_nubank') {
      addToast(nubankError.message, 'error');
      setImportFlow('idle');
      return;
    }

    if (nubankResult !== null) {
      // Nubank detected — store transactions and show card picker
      pendingNubankTransactionsRef.current = nubankResult;
      setCurrentBankName('Nubank');
      setSkippedCount(0);
      setCardPickerSelectedId(cards[0]?.id ?? '');
      setImportFlow('idle');
      setShowCardPickerSheet(true);
      return;
    }

    // Not Nubank — read robustly and show raw preview
    try {
      const csvData = await readCSVRobust(file);
      if (csvData.headers.length === 0) {
        addToast('Não foi possível ler as colunas do arquivo.', 'error');
        setImportFlow('idle');
        return;
      }

      const headerKey = csvData.headers.join('|');
      pendingHeaderKeyRef.current = headerKey;
      setCsvRawData(csvData);
      setImportFlow('idle');
      setShowRawPreview(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      addToast(msg, 'error');
      setImportFlow('idle');
    }
  }

  // Card picker confirm — used by Nubank path and stale-creditCardId path
  function handleCardPickerConfirm() {
    const cardId = cardPickerSelectedId;
    importingCardIdRef.current = cardId;
    setShowCardPickerSheet(false);

    if (pendingNubankTransactionsRef.current.length > 0) {
      const txns = pendingNubankTransactionsRef.current;
      pendingNubankTransactionsRef.current = [];
      setImportFlow('parsing');
      processTransactions(txns, cardId).catch(() => {
        addToast('Erro ao processar arquivo', 'error');
        setImportFlow('idle');
      });
    } else if (pendingMappingAfterCardPickRef.current) {
      const updatedMapping = { ...pendingMappingAfterCardPickRef.current, creditCardId: cardId };
      saveBankMapping(userIdRef.current, pendingHeaderKeyRef.current, updatedMapping);
      pendingMappingAfterCardPickRef.current = null;
      handleProcessWithMapping(updatedMapping, cardId);
    }
  }

  // Raw preview confirmed → check saved mapping
  function handleRawPreviewConfirm() {
    setShowRawPreview(false);
    const candidate = getBankMappings(userIdRef.current)[pendingHeaderKeyRef.current];

    const isMappingStillValid =
      candidate &&
      csvRawData.headers.includes(candidate.dateColumn) &&
      csvRawData.headers.includes(candidate.descriptionColumn) &&
      csvRawData.headers.includes(candidate.amountColumn);

    if (isMappingStillValid) {
      const cardStillExists = cards.some((c) => c.id === candidate.creditCardId);
      if (cardStillExists) {
        setCurrentBankName(candidate.bankName);
        handleProcessWithMapping(candidate, candidate.creditCardId);
      } else {
        // Card was deleted — ask user to pick a new one
        pendingMappingAfterCardPickRef.current = candidate;
        setCurrentBankName(candidate.bankName);
        setCardPickerSelectedId(cards[0]?.id ?? '');
        setShowCardPickerSheet(true);
      }
    } else {
      // Open mapping modal with smart defaults
      const h = csvRawData.headers;
      const find = (keywords: string[]) =>
        h.find((col) => keywords.some((kw) => col.toLowerCase().includes(kw)));

      const dateColumn =
        find(['data', 'date', 'dt']) ?? h[0] ?? '';
      const descriptionColumn =
        find(['estabelecimento', 'descrição', 'descricao', 'description', 'titulo', 'título', 'title', 'loja', 'merchant']) ?? h[1] ?? '';
      const amountColumn =
        find(['valor', 'value', 'amount', 'quantia', 'total']) ?? h[h.length - 1] ?? '';

      setMappingForm({
        bankName: '',
        dateColumn,
        descriptionColumn,
        amountColumn,
        negativeIsExpense: false,
        selectedCardId: cards[0]?.id ?? '',
      });
      resetInlineCardForm();
      setShowMappingModal(true);
    }
  }

  function resetInlineCardForm() {
    setShowNewCardInline(false);
    setNewCardName('');
    setNewCardLimit('');
    setNewCardClosingDay('');
    setNewCardDueDay('');
  }

  function closeMappingModal() {
    setShowMappingModal(false);
    resetInlineCardForm();
  }

  async function handleCreateAndLink() {
    const nome = newCardName.trim();
    if (!nome) return;
    setCreatingNewCard(true);
    try {
      const created = await addCreditCard({
        nome,
        limite: parseFloat(newCardLimit.replace(',', '.')) || 0,
        diaFechamento: parseInt(newCardClosingDay) || null,
        diaVencimento: parseInt(newCardDueDay) || null,
        ativo: true,
      });
      if (!created?.id) throw new Error('Cartão criado mas ID não retornado pelo servidor');
      setCards((prev) => [...prev, created]);
      setFaturas((prev) => ({ ...prev, [created.id]: 0 }));
      setCardPickerSelectedId(created.id);
      setMappingForm((f) => ({ ...f, selectedCardId: created.id }));
      resetInlineCardForm();
      addToast(`Cartão ${created.nome} criado`, 'success');
    } catch {
      addToast('Erro ao criar cartão', 'error');
    } finally {
      setCreatingNewCard(false);
    }
  }

  function isMappingValid(): boolean {
    const { bankName, dateColumn, descriptionColumn, amountColumn, selectedCardId } = mappingForm;
    if (!bankName.trim() || !dateColumn || !descriptionColumn || !amountColumn || !selectedCardId)
      return false;
    return new Set([dateColumn, descriptionColumn, amountColumn]).size === 3;
  }

  function handleMappingConfirm() {
    const cardId = mappingForm.selectedCardId;
    const mapping: BankMapping = {
      bankName: mappingForm.bankName.trim(),
      dateColumn: mappingForm.dateColumn,
      descriptionColumn: mappingForm.descriptionColumn,
      amountColumn: mappingForm.amountColumn,
      negativeIsExpense: mappingForm.negativeIsExpense,
      creditCardId: cardId,
    };
    saveBankMapping(userIdRef.current, pendingHeaderKeyRef.current, mapping);
    setShowMappingModal(false);
    setCurrentBankName(mapping.bankName);
    handleProcessWithMapping(mapping, cardId);
  }

  function updatePreviewCategory(index: number, category: ExpenseCategory) {
    setPreviewItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selectedCategory: category } : item))
    );
  }

  // Unchanged: insert to Supabase
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const billingMonthDate = `${importBillingMonth}-01`;
      const rows = toInsert.map((t) => ({
        user_id: user.id,
        amount: t.amount,
        description: t.description,
        category: t.selectedCategory,
        date: t.date,
        is_credit: true,
        credit_card_id: cardId,
        type: 'expense',
        billing_month: billingMonthDate,
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
      setSkippedCount(0);

      const [newFatura] = await Promise.all([
        getCreditCardFatura(cardId, importBillingMonth),
        getExpensesByCard(cardId, importBillingMonth),
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

  const mappingColsAreDuplicated =
    mappingForm.dateColumn &&
    mappingForm.descriptionColumn &&
    mappingForm.amountColumn &&
    new Set([mappingForm.dateColumn, mappingForm.descriptionColumn, mappingForm.amountColumn])
      .size < 3;

  function getColExample(colName: string): string {
    const idx = csvRawData.headers.indexOf(colName);
    if (idx === -1) return '';
    return csvRawData.rows[0]?.[idx] ?? '';
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!ready) {
    if (loadError) {
      return (
        <main className="max-w-lg mx-auto px-4 pt-16 pb-10 flex flex-col items-center gap-4 text-center">
          <p className="text-4xl">😕</p>
          <p className="text-gray-700 font-medium">{loadError}</p>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-600 transition-colors"
          >
            <Loader2 size={15} className="hidden" />
            Tentar novamente
          </button>
        </main>
      );
    }
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
          <>
            <div className="space-y-3">
              {cards.map((card) => {
                const fatura = faturas[card.id] ?? 0;
                const fatPct = card.limite > 0 ? Math.min((fatura / card.limite) * 100, 100) : 0;
                const isMenuOpen = openMenuId === card.id;

                return (
                  <div
                    key={card.id}
                    className="bg-white border border-gray-100 rounded-2xl p-4 relative cursor-pointer transition-shadow hover:shadow-md"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    <Link
                      href={`/cartoes/${card.id}`}
                      className="absolute inset-0 rounded-2xl z-0"
                      aria-label={`Ver fatura ${card.nome}`}
                    />

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

                    {(card.diaFechamento || card.diaVencimento) && (
                      <div className="flex gap-4 mb-3 text-xs text-gray-500">
                        {card.diaFechamento && <span>Fecha dia {card.diaFechamento}</span>}
                        {card.diaVencimento && <span>Vence dia {card.diaVencimento}</span>}
                      </div>
                    )}

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
                    <p className="text-[11px] text-gray-400 mt-0.5">Ver lançamentos →</p>
                  </div>
                );
              })}
            </div>

            {/* ── Global import button (Mudança 1) ────────────────────────── */}
            <button
              onClick={() => importRef.current?.click()}
              disabled={importFlow !== 'idle'}
              className="w-full mt-4 py-3 rounded-xl text-sm font-medium text-blue-600 border border-blue-200 bg-white flex items-center justify-center gap-2 transition-colors hover:bg-blue-50 active:scale-95 disabled:opacity-50"
            >
              {importFlow === 'parsing' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              Importar fatura CSV
            </button>
          </>
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

      {/* Parsing overlay (AI phase) */}
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

      {/* ── Card picker sheet (Nubank + stale mapping) ───────────────────────── */}
      {showCardPickerSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-gray-900 font-bold text-lg">Importar fatura</h2>
              <p className="text-gray-500 text-sm mt-1">
                Selecione o cartão para vincular as transações
              </p>
            </div>

            <div className="px-5 py-5">
              <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                Vincular ao cartão
              </label>
              {showNewCardInline ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
                  <input
                    type="text"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                    placeholder="Nome do cartão (ex: XP, Inter, Itaú...)"
                    maxLength={40}
                    autoFocus
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={newCardLimit}
                    onChange={(e) => setNewCardLimit(e.target.value)}
                    placeholder="Limite em R$ (opcional)"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={28}
                      value={newCardClosingDay}
                      onChange={(e) => setNewCardClosingDay(e.target.value)}
                      placeholder="Fecha dia (opcional)"
                      className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={28}
                      value={newCardDueDay}
                      onChange={(e) => setNewCardDueDay(e.target.value)}
                      placeholder="Vence dia (opcional)"
                      className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-0.5">
                    <button
                      onClick={handleCreateAndLink}
                      disabled={!newCardName.trim() || creatingNewCard}
                      className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    >
                      {creatingNewCard && <Loader2 size={13} className="animate-spin" />}
                      Criar e vincular
                    </button>
                    <button
                      onClick={resetInlineCardForm}
                      className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2.5"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={cardPickerSelectedId}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setShowNewCardInline(true);
                    } else {
                      setCardPickerSelectedId(e.target.value);
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
                >
                  <option value="" disabled>Selecionar cartão...</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>{card.nome}</option>
                  ))}
                  <option value="__new__">+ Adicionar novo cartão</option>
                </select>
              )}
            </div>

            <div className="px-5 pb-6 flex gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  setShowCardPickerSheet(false);
                  resetInlineCardForm();
                  pendingNubankTransactionsRef.current = [];
                  pendingMappingAfterCardPickRef.current = null;
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCardPickerConfirm}
                disabled={!cardPickerSelectedId || showNewCardInline}
                className="py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ flex: 2, background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Raw data preview modal ───────────────────────────────────────────── */}
      {showRawPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '85vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-gray-900 font-bold text-lg">Verifique os dados do arquivo</h2>
              <p className="text-gray-500 text-sm mt-1">
                {csvRawData.rows.length} linha{csvRawData.rows.length !== 1 ? 's' : ''} encontrada
                {csvRawData.rows.length !== 1 ? 's' : ''} — os dados abaixo estão corretos?
              </p>
            </div>

            <div className="flex-1 overflow-auto px-4 py-3">
              <div className="overflow-x-auto">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr>
                      {csvRawData.headers.map((h) => (
                        <th
                          key={h}
                          className="text-left text-gray-500 font-semibold px-2 py-1.5 bg-gray-50 border-b border-gray-100 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRawData.rows.slice(0, 5).map((row, ri) => (
                      <tr key={ri} className="border-b border-gray-50">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="px-2 py-1.5 text-gray-700 whitespace-nowrap"
                            style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
              <button
                onClick={() => {
                  setShowRawPreview(false);
                  importRef.current?.click();
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Arquivo errado
              </button>
              <button
                onClick={handleRawPreviewConfirm}
                className="py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                style={{ flex: 2, background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                Está correto, continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mapping modal ────────────────────────────────────────────────────── */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '90vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-gray-900 font-bold text-lg">Formato não reconhecido</h2>
                <button
                  onClick={closeMappingModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                Configure uma vez e o app vai lembrar para próximas importações
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Card selection */}
              <div>
                <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                  Vincular ao cartão
                </label>
                {showNewCardInline ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
                    <input
                      type="text"
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      placeholder="Nome do cartão (ex: XP, Inter, Itaú...)"
                      maxLength={40}
                      autoFocus
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={newCardLimit}
                      onChange={(e) => setNewCardLimit(e.target.value)}
                      placeholder="Limite em R$ (opcional)"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={28}
                        value={newCardClosingDay}
                        onChange={(e) => setNewCardClosingDay(e.target.value)}
                        placeholder="Fecha dia (opcional)"
                        className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={28}
                        value={newCardDueDay}
                        onChange={(e) => setNewCardDueDay(e.target.value)}
                        placeholder="Vence dia (opcional)"
                        className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-0.5">
                      <button
                        onClick={handleCreateAndLink}
                        disabled={!newCardName.trim() || creatingNewCard}
                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                      >
                        {creatingNewCard && <Loader2 size={13} className="animate-spin" />}
                        Criar e vincular
                      </button>
                      <button
                        onClick={resetInlineCardForm}
                        className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2.5"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={mappingForm.selectedCardId}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowNewCardInline(true);
                      } else {
                        setMappingForm((f) => ({ ...f, selectedCardId: e.target.value }));
                      }
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
                  >
                    <option value="" disabled>Selecionar cartão...</option>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>{card.nome}</option>
                    ))}
                    <option value="__new__">+ Adicionar novo cartão</option>
                  </select>
                )}
              </div>

              {/* Bank name */}
              <div>
                <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                  Nome do banco
                </label>
                <input
                  type="text"
                  value={mappingForm.bankName}
                  onChange={(e) => setMappingForm((f) => ({ ...f, bankName: e.target.value }))}
                  placeholder="Ex: Inter, C6, Itaú..."
                  maxLength={40}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                />
              </div>

              {/* Detected columns chips */}
              <div>
                <p className="text-gray-700 text-xs font-semibold mb-2">
                  Identificamos {csvRawData.headers.length} colunas no seu arquivo:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {csvRawData.headers.map((col) => (
                    <span
                      key={col}
                      className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-mono"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Column mapping with examples */}
              <div className="space-y-4">
                <div>
                  <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                    Coluna da Data
                  </label>
                  <select
                    value={mappingForm.dateColumn}
                    onChange={(e) => setMappingForm((f) => ({ ...f, dateColumn: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
                  >
                    {csvRawData.headers.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  {mappingForm.dateColumn && getColExample(mappingForm.dateColumn) && (
                    <p className="text-gray-400 text-xs mt-1 ml-1">
                      ex: {getColExample(mappingForm.dateColumn)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                    Coluna da Descrição
                  </label>
                  <select
                    value={mappingForm.descriptionColumn}
                    onChange={(e) =>
                      setMappingForm((f) => ({ ...f, descriptionColumn: e.target.value }))
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
                  >
                    {csvRawData.headers.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  {mappingForm.descriptionColumn && getColExample(mappingForm.descriptionColumn) && (
                    <p className="text-gray-400 text-xs mt-1 ml-1">
                      ex: {getColExample(mappingForm.descriptionColumn)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                    Coluna do Valor
                  </label>
                  <select
                    value={mappingForm.amountColumn}
                    onChange={(e) =>
                      setMappingForm((f) => ({ ...f, amountColumn: e.target.value }))
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
                  >
                    {csvRawData.headers.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  {mappingForm.amountColumn && getColExample(mappingForm.amountColumn) && (
                    <p className="text-gray-400 text-xs mt-1 ml-1">
                      ex: {getColExample(mappingForm.amountColumn)}
                    </p>
                  )}
                </div>

                {mappingColsAreDuplicated && (
                  <p className="text-red-400 text-xs">
                    Selecione colunas diferentes para cada campo.
                  </p>
                )}
              </div>

              {/* Negative toggle */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-gray-700 text-sm font-medium">
                    Os gastos vêm como valores negativos?
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMappingForm((f) => ({ ...f, negativeIsExpense: !f.negativeIsExpense }))
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      mappingForm.negativeIsExpense ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    aria-checked={mappingForm.negativeIsExpense}
                    role="switch"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                        mappingForm.negativeIsExpense ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-gray-400 text-xs">
                  {mappingForm.negativeIsExpense
                    ? 'Valores negativos (ex: -50,00) serão tratados como gastos'
                    : 'Valores positivos (ex: 50,00) serão tratados como gastos'}
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
              <button
                onClick={closeMappingModal}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleMappingConfirm}
                disabled={!isMappingValid()}
                className="py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{ flex: 2, background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview modal ─────────────────────────────────────────────────────── */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '85vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-gray-900 font-bold text-lg">
                Importar fatura {currentBankName}
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">
                {nonDupsWithIdx.length} transaç
                {nonDupsWithIdx.length !== 1 ? 'ões' : 'ão'} encontrada
                {nonDupsWithIdx.length !== 1 ? 's' : ''}
              </p>

              {/* Billing month selector */}
              <div className="mt-3">
                <label className="text-gray-500 text-xs font-medium block mb-1.5">
                  Mês de referência da fatura
                </label>
                <select
                  value={importBillingMonth}
                  onChange={(e) => setImportBillingMonth(e.target.value)}
                  disabled={importFlow === 'inserting'}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors disabled:opacity-60"
                >
                  {getBillingMonthOptions().map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

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
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <span className="text-red-500 font-semibold text-xs whitespace-nowrap flex-shrink-0">
                      −{formatCurrency(item.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
              {dupCount > 0 && (
                <p className="text-gray-400 text-xs mb-2 text-center">
                  {dupCount} item{dupCount !== 1 ? 's' : ''} ignorado
                  {dupCount !== 1 ? 's' : ''} (já existem)
                </p>
              )}
              {skippedCount > 0 && (
                <p className="text-gray-400 text-xs mb-3 text-center">
                  {skippedCount} linha{skippedCount !== 1 ? 's' : ''} ignorada
                  {skippedCount !== 1 ? 's' : ''} (valor inválido, data inválida ou descrição vazia)
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setImportFlow('idle'); setPreviewItems([]); }}
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

      {/* Modal add/edit cartão */}
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
