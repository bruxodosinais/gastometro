import { X } from 'lucide-react';
import { CreditCard as CreditCardType } from '@/lib/types';
import LoadingButton from '@/components/ui/LoadingButton';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { CardFormData } from './_shared';

interface AddEditProps {
  show: boolean;
  editingCard: CreditCardType | null;
  form: CardFormData;
  onFormChange: (form: CardFormData) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  formError: string | null;
}

export function CartaoAddEditModal({
  show,
  editingCard,
  form,
  onFormChange,
  onClose,
  onSave,
  saving,
  formError,
}: AddEditProps) {
  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
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
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
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
                    onChange={(e) => onFormChange({ ...form, [key]: e.target.value })}
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
                      onChange={(e) => onFormChange({ ...form, [key]: e.target.value })}
                      placeholder={placeholder}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px', fontSize: 14, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                ))}
              </div>

              {formError && <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px' }}>{formError}</p>}

              <LoadingButton
                onClick={onSave}
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
  );
}

interface DeleteProps {
  card: CreditCardType | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function CartaoDeleteModal({ card, onClose, onConfirm }: DeleteProps) {
  if (!card) return null;
  return (
    <ConfirmDeleteModal
      title="Excluir cartão"
      description={`"${card.nome}" será desativado. Os lançamentos vinculados a este cartão serão mantidos.`}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
