'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminHeader } from '../_components/AdminHeader';
import { AdminResponsiveStyles } from '../_components/shared';
import { AdminUserProfile } from '../_components/AdminUserProfile';

// Página de UM usuário. É /admin/usuario?id=… (e não /admin/usuarios/[id])
// porque o build nativo faz export estático do app inteiro e rota dinâmica
// quebra o export — mesmo motivo de /cartoes/detalhe?id=. Ver scripts/build-native.sh.
export default function AdminUsuarioPage() {
  return (
    <Suspense fallback={null}>
      <AdminUsuarioInner />
    </Suspense>
  );
}

function AdminUsuarioInner() {
  const router = useRouter();
  const id = useSearchParams().get('id');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminHeader
        tab="users"
        setTab={key => router.push(key === 'overview' ? '/admin' : `/admin?tab=${key}`)}
        feedbackUnread={0}
      />
      <main style={{ flex: 1, marginLeft: 220, padding: '32px 28px', maxWidth: 1100 }} className="admin-main">
        {id
          ? <AdminUserProfile id={id} />
          : <p style={{ color: '#6b7280' }}>Nenhum usuário informado.</p>}
      </main>
      <AdminResponsiveStyles />
    </div>
  );
}
