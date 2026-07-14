'use client';

import { useEffect, useState } from 'react';
import { Check, X, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSubscription } from '@/hooks/useSubscription';
import { fetchApi } from '@/lib/fetchApi';
import { isNativePlatform } from '@/lib/native';

const PRO_FEATURES = [
  'Lançamentos ilimitados',
  'Missão de Poupança com IA e badges',
  'Relatório semanal por e-mail',
  'Recorrentes ilimitados',
  'GastôBot ilimitado',
  'Metas financeiras',
  'Controle de patrimônio',
  'Cartões de crédito',
  'Suporte prioritário',
];

const FREE_LIMITATIONS = [
  '20 lançamentos/mês',
  '5 recorrentes',
  '1 consulta no GastôBot/mês',
  'Sem metas financeiras',
  'Sem controle de patrimônio',
  'Sem cartões de crédito',
];

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function UpgradePage() {
  const router = useRouter();
  // NATIVO: app é grátis neste build (sem IAP). A /upgrade não é alcançável pelo
  // app, mas guardamos por defesa em profundidade — redireciona pra /app.
  const native = isNativePlatform();
  const { isPro, billingCycle, currentPeriodEnd, status, loading, refetch } = useSubscription();
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMsg, setCouponMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (native) router.replace('/app');
  }, [native, router]);

  async function redeemCoupon() {
    setCouponLoading(true);
    setCouponMsg(null);
    try {
      const r = await fetchApi('/api/coupons/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setCouponMsg({ kind: 'success', text: `Pro ativado por ${d.days} dia${d.days === 1 ? '' : 's'}!` });
        setCouponCode('');
        await refetch();
      } else {
        setCouponMsg({ kind: 'error', text: d.error ?? 'Erro ao resgatar cupom.' });
      }
    } catch {
      setCouponMsg({ kind: 'error', text: 'Erro ao resgatar cupom.' });
    } finally {
      setCouponLoading(false);
    }
  }

  if (native) return null;

  if (loading) {
    return (
      <main style={{ padding: 24, minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Carregando…</p>
      </main>
    );
  }

  if (isPro) {
    return (
      <main className="max-w-lg mx-auto px-4 pt-8 pb-24" style={{ background: 'var(--bg)' }}>
        <Link
          href="/perfil"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-3)',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} />
          Voltar
        </Link>

        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: 24,
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.05em',
              marginBottom: 12,
            }}
          >
            <Sparkles size={12} /> PRO ATIVO
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0, marginBottom: 6 }}>
            Você é Pro 🚀
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, marginBottom: 18 }}>
            Aproveite todos os recursos sem limites.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Status" value={status === 'active' ? 'Ativa' : status === 'past_due' ? 'Pagamento pendente' : 'Cancelada'} />
            <Row label="Cobrança" value={billingCycle === 'annual' ? 'Anual' : billingCycle === 'monthly' ? 'Mensal' : '—'} />
            <Row label="Próxima renovação" value={formatDate(currentPeriodEnd)} />
          </div>

          <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Para gerenciar ou cancelar sua assinatura, acesse as configurações de
            assinaturas da App Store no seu iPhone (Ajustes → sua conta → Assinaturas).
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24" style={{ background: 'var(--bg)' }}>
      <Link
        href="/perfil"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--text-3)',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>

      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--text)', margin: 0, marginBottom: 6 }}>
          Seja Pro 🚀
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Controle total das suas finanças
        </p>
      </div>

      {/* Free card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: 18,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Free <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>(atual)</span>
          </h2>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-2)' }}>R$ 0</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FREE_LIMITATIONS.map((line) => (
            <li key={line} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--red-bg)',
                  color: 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={11} />
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pro card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '2px solid var(--accent)',
          borderRadius: 'var(--r)',
          padding: 22,
          marginBottom: 18,
          boxShadow: '0 8px 24px rgba(91,91,214,0.18)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: 22,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.06em',
          }}
        >
          <Sparkles size={11} /> RECOMENDADO
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: 0 }}>Pro</h2>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PRO_FEATURES.map((line) => (
            <li key={line} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--green-bg)',
                  color: 'var(--green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Check size={12} />
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 700 }}>{line}</span>
            </li>
          ))}
        </ul>

        {/* CTA informativo: a assinatura Pro é feita DENTRO do app (App Store/IAP),
            não há checkout web. Sem link externo de pagamento. */}
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 'var(--r-sm)',
            background: 'var(--accent-bg)',
            border: '1px solid rgba(91,91,214,0.22)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>
            Assine pelo app TôOrganizado
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', lineHeight: 1.5 }}>
            O Pro é assinado dentro do aplicativo (iOS). Baixe o app, abra o menu e
            toque em assinar — e o Pro fica liberado também aqui no navegador.
          </p>
        </div>
      </div>

      {/* Cupom (mecanismo próprio, independente de loja) */}
      <div style={{ marginTop: 18, textAlign: 'center' }}>
        {!couponOpen ? (
          <button
            type="button"
            onClick={() => setCouponOpen(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontWeight: 700, fontSize: 13,
              fontFamily: 'inherit', padding: 0,
            }}
          >
            Tenho um cupom
          </button>
        ) : (
          <div
            style={{
              marginTop: 12,
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--r)',
              padding: 16,
              textAlign: 'left',
            }}
          >
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
              Código do cupom
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="EX: TRIAL30"
                style={{
                  display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                  borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                  fontFamily: 'monospace', fontSize: 14, letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              />
            </label>
            {couponMsg && (
              <p
                style={{
                  fontSize: 12, fontWeight: 700,
                  color: couponMsg.kind === 'success' ? 'var(--green)' : 'var(--red)',
                  margin: '10px 0 0',
                }}
              >{couponMsg.text}</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={redeemCoupon}
                disabled={couponLoading || !couponCode.trim()}
                style={{
                  flex: 1, padding: '10px 14px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                  opacity: couponLoading || !couponCode.trim() ? 0.6 : 1,
                }}
              >{couponLoading ? 'Resgatando…' : 'Resgatar'}</button>
              <button
                type="button"
                onClick={() => { setCouponOpen(false); setCouponMsg(null); setCouponCode(''); }}
                style={{
                  padding: '10px 14px', background: 'var(--surface)', color: 'var(--text-2)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                }}
              >Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 800 }}>{value}</span>
    </div>
  );
}
