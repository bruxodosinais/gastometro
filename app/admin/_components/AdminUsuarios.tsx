import { Chip, PlanBadge, PushBadges } from './shared';
import { btnStyle, fmt, pageBtn } from './utils';
import type { UserRow } from './types';

interface Props {
  users: UserRow[];
  usersTotal: number;
  userPage: number;
  setUserPage: (fn: number | ((p: number) => number)) => void;
  userSearch: string;
  setUserSearch: (v: string) => void;
  userFilter: string;
  setUserFilter: (v: string) => void;
  userOrder: string;
  setUserOrder: (v: string) => void;
  loadingUsers: boolean;
  onFetchUsers: () => void;
  onOpenInvite: () => void;
  onOpenDetail: (id: string) => void;
  onToggleBlock: (u: UserRow) => void;
  onConfirmDelete: (id: string) => void;
}

export function AdminUsuarios({
  users, usersTotal, userPage, setUserPage,
  userSearch, setUserSearch,
  userFilter, setUserFilter,
  userOrder, setUserOrder,
  loadingUsers,
  onFetchUsers, onOpenInvite,
  onOpenDetail, onToggleBlock, onConfirmDelete,
}: Props) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#111827', opacity: 1 }}>Usuários</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onOpenInvite} style={{
            padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
          }}>+ Convidar usuário</button>
          <a href="/api/admin/export" download style={{
            padding: '10px 18px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
          }}>↓ Exportar CSV</a>
        </div>
      </div>

      {/* Barra de busca + filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Buscar por e-mail…" value={userSearch}
          onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
          style={{
            padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
            background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit', flex: 1, minWidth: 200,
          }}
        />
        <select value={userFilter} onChange={e => { setUserFilter(e.target.value); setUserPage(1); }} style={{
          padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
          background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
        }}>
          <option value="all">Todos</option>
          <option value="confirmed">Confirmados</option>
          <option value="unconfirmed">Não confirmados</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="blocked">Bloqueados</option>
          <optgroup label="Plano">
            <option value="pro">Pro</option>
            <option value="free">Free</option>
          </optgroup>
          <optgroup label="Notificações">
            <option value="push_on">Push ativado</option>
            <option value="push_off">Sem push</option>
          </optgroup>
          <optgroup label="Origem">
            <option value="ios">Usou o app iOS</option>
            <option value="android">Usou o app Android</option>
            <option value="web_only">Só web</option>
          </optgroup>
        </select>
        <select value={userOrder} onChange={e => { setUserOrder(e.target.value); setUserPage(1); }} style={{
          padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
          background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
        }}>
          <option value="created_at">Cadastro</option>
          <option value="last_sign_in_at">Último acesso</option>
          <option value="launches">Lançamentos</option>
        </select>
        <button onClick={onFetchUsers} style={{
          padding: '10px 14px', background: 'var(--accent-bg)', color: 'var(--accent)', border: 'none',
          borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
        }}>Buscar</button>
      </div>

      {/* Tabela */}
      <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {(
                [
                  { label: 'E-mail', hideMobile: false },
                  { label: 'Cadastro', hideMobile: true },
                  { label: 'Último acesso', hideMobile: true },
                  { label: 'Lançamentos', hideMobile: true },
                  { label: 'Plano', hideMobile: false },
                  { label: 'Push', hideMobile: true },
                  { label: 'Status', hideMobile: true },
                  { label: 'Ações', hideMobile: false },
                ] as const
              ).map(h => (
                <th
                  key={h.label}
                  className={h.hideMobile ? 'admin-user-hide-mobile' : undefined}
                  style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingUsers ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Carregando…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Nenhum usuário encontrado.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-2)' }}>
                <td style={{ padding: '10px 14px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111827', fontWeight: 600, opacity: 1 }}>
                  {u.email}
                </td>
                <td className="admin-user-hide-mobile" style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{fmt(u.created_at)}</td>
                <td className="admin-user-hide-mobile" style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{fmt(u.last_sign_in_at)}</td>
                <td className="admin-user-hide-mobile" style={{ padding: '10px 14px', fontWeight: 700, color: '#374151' }}>{u.launches_count}</td>
                <td style={{ padding: '10px 14px' }}>
                  <PlanBadge plan={u.plan} billingCycle={u.billing_cycle} store={u.store} />
                </td>
                <td className="admin-user-hide-mobile" style={{ padding: '10px 14px' }}>
                  <PushBadges ios={u.push_ios} android={u.push_android} web={u.push_web} />
                </td>
                <td className="admin-user-hide-mobile" style={{ padding: '10px 14px' }}>
                  {u.is_blocked
                    ? <Chip label="Bloqueado" color="#c0392b" bg="var(--red-bg)" />
                    : u.email_confirmed_at
                      ? <Chip label="Confirmado" color="var(--green-text)" bg="var(--green-bg)" />
                      : <Chip label="Não confirmado" color="var(--yellow-text)" bg="var(--yellow-bg)" />
                  }
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => onOpenDetail(u.id)} style={btnStyle}>Detalhes</button>
                  <button onClick={() => onToggleBlock(u)} style={{ ...btnStyle, color: u.is_blocked ? 'var(--green)' : 'var(--yellow-text)' }}>
                    {u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                  </button>
                  <button onClick={() => onConfirmDelete(u.id)} style={{ ...btnStyle, color: 'var(--red)' }}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, alignItems: 'center', fontSize: 14 }}>
        <button disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)} style={pageBtn}>← Anterior</button>
        <span style={{ color: '#374151' }}>
          Página {userPage} de {Math.max(1, Math.ceil(usersTotal / 20))} ({usersTotal} usuários)
        </span>
        <button disabled={userPage >= Math.ceil(usersTotal / 20)} onClick={() => setUserPage(p => p + 1)} style={pageBtn}>Próxima →</button>
      </div>
    </>
  );
}
