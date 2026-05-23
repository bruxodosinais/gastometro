'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Loader2, Share2 } from 'lucide-react';
import { getCachedUser } from '@/lib/dataCache';
import { getMission } from '@/lib/storage/missions';

// Dados mínimos pro canvas: nome + meses dirigem o visual; saved/target ficam
// disponíveis pra evoluir o card sem mudar a forma do estado. Vem de query
// params (caso "compartilhar missão concluída do histórico") ou da missão
// ativa como fallback.
type ShareData = { name: string; months: number; saved: number; target: number };

type ThemeKey = 'indigo' | 'verde' | 'roxo';

const THEMES: Record<ThemeKey, { label: string; from: string; to: string; swatch: string }> = {
  indigo: { label: 'Indigo', from: '#5B5BD6', to: '#4040B0', swatch: '#5B5BD6' },
  verde:  { label: 'Verde',  from: '#00C37A', to: '#007A4D', swatch: '#00C37A' },
  roxo:   { label: 'Roxo',   from: '#7C3AED', to: '#4C1D95', swatch: '#7C3AED' },
};

const W = 1080;
const H = 1080;
const SHARE_URL = 'https://toorganizado.com.br?utm_source=share&utm_medium=card&utm_campaign=missao';

// Quebra um texto em N linhas no máximo, cabendo no maxWidth do ctx atual.
// Mantém palavras inteiras; se uma única palavra estourar, força quebra bruta.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  // Truncamento: última linha ganha "…" se sobrou conteúdo.
  if (lines.length === maxLines && ctx.measureText(line).width >= maxWidth) {
    while (line.length > 0 && ctx.measureText(line + '…').width > maxWidth) {
      line = line.slice(0, -1);
    }
    lines[maxLines - 1] = `${line.trimEnd()}…`;
  }
  return lines;
}

