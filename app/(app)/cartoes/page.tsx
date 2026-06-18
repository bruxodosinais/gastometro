'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { apiUrl } from '@/lib/native';
import {
  addCreditCard,
  deleteCreditCard,
  getCreditCardFatura,
  getCreditCards,
  getExpensesByCard,
  updateCreditCard,
} from '@/lib/storage';
import { CreditCard as CreditCardType, ExpenseCategory, EXPENSE_CATEGORIES } from '@/lib/types';
import { ToastContainer, useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradeBanner from '@/components/UpgradeBanner';

import CartaoHeader from '../_components/cartoes/CartaoHeader';
import CartaoListEmpty from '../_components/cartoes/CartaoListEmpty';
import CartaoCard from '../_components/cartoes/CartaoCard';
import { CartaoAddEditModal, CartaoDeleteModal } from '../_components/cartoes/CartaoModals';
import {
  CartaoParsingOverlay,
  CartaoCardPickerSheet,
  CartaoRawPreviewModal,
  CartaoMappingModal,
  CartaoPreviewImportModal,
} from '../_components/cartoes/CartaoImportFlow';
import {
  BankMapping,
  CardFormData,
  CSVData,
  EMPTY_FORM,
  LS_MAPPINGS_VERSION,
  MappingFormData,
  PreviewItem,
  RawTransaction,
  getBankMappings,
  lsKey,
  mapToAppCategory,
  parseNubankCSV,
  parseWithMapping,
  readCSVRobust,
  saveBankMapping,
  todayPeriod,
} from '../_components/cartoes/_shared';

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

  async function processTransactions(raw: RawTransaction[], cardId: string) {
    if (raw.length === 0) {
      addToast('Nenhuma transação encontrada no arquivo.', 'error');
      setImportFlow('idle');
      return;
    }

    let categorized: Array<{ id: number; category: string }> = [];
    try {
      const res = await fetch(apiUrl('/api/categorizar-csv'), {
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

  function handleCardPickerCancel() {
    setShowCardPickerSheet(false);
    resetInlineCardForm();
    pendingNubankTransactionsRef.current = [];
    pendingMappingAfterCardPickRef.current = null;
  }

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

  function handleRawPreviewWrongFile() {
    setShowRawPreview(false);
    importRef.current?.click();
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

  const mappingColsAreDuplicated = Boolean(
    mappingForm.dateColumn &&
    mappingForm.descriptionColumn &&
    mappingForm.amountColumn &&
    new Set([mappingForm.dateColumn, mappingForm.descriptionColumn, mappingForm.amountColumn])
      .size < 3
  );

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
            style={{ background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 700, padding: '10px 20px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer' }}
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
        <CartaoHeader onAdd={openAdd} />

        {cards.length === 0 ? (
          <CartaoListEmpty onAdd={openAdd} />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cards.map((card) => (
                <CartaoCard
                  key={card.id}
                  card={card}
                  fatura={faturas[card.id] ?? 0}
                  period={period}
                  isMenuOpen={openMenuId === card.id}
                  onToggleMenu={setOpenMenuId}
                  onEdit={openEdit}
                  onDelete={setDeletingCard}
                />
              ))}
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

      <CartaoParsingOverlay show={importFlow === 'parsing'} />

      <CartaoCardPickerSheet
        show={showCardPickerSheet}
        cards={cards}
        cardPickerSelectedId={cardPickerSelectedId}
        onCardPickerSelectedIdChange={setCardPickerSelectedId}
        showNewCardInline={showNewCardInline}
        onShowNewCardInline={setShowNewCardInline}
        newCardName={newCardName}
        onNewCardNameChange={setNewCardName}
        newCardLimit={newCardLimit}
        onNewCardLimitChange={setNewCardLimit}
        newCardClosingDay={newCardClosingDay}
        onNewCardClosingDayChange={setNewCardClosingDay}
        newCardDueDay={newCardDueDay}
        onNewCardDueDayChange={setNewCardDueDay}
        creatingNewCard={creatingNewCard}
        onCreateAndLink={handleCreateAndLink}
        onResetInlineCardForm={resetInlineCardForm}
        onCancel={handleCardPickerCancel}
        onConfirm={handleCardPickerConfirm}
      />

      <CartaoRawPreviewModal
        show={showRawPreview}
        csvRawData={csvRawData}
        onWrongFile={handleRawPreviewWrongFile}
        onConfirm={handleRawPreviewConfirm}
      />

      <CartaoMappingModal
        show={showMappingModal}
        cards={cards}
        csvRawData={csvRawData}
        mappingForm={mappingForm}
        onMappingFormChange={setMappingForm}
        mappingColsAreDuplicated={mappingColsAreDuplicated}
        getColExample={getColExample}
        isMappingValid={isMappingValid()}
        showNewCardInline={showNewCardInline}
        onShowNewCardInline={setShowNewCardInline}
        newCardName={newCardName}
        onNewCardNameChange={setNewCardName}
        newCardLimit={newCardLimit}
        onNewCardLimitChange={setNewCardLimit}
        newCardClosingDay={newCardClosingDay}
        onNewCardClosingDayChange={setNewCardClosingDay}
        newCardDueDay={newCardDueDay}
        onNewCardDueDayChange={setNewCardDueDay}
        creatingNewCard={creatingNewCard}
        onCreateAndLink={handleCreateAndLink}
        onResetInlineCardForm={resetInlineCardForm}
        onClose={closeMappingModal}
        onConfirm={handleMappingConfirm}
      />

      <CartaoPreviewImportModal
        show={showPreviewModal}
        importFlow={importFlow}
        currentBankName={currentBankName}
        previewItems={previewItems}
        nonDupsWithIdx={nonDupsWithIdx}
        dupCount={dupCount}
        skippedCount={skippedCount}
        importBillingMonth={importBillingMonth}
        onImportBillingMonthChange={setImportBillingMonth}
        onUpdatePreviewCategory={updatePreviewCategory}
        onCancel={() => { setImportFlow('idle'); setPreviewItems([]); }}
        onConfirm={handleConfirmImport}
      />

      <CartaoAddEditModal
        show={showModal}
        editingCard={editingCard}
        form={form}
        onFormChange={setForm}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        saving={saving}
        formError={formError}
      />

      <CartaoDeleteModal
        card={deletingCard}
        onClose={() => setDeletingCard(null)}
        onConfirm={async () => {
          await deleteCreditCard(deletingCard!.id);
          setCards((prev) => prev.filter((c) => c.id !== deletingCard!.id));
          addToast('Cartão removido', 'success');
        }}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
