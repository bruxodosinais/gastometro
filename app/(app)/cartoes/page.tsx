'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, MoreVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  addCreditCard,
  deleteCreditCard,
  getCreditCardFatura,
  getCreditCards,
  updateCreditCard,
} from '@/lib/storage';
import { CreditCard as CreditCardType } from '@/lib/types';
import { formatCurrency } from '@/lib/calculations';
import { ToastContainer, useToast } from '@/components/Toast';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

function todayPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface CardFormData {
  nome: string;
  limite: string;
  diaFechamento: string;
  diaVencimento: string;
}

const EMPTY_FORM: CardFormData = { nome: '', limite: '', diaFechamento: '', diaVencimento: '' };

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
              return (
                <div
                  key={card.id}
                  className="bg-white border border-gray-100 rounded-2xl p-4 relative"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  <Link href={`/cartoes/${card.id}`} className="absolute inset-0 rounded-2xl z-0" aria-label={`Ver fatura ${card.nome}`} />
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
                    <div className="relative flex-shrink-0 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : card.id); }}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
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

                  <div className="flex gap-4 mb-3 text-xs text-gray-500">
                    <span>Fecha dia {card.diaFechamento}</span>
                    <span>Vence dia {card.diaVencimento}</span>
                  </div>

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
                  <p className="text-[10px] text-gray-400 mt-1 text-right">
                    {Math.round(fatPct)}% do limite utilizado
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>

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