function CompartilharContent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const searchParams = useSearchParams();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeKey>('indigo');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Query params vencem: deep-link de missão concluída no histórico passa
      // tudo de que o canvas precisa, então pulamos o fetch da missão ativa.
      const qpName = searchParams.get('name');
      const qpMonths = searchParams.get('months');
      if (qpName && qpMonths) {
        setData({
          name: qpName,
          months: Number(qpMonths),
          saved: Number(searchParams.get('saved') ?? 0),
          target: Number(searchParams.get('target') ?? 0),
        });
        setLoading(false);
        return;
      }
      const user = await getCachedUser();
      if (!user) { setLoading(false); return; }
      const m = await getMission(user.id);
      if (m) {
        setData({
          name: m.name,
          months: m.months,
          saved: 0,
          target: Number(m.targetAmount),
        });
      }
      setLoading(false);
    })();
  }, [searchParams]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = THEMES[theme];

    // Fundo gradiente.
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, t.from);
    grad.addColorStop(1, t.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Logo do produto, canto superior esquerdo.
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = '800 40px Nunito, system-ui, sans-serif';
    ctx.fillText('TôOrganizado', 64, 64);

    // Troféu centralizado grande.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '280px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText('🏆', W / 2, 360);

    // "Juntei [nome]" — wrap em até 2 linhas.
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 72px Nunito, system-ui, sans-serif';
    const titleLines = wrapText(ctx, `Juntei ${data.name}`, W - 160, 2);
    let titleY = 600;
    for (const line of titleLines) {
      ctx.fillText(line, W / 2, titleY);
      titleY += 84;
    }

    // Subtítulo cinza claro.
    ctx.font = '600 36px Nunito, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(
      `Em ${data.months} meses sendo CLT e organizado`,
      W / 2,
      titleY + 28,
    );

    // Barra verde 100%.
    const barX = 80;
    const barW = W - 160;
    const barH = 36;
    const barY = 880;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = '#00C37A';
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();

    // Rodapé.
    ctx.textBaseline = 'top';
    ctx.font = '700 30px Nunito, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('toorganizado.com.br', W / 2, 968);
    ctx.font = '800 32px Nunito, system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Comece você também →', W / 2, 1010);
  }, [data, theme]);

  useEffect(() => { draw(); }, [draw]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `missao-${(data?.name ?? 'toorganizado').toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    const shareText = data ? `Juntei ${data.name} em ${data.months} meses com o TôOrganizado.` : 'Conquista TôOrganizado';

    // Tenta navigator.share com arquivo PNG (mobile moderno). Fallback: link.
    if (canvas && typeof navigator.share === 'function') {
      try {
        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png'),
        );
        if (blob) {
          const file = new File([blob], 'missao.png', { type: 'image/png' });
          const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
          if (canShareFile) {
            await navigator.share({ files: [file], text: shareText, url: SHARE_URL });
            return;
          }
        }
        await navigator.share({ text: shareText, url: SHARE_URL });
        return;
      } catch {
        // Usuário cancelou ou navegador rejeitou — cai no fallback de clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(SHARE_URL);
      showToast('Link copiado!');
    } catch {
      showToast('Não foi possível copiar.');
    }
  };

  if (loading) {
    return (
      <main
        className="mx-auto flex min-h-screen w-full items-center justify-center"
        style={{ maxWidth: 390, background: 'var(--bg)' }}
      >
        <Loader2 className="animate-spin" color="var(--accent)" />
      </main>
    );
  }

  if (!data) {
    return (
      <main
        className="mx-auto flex min-h-screen w-full flex-col items-center justify-center gap-4 px-5"
        style={{ maxWidth: 390, background: 'var(--bg)' }}
      >
        <p className="text-center text-[14px] font-bold" style={{ color: 'var(--text-2)' }}>
          Nenhuma missão para compartilhar ainda.
        </p>
        <Link
          href="/missao"
          className="rounded-full px-5 py-2 text-[13px] font-extrabold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Criar missão
        </Link>
      </main>
    );
  }

  return (
    <main
      className="mx-auto w-full pb-10"
      style={{ maxWidth: 390, background: 'var(--bg)', minHeight: '100vh' }}
    >
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <Link
          href="/missao/dashboard"
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: 'var(--surface)', boxShadow: 'var(--hbtn-shadow)' }}
        >
          <ArrowLeft size={20} color="var(--text)" />
        </Link>
        <h1 className="text-[17px] font-extrabold" style={{ color: 'var(--text)' }}>
          Compartilhar conquista
        </h1>
      </header>

      <section className="flex flex-col items-center px-5 pt-2">
        <div
          className="overflow-hidden rounded-2xl"
          style={{ borderRadius: 20, boxShadow: '0 12px 36px rgba(0,0,0,0.15)' }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{ width: 'min(85vw, 340px)', height: 'auto', display: 'block' }}
            aria-label="Prévia do card compartilhável"
          />
        </div>
      </section>

      {/* ── Seletor de tema ──────────────────────────────────────────── */}
      <section className="px-5 pt-5">
        <p
          className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: 'var(--text-3)' }}
        >
          Tema
        </p>
        <div className="flex gap-2">
          {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
            const t = THEMES[k];
            const active = theme === k;
            return (
              <button
                key={k}
                onClick={() => setTheme(k)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-[13px] font-extrabold transition active:scale-95"
                style={{
                  background: active ? 'var(--text)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text)',
                  border: `1.5px solid ${active ? 'var(--text)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full"
                  style={{ background: t.swatch }}
                />
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Ações ─────────────────────────────────────────────────────── */}
      <section className="px-5 pt-4">
        <button
          onClick={handleDownload}
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white transition active:scale-[0.98]"
          style={{
            background: 'var(--accent)',
            borderRadius: 'var(--r)',
            boxShadow: '0 6px 20px var(--accent-shadow)',
          }}
        >
          <Download size={18} /> Baixar imagem
        </button>
        <button
          onClick={handleShare}
          className="mt-3 flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold transition active:scale-[0.98]"
          style={{
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--r)',
          }}
        >
          <Share2 size={18} /> Compartilhar
        </button>
      </section>

      {toast && (
        <div
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-extrabold text-white"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)', background: 'var(--text)' }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}

// useSearchParams força Suspense no build do Next 15 — mesmo padrão de
// missao/badges e missao/nova.
export default function CompartilharPage() {
  return (
    <Suspense
      fallback={
        <main
          className="mx-auto flex min-h-screen w-full items-center justify-center"
          style={{ maxWidth: 390, background: 'var(--bg)' }}
        >
          <Loader2 className="animate-spin" color="var(--accent)" />
        </main>
      }
    >
      <CompartilharContent />
    </Suspense>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
