import { Chip } from './shared';
import { btnStyle, fmt } from './utils';
import type { Coupon, StatusMessage } from './types';

interface Props {
  coupons: Coupon[];
  couponsLoading: boolean;
  newCouponCode: string;
  setNewCouponCode: (v: string) => void;
  newCouponDays: number;
  setNewCouponDays: (v: number) => void;
  newCouponMaxUses: number;
  setNewCouponMaxUses: (v: number) => void;
  newCouponExpires: string;
  setNewCouponExpires: (v: string) => void;
  couponMsg: StatusMessage | null;
  creatingCoupon: boolean;
  onCreateCoupon: () => void;
  onDeactivateCoupon: (id: string) => void;
}

export function AdminCupons({
  coupons, couponsLoading,
  newCouponCode, setNewCouponCode,
  newCouponDays, setNewCouponDays,
  newCouponMaxUses, setNewCouponMaxUses,
  newCouponExpires, setNewCouponExpires,
  couponMsg, creatingCoupon,
  onCreateCoupon, onDeactivateCoupon,
}: Props) {
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 24px' }}>Cupons</h1>

      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r)', padding: 20,
        border: '1px solid var(--border)', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>Criar cupom</h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
        }}>
          <label style={{ fontSize: 13, fontWeight: 700 }}>
            Código (opcional)
            <input
              type="text" value={newCouponCode}
              onChange={e => setNewCouponCode(e.target.value.toUpperCase())}
              placeholder="auto-gerado"
              style={{
                display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14,
              }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700 }}>
            Duração (dias)
            <input
              type="number" min={1} value={newCouponDays}
              onChange={e => setNewCouponDays(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14,
              }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700 }}>
            Máx. usos (0 = ilimitado)
            <input
              type="number" min={0} value={newCouponMaxUses}
              onChange={e => setNewCouponMaxUses(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14,
              }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700 }}>
            Expira em (opcional)
            <input
              type="date" value={newCouponExpires}
              onChange={e => setNewCouponExpires(e.target.value)}
              style={{
                display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14,
              }}
            />
          </label>
        </div>
        {couponMsg && (
          <p style={{
            fontSize: 13, margin: '12px 0 0',
            color: couponMsg.kind === 'success' ? 'var(--green)' : 'var(--red)',
          }}>{couponMsg.text}</p>
        )}
        <div style={{ marginTop: 14 }}>
          <button
            onClick={onCreateCoupon}
            disabled={creatingCoupon}
            style={{
              padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 700, fontSize: 14, opacity: creatingCoupon ? 0.6 : 1,
            }}
          >{creatingCoupon ? 'Criando…' : 'Criar cupom'}</button>
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>Cupons cadastrados</h2>
      <div style={{
        overflowX: 'auto', background: 'var(--surface)', borderRadius: 'var(--r)',
        border: '1px solid var(--border)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Código', 'Dias', 'Usos', 'Validade', 'Status', 'Ações'].map(h => (
                <th key={h} style={{
                  textAlign: 'left', padding: '12px 14px', fontWeight: 700,
                  color: 'var(--text-2)', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {couponsLoading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Carregando…</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Nenhum cupom criado.</td></tr>
            ) : coupons.map(c => {
              const exhausted = c.max_uses > 0 && c.uses >= c.max_uses;
              const expired = c.expires_at != null && new Date(c.expires_at) < new Date();
              const showActive = c.active && !exhausted && !expired;
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-2)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800 }}>
                    {c.code}
                  </td>
                  <td style={{ padding: '10px 14px' }}>{c.days}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.uses}/{c.max_uses === 0 ? '∞' : c.max_uses}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-2)' }}>
                    {c.expires_at ? fmt(c.expires_at) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {showActive
                      ? <Chip label="Ativo" color="var(--green-text)" bg="var(--green-bg)" />
                      : exhausted
                        ? <Chip label="Esgotado" color="#4b5563" bg="#E5E7EB" />
                        : expired
                          ? <Chip label="Expirado" color="#4b5563" bg="#E5E7EB" />
                          : <Chip label="Inativo" color="#4b5563" bg="#E5E7EB" />}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.active && (
                      <button
                        onClick={() => onDeactivateCoupon(c.id)}
                        style={{ ...btnStyle, color: 'var(--red)' }}
                      >Desativar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
