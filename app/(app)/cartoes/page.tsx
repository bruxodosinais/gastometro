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
import LoadingButton from '@/components/ui/LoadingButton';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradeBanner from '@/components/UpgradeBanner';

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
  const subscription = useSubscription();
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
        <main style={{ maxWidth: 440, margin: '0 auto', padding: '64px 16px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 48 }}>😕</p>
          <p style={{ color: 'var(--text-2)', fontWeight: 600 }}>{loadError}</p>
          <button
            onClick={loadAll}
            style={{ background: 'var(--green)', color: 'white', fontSize: 14, fontWeight: 700, padding: '10px 20px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </main>
      );
    }
    return (
      <main style={{ maxWidth: 440, margin: '0 auto', padding: '24px 16px 112px' }}>
        <div className="skeleton h-7 w-36 rounded-lg mb-2" />
        <div className="skeleton h-4 w-52 rounded mb-6" />
        {[0, 1].map((i) => <div key={i} className="skeleton h-32 rounded-2xl mb-3" />)}
      </main>
    );
  }

  if (!subscription.loading && subscription.isFree) {
    return (
      <main style={{ maxWidth: 440, margin: '0 auto', paddingTop: 24, paddingBottom: 112 }}>
        <UpgradeBanner
          variant="fullpage"
          feature="cartoes"
          message="Cartões de crédito são exclusivos do plano Pro. Gerencie limites, faturas e parcelas com facilidade."
        />
      </main>
    );
  }

  return (
    <>
      <main style={{ maxWidth: 440, margin: '0 auto', paddingTop: 24, paddingBottom: 112 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 16px', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Cartões</h1>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>Gerencie seus cartões de crédito</p>
          </div>
          <button
            onClick={openAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--green)', color: 'white',
              fontSize: 12, fontWeight: 700,
              borderRadius: 20, border: 'none',
              padding: '6px 14px', cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>

        {cards.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>💳</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Nenhum cartão cadastrado</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginBottom: 20, maxWidth: 260, margin: '0 auto 20px' }}>
              Adicione seus cartões de crédito para controlar as faturas mensais.
            </p>
            <button
              onClick={openAdd}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--green)', color: 'white', fontSize: 13, fontWeight: 700, borderRadius: 'var(--r-sm)', border: 'none', padding: '10px 20px', cursor: 'pointer' }}
            >
              <Plus size={15} />
              Adicionar cartão
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cards.map((card) => {
                const fatura = faturas[card.id] ?? 0;
                const fatPct = card.limite > 0 ? Math.min((fatura / card.limite) * 100, 100) : 0;
                const isMenuOpen = openMenuId === card.id;

                return (
                  <div
                    key={card.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border)',
                      borderRadius: 'var(--r)',
                      padding: '16px 18px',
                      margin: '0 16px',
                      position: 'relative',
                      boxShadow: 'var(--card-shadow)',
                    }}
                  >
                    <Link
                      href={`/cartoes/${card.id}`}
                      style={{ position: 'absolute', inset: 0, borderRadius: 'var(--r)', zIndex: 0 }}
                      aria-label={`Ver fatura ${card.nome}`}
                    />

                    {/* Card header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, background: 'var(--accent-bg)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CreditCard size={16} color="var(--accent)" />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{card.nome}</p>
                          {(card.diaFechamento || card.diaVencimento) && (
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginTop: 1 }}>
                              {card.diaFechamento ? `Fecha dia ${card.diaFechamento}` : ''}
                              {card.diaFechamento && card.diaVencimento ? ' · ' : ''}
                              {card.diaVencimento ? `Vence dia ${card.diaVencimento}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div style={{ position: 'relative', flexShrink: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ChevronRight size={15} color="var(--border)" aria-hidden="true" />
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : card.id); }}
                          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                          aria-label="Opções"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {isMenuOpen && (
                          <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden', minWidth: 120 }}>
                            <button onClick={() => { openEdit(card); setOpenMenuId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>
                              <Pencil size={12} /> Editar
                            </button>
                            <button onClick={() => { setDeletingCard(card); setOpenMenuId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid var(--border-2)' }}>
                              <Trash2 size={12} /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fatura */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
                        Fatura {period.slice(5, 7)}/{period.slice(0, 4)}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: fatura > 0 ? 'var(--red)' : 'var(--text)' }}>
                        {formatCurrency(fatura)}
                      </span>
                    </div>

                    {/* Barra de limite */}
                    <div style={{ height: 4, background: 'var(--red-bg)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${fatPct}%`, background: 'var(--red)', transition: 'width 400ms ease' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)' }}>
                        {Math.round(fatPct)}% do limite utilizado
                      </p>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Ver lançamentos →</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Importar fatura CSV */}
            <button
              onClick={() => importRef.current?.click()}
              disabled={importFlow !== 'idle'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: 'calc(100% - 32px)',
                margin: '12px 16px 0',
                padding: 14,
                background: 'var(--surface)',
                border: '1.5px solid var(--accent-soft)',
                borderRadius: 'var(--r)',
                fontSize: 13, fontWeight: 700, color: 'var(--accent)',
                cursor: 'pointer',
                opacity: importFlow !== 'idle' ? 0.5 : 1,
              }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, margin: '0 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.16)' }}
          >
            <Loader2 size={32} className="animate-spin" color="var(--accent)" />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', textAlign: 'center', margin: 0 }}>
              Analisando transações com IA...
            </p>
          </div>
        </div>
      )}

      {/* ── Card picker sheet (Nubank + stale mapping) ───────────────────────── */}
      {showCardPickerSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 512, display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>

            <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Importar fatura</h2>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
                Selecione o cartão para vincular as transações
              </p>
            </div>

            <div className="px-5 py-5">
              <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                Vincular ao cartão
              </label>
              {showNewCardInline ? (
                <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                    placeholder="Nome do cartão (ex: XP, Inter, Itaú...)"
                    maxLength={40}
                    autoFocus
                    style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={newCardLimit}
                    onChange={(e) => setNewCardLimit(e.target.value)}
                    placeholder="Limite em R$ (opcional)"
                    style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
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
                      style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={28}
                      value={newCardDueDay}
                      onChange={(e) => setNewCardDueDay(e.target.value)}
                      placeholder="Vence dia (opcional)"
                      style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-0.5">
                    <button
                      onClick={handleCreateAndLink}
                      disabled={!newCardName.trim() || creatingNewCard}
                      className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5"
                      style={{ background: 'var(--green)' }}
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

            <div style={{ padding: '0 20px 24px', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => {
                  setShowCardPickerSheet(false);
                  resetInlineCardForm();
                  pendingNubankTransactionsRef.current = [];
                  pendingMappingAfterCardPickRef.current = null;
                }}
                style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCardPickerConfirm}
                disabled={!cardPickerSelectedId || showNewCardInline}
                style={{ flex: 2, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'white', background: 'var(--green)', border: 'none', cursor: 'pointer', opacity: (!cardPickerSelectedId || showNewCardInline) ? 0.6 : 1 }}
              >
                Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Raw data preview modal ───────────────────────────────────────────── */}
      {showRawPreview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 512, display: 'flex', flexDirection: 'column', maxHeight: '85vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>

            <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Verifique os dados do arquivo</h2>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
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

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setShowRawPreview(false);
                  importRef.current?.click();
                }}
                style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}
              >
                Arquivo errado
              </button>
              <button
                onClick={handleRawPreviewConfirm}
                style={{ flex: 2, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'white', background: 'var(--green)', border: 'none', cursor: 'pointer' }}
              >
                Está correto, continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mapping modal ────────────────────────────────────────────────────── */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 512, display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>

            <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Formato não reconhecido</h2>
                <button
                  onClick={closeMappingModal}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-3)' }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
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
                  <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      placeholder="Nome do cartão (ex: XP, Inter, Itaú...)"
                      maxLength={40}
                      autoFocus
                      style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={newCardLimit}
                      onChange={(e) => setNewCardLimit(e.target.value)}
                      placeholder="Limite em R$ (opcional)"
                      style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
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
                        style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={28}
                        value={newCardDueDay}
                        onChange={(e) => setNewCardDueDay(e.target.value)}
                        placeholder="Vence dia (opcional)"
                        style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
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

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
              <button
                onClick={closeMappingModal}
                style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleMappingConfirm}
                disabled={!isMappingValid()}
                style={{ flex: 2, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'white', background: 'var(--green)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: !isMappingValid() ? 0.6 : 1 }}
              >
                Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview modal ─────────────────────────────────────────────────────── */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 512, display: 'flex', flexDirection: 'column', maxHeight: '85vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                Importar fatura {currentBankName}
              </h2>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
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

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              {dupCount > 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, textAlign: 'center' }}>
                  {dupCount} item{dupCount !== 1 ? 's' : ''} ignorado
                  {dupCount !== 1 ? 's' : ''} (já existem)
                </p>
              )}
              {skippedCount > 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, textAlign: 'center' }}>
                  {skippedCount} linha{skippedCount !== 1 ? 's' : ''} ignorada
                  {skippedCount !== 1 ? 's' : ''} (valor inválido, data inválida ou descrição vazia)
                </p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setImportFlow('idle'); setPreviewItems([]); }}
                  disabled={importFlow === 'inserting'}
                  style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', opacity: importFlow === 'inserting' ? 0.5 : 1 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importFlow === 'inserting' || nonDupsWithIdx.length === 0}
                  style={{ flex: 2, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'white', background: 'var(--green)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (importFlow === 'inserting' || nonDupsWithIdx.length === 0) ? 0.6 : 1 }}
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
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 md:inset-0 md:flex md:items-center md:justify-center md:px-4">
            <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderRadius: '20px 20px 0 0' }} className="md:border md:rounded-2xl md:w-full md:max-w-md">
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
              </div>
              <div style={{ padding: '12px 20px 24px' }} className="md:pt-5">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                    {editingCard ? 'Editar cartão' : 'Novo cartão'}
                  </h2>
                  <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { label: 'Nome do cartão', key: 'nome' as const, type: 'text', placeholder: 'Ex: Nubank, Inter, Itaú...', maxLength: 40 },
                    { label: 'Limite (R$)', key: 'limite' as const, type: 'number', placeholder: '0,00' },
                  ].map(({ label, key, type, placeholder, maxLength }) => (
                    <div key={key}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>{label}</label>
                      <input
                        type={type}
                        inputMode={type === 'number' ? 'decimal' : undefined}
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        maxLength={maxLength}
                        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px', fontSize: 14, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
                      />
                    </div>
                  ))}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Dia fechamento', key: 'diaFechamento' as const, placeholder: 'Ex: 10' },
                      { label: 'Dia vencimento', key: 'diaVencimento' as const, placeholder: 'Ex: 20' },
                    ].map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>{label}</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1} max={28}
                          value={form[key]}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px', fontSize: 14, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
                        />
                      </div>
                    ))}
                  </div>

                  {formError && <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px' }}>{formError}</p>}

                  <LoadingButton
                    onClick={handleSave}
                    loading={saving}
                    loadingText="Salvando..."
                    style={{ width: '100%', padding: '14px 0', borderRadius: 'var(--r-sm)', background: 'var(--green)', border: 'none', fontSize: 14, fontWeight: 800, color: 'white', cursor: 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {editingCard ? 'Salvar alterações' : 'Adicionar cartão'}
                  </LoadingButton>
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
