'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, PieChart, X } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { getErrorMessage } from '@/lib/errors';
import CurrencyInput from '@/components/CurrencyInput';
import LoadingButton from '@/components/ui/LoadingButton';
import { budgetStatusStyles } from '@/components/BudgetLimitHint';

// Aviso na CONFIRMAÇÃO do lançamento. Mesma casa visual do
// DuplicateWarningModal (overlay, trava de scroll, ESC, botões lado a lado).
// NUNCA bloqueia: o botão primário sempre deixa o lançamento passar.
export type BudgetWarningModalProps =
  | {
      mode: 'limit';
      status: 'danger' | 'over';
      category: string;
      limit: number;
      spent: number;
      extra: number; // valor do gasto que está sendo lançado agora
      projected: number;
      projectedPct: number;
      overBy: number;
      // Nome do mês quando o lançamento não é do mês corrente (senão null).
      monthLabel?: string | null;
      onConfirm: () => void;
      onAdjust: () => void;
    }
  | {
      mode: 'no-budget';
      category: string;
      // Segue o lançamento sem definir limite.
      onSkip: () => void;
      // Grava o limite e SÓ ENTÃO segue o lançamento (pode rejeitar).
      onDefine: (amount: number) => Promise<void>;
    };

const overlayStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.55)' };

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 16,
  boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
  fontFamily: 'Nunito, sans-serif',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const ghostButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '11px 14px',
  background: 'transparent',
  border: '1.5px solid var(--border)',
  borderRadius: 12,
  color: 'var(--text-2)',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'Nunito, sans-serif',
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '11px 14px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 12,
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  fontFamily: 'Nunito, sans-serif',
  cursor: 'pointer',
};

function Row({
  label,
  value,
  color,
  strong,
}: {
  label: string;
  value: string;
  color?: string;
  strong?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      <span
        style={{
          fontSize: strong ? 15 : 13,
          fontWeight: strong ? 900 : 700,
          color: color ?? 'var(--text)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function BudgetWarningModal(props: BudgetWarningModalProps) {
  const { category } = props;
  // Fechar NUNCA pode gravar no banco. No modo 'limit' fechar = "Ajustar
  // valor" (cancela). No modo 'no-budget' não há caminho de fechamento
  // implícito: o usuário escolhe entre "Agora não" e "Definir limite".
  const close = props.mode === 'limit' ? props.onAdjust : null;

  const [defining, setDefining] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!close) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);

  const isLimit = props.mode === 'limit';
  const s = budgetStatusStyles(isLimit ? props.status : 'warn');
  const accentColor = isLimit
    ? props.status === 'over'
      ? 'var(--red)'
      : 'var(--yellow-text)'
    : 'var(--accent)';

  // Categoria já estourada ANTES deste lançamento: o gasto não é o culpado.
  // Empate com o limite não é estouro — cai na copy "esse gasto estoura".
  const alreadyOver = isLimit && props.limit > 0 && props.spent > props.limit;

  const title = isLimit
    ? props.status === 'over'
      ? alreadyOver
        ? `${category} já passou do limite${props.monthLabel ? ` em ${props.monthLabel}` : ''}`
        : `Esse gasto estoura o limite de ${category}`
      : `Você está quase no limite de ${category}`
    : `${category} não tem limite definido`;

  const subtitle = isLimit
    ? props.status === 'over'
      ? alreadyOver
        ? `Este gasto soma mais ${formatCurrency(props.extra)}`
        : `${formatCurrency(props.overBy)} acima do limite`
      : `${Math.round(props.projectedPct)}% do limite depois deste gasto`
    : 'Defina um limite e avisamos antes de você passar dele';

  async function handleDefine() {
    if (props.mode !== 'no-budget' || budgetAmount <= 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      await props.onDefine(budgetAmount);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={overlayStyle} onClick={close ?? undefined} />

      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2">
        <div style={cardStyle}>
          <div style={{ padding: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: isLimit ? s.bg : 'var(--accent-bg)',
                  border: `1.5px solid ${isLimit ? s.border : 'var(--accent-soft)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isLimit ? (
                  <AlertTriangle size={20} color={s.text} />
                ) : (
                  <PieChart size={20} color="var(--accent)" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'var(--text)',
                    margin: 0,
                    marginBottom: 2,
                  }}
                >
                  {title}
                </h2>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', margin: 0 }}>
                  {subtitle}
                </p>
              </div>
              {close && (
                <button
                  onClick={close}
                  aria-label="Fechar"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    padding: 4,
                    marginTop: -2,
                    flexShrink: 0,
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {isLimit ? (
              <>
                {/* Números do orçamento + mini-barra */}
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                    marginBottom: 16,
                  }}
                >
                  <Row
                    label={`Limite de ${category}`}
                    value={formatCurrency(props.limit)}
                  />
                  <Row
                    label={props.monthLabel ? `Já gasto em ${props.monthLabel}` : 'Já gasto neste mês'}
                    value={formatCurrency(props.spent)}
                  />
                  <Row label="Este gasto" value={formatCurrency(props.extra)} />
                  <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                  <Row
                    label="Total projetado"
                    value={`${formatCurrency(props.projected)} · ${Math.round(props.projectedPct)}%`}
                    color={accentColor}
                    strong
                  />

                  <div
                    style={{
                      height: 6,
                      background: 'var(--border-2)',
                      borderRadius: 3,
                      marginTop: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(props.projectedPct, 100)}%`,
                        background: s.bar,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={props.onAdjust} style={ghostButtonStyle}>
                    Ajustar valor
                  </button>
                  <button type="button" onClick={props.onConfirm} style={primaryButtonStyle}>
                    Lançar mesmo assim
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Sem caixa de reforço: o título já diz o quê e o subtítulo
                    o porquê — com o campo de valor aberto, repetir aperta. */}
                {defining && (
                  <div style={{ marginBottom: 14 }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 6,
                      }}
                    >
                      Limite mensal para {category}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: 'var(--bg)',
                        border: '1.5px solid var(--border)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: 'var(--text-3)',
                          flexShrink: 0,
                        }}
                      >
                        R$
                      </span>
                      <CurrencyInput
                        value={budgetAmount}
                        onChange={setBudgetAmount}
                        autoFocus
                        aria-label={`Limite mensal para ${category}`}
                        className="min-w-0 flex-1 text-base font-bold bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--text-3)]"
                        style={{ caretColor: 'var(--accent)' }}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--red)',
                      margin: '0 0 10px',
                    }}
                  >
                    {error}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={props.onSkip} style={ghostButtonStyle}>
                    Agora não
                  </button>
                  {defining ? (
                    <LoadingButton
                      type="button"
                      onClick={handleDefine}
                      loading={saving}
                      disabled={budgetAmount <= 0}
                      style={{
                        ...primaryButtonStyle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: budgetAmount <= 0 ? 'not-allowed' : 'pointer',
                        opacity: budgetAmount <= 0 ? 0.5 : 1,
                      }}
                    >
                      Salvar limite e lançar
                    </LoadingButton>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDefining(true)}
                      style={primaryButtonStyle}
                    >
                      Definir limite
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
