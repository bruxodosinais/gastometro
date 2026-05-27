'use client';

import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import {
  countCategoryReferences,
  createCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
  getCustomCategoryLimit,
} from '@/lib/storage';
import { CUSTOM_COLOR_PALETTE, EMOJI_CATALOG } from '@/lib/categoryConfig';
import type { CustomCategory, EntryType } from '@/lib/types';
import LoadingButton from '@/components/ui/LoadingButton';
import { getErrorMessage } from '@/lib/errors';

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; category: CustomCategory }
  | null;

// Estado do modal de exclusão. Descriminamos os 3 casos (carregando contagem,
// bloqueado por referências, confirmação) em vez de um único modal genérico,
// pra que o usuário só veja o botão "Excluir" quando ele é seguro de clicar.
type DeleteState =
  | { kind: 'counting'; category: CustomCategory }
  | { kind: 'blocked'; category: CustomCategory; count: number }
  | { kind: 'confirm'; category: CustomCategory }
  | null;

export default function MyCategoriesSection() {
  const { categories, loading, reload } = useCustomCategories();
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const limit = getCustomCategoryLimit();

  async function startDelete(category: CustomCategory) {
    setDeleteState({ kind: 'counting', category });
    try {
      const count = await countCategoryReferences(category.name);
      setDeleteState(
        count > 0
          ? { kind: 'blocked', category, count }
          : { kind: 'confirm', category },
      );
    } catch {
      // Falha na contagem: cai para o modal de confirmação (deleteCustomCategory
      // refaz o check no servidor — segunda camada). Preferimos seguir em vez
      // de bloquear toda a UX quando a rede vacila.
      setDeleteState({ kind: 'confirm', category });
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
            Minhas categorias
          </h2>
          {categories.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {categories.length} de {limit} categorias criadas
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          disabled={categories.length >= limit}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--r-sm)',
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: categories.length >= limit ? 'not-allowed' : 'pointer',
          }}
        >
          <Plus size={14} />
          Nova categoria
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Carregando…</p>
      ) : categories.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--r)',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Você ainda não criou categorias personalizadas
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            Use o botão acima para criar até {limit} categorias suas
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
                padding: '10px 14px',
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
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {cat.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  {cat.name}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
                  {cat.type === 'expense' ? 'Despesa' : 'Receita'}
                </p>
              </div>
              <button
                onClick={() => setModal({ mode: 'edit', category: cat })}
                aria-label="Editar"
                className="flex items-center justify-center"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  background: 'var(--logo-bg)',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => startDelete(cat)}
                disabled={deleteState?.category.id === cat.id}
                aria-label="Excluir"
                className="flex items-center justify-center disabled:opacity-60"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  background: 'var(--logo-bg)',
                  color: 'var(--text-3)',
                  cursor: deleteState?.category.id === cat.id ? 'wait' : 'pointer',
                }}
              >
                {deleteState?.kind === 'counting' && deleteState.category.id === cat.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <CategoryFormModal
          initial={modal.mode === 'edit' ? modal.category : null}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await reload();
            setModal(null);
          }}
        />
      )}

      {deleteState?.kind === 'blocked' && (
        <DeleteBlockedModal
          name={deleteState.category.name}
          count={deleteState.count}
          onClose={() => setDeleteState(null)}
        />
      )}

      {deleteState?.kind === 'confirm' && (
        <DeleteConfirmModal
          category={deleteState.category}
          onClose={() => setDeleteState(null)}
          onDeleted={async () => {
            await reload();
            setDeleteState(null);
          }}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de criar/editar
// ─────────────────────────────────────────────────────────────────────────────

function CategoryFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: CustomCategory | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<EntryType>(initial?.type ?? 'expense');
  const [icon, setIcon] = useState(initial?.icon ?? EMOJI_CATALOG[0]);
  const [color, setColor] = useState(initial?.color ?? CUSTOM_COLOR_PALETTE[0].color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = initial !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Nome é obrigatório');
      return;
    }
    if (trimmed.length > 30) {
      setError('Nome pode ter no máximo 30 caracteres');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && initial) {
        await updateCustomCategory(initial.id, { name: trimmed, icon, color });
      } else {
        await createCustomCategory({ name: trimmed, icon, color, type });
      }
      await onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2">
        <div className="bg-white border border-gray-100 rounded-2xl max-h-[90vh] overflow-y-auto">
          <div className="px-5 pb-6 pt-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-gray-900 font-semibold text-base">
                {isEdit ? 'Editar categoria' : 'Nova categoria'}
              </h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition-colors p-1" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Academia, Hobbies…"
                  maxLength={30}
                  required
                  style={{ fontSize: '16px' }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                />
                <p className="text-[10px] text-gray-400 mt-1">{name.length}/30</p>
              </div>

              {/* Tipo — só visível ao criar; edição mantém o tipo original */}
              {!isEdit && (
                <div>
                  <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                    Tipo
                  </label>
                  <div className="flex p-1 bg-gray-50 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                        type === 'expense' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                        type === 'income' ? 'bg-white text-mint-500 shadow' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Receita
                    </button>
                  </div>
                </div>
              )}

              {/* Ícone */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Ícone
                </label>
                <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto">
                  {EMOJI_CATALOG.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIcon(emoji)}
                      className={`flex items-center justify-center rounded-lg border transition-all ${
                        icon === emoji ? 'bg-mint-50 border-green-500/40' : 'bg-gray-50/50 border-gray-200 hover:border-gray-400'
                      }`}
                      style={{ width: '100%', aspectRatio: '1', fontSize: 18 }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Cor
                </label>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_COLOR_PALETTE.map((p) => (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => setColor(p.color)}
                      aria-label={p.color}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: p.color,
                        border: color === p.color ? '3px solid var(--text)' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <LoadingButton
                type="submit"
                loading={saving}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
              >
                {isEdit ? 'Salvar alterações' : 'Criar categoria'}
              </LoadingButton>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de confirmação de exclusão
// ─────────────────────────────────────────────────────────────────────────────

// Confirmação para categoria SEM lançamentos vinculados (pré-checado pelo
// caller). Ainda assim, deleteCustomCategory revalida no servidor — se uma
// race condition criar um lançamento entre o pré-check e o clique, o storage
// rejeita e mostramos a mensagem inline.
function DeleteConfirmModal({
  category,
  onClose,
  onDeleted,
}: {
  category: CustomCategory;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteCustomCategory(category.id);
      await onDeleted();
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2">
        <div className="bg-white border border-gray-100 rounded-2xl">
          <div className="px-5 pb-5 pt-5">
            <h2 className="text-gray-900 font-semibold text-base mb-3">
              Excluir &quot;{category.name}&quot;?
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Esta ação não pode ser desfeita.
            </p>
            {error && (
              <p className="text-sm text-red-600 mb-4">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <LoadingButton
                type="button"
                loading={deleting}
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center"
                style={{ background: '#ef4444' }}
              >
                Excluir
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Modal de bloqueio quando a categoria tem lançamentos vinculados.
// Sem botão "Excluir" — só "Entendi". Garante que o usuário não consiga clicar
// num caminho que vai necessariamente falhar.
function DeleteBlockedModal({
  name,
  count,
  onClose,
}: {
  name: string;
  count: number;
  onClose: () => void;
}) {
  const plural = count === 1 ? 'lançamento' : 'lançamentos';
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2">
        <div className="bg-white border border-gray-100 rounded-2xl">
          <div className="px-5 pb-5 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-gray-900 font-semibold text-base">
                Não é possível excluir
              </h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition-colors p-1" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Existem {count} {plural} com a categoria &quot;{name}&quot;.
              Reatribua-os para outra categoria antes de excluir.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
