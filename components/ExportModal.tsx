'use client';

import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Expense } from '@/lib/types';

type PeriodOption = 'thisMonth' | 'prevMonth' | '3months' | '6months' | 'custom';
type ExportFormat = 'csv' | 'pdf';

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: 'thisMonth', label: 'Este mês' },
  { value: 'prevMonth', label: 'Mês anterior' },
  { value: '3months', label: 'Últimos 3 meses' },
  { value: '6months', label: 'Últimos 6 meses' },
  { value: 'custom', label: 'Personalizado' },
];

function isoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function getPeriodInfo(
  period: PeriodOption,
  customFrom: string,
  customTo: string
): { from: string; to: string; fileLabel: string; displayLabel: string } {
  const now = new Date();

  if (period === 'thisMonth') {
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const last = new Date(y, m, 0).getDate();
    const key = `${y}-${String(m).padStart(2, '0')}`;
    return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}`, fileLabel: key, displayLabel: 'Este mês' };
  }

  if (period === 'prevMonth') {
    const pd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = pd.getFullYear(), m = pd.getMonth() + 1;
    const last = new Date(y, m, 0).getDate();
    const key = `${y}-${String(m).padStart(2, '0')}`;
    return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}`, fileLabel: key, displayLabel: 'Mês anterior' };
  }

  if (period === '3months') {
    const f = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
      from: isoDate(f),
      to: isoDate(now),
      fileLabel: isoDate(f).slice(0, 7),
      displayLabel: 'Últimos 3 meses',
    };
  }

  if (period === '6months') {
    const f = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return {
      from: isoDate(f),
      to: isoDate(now),
      fileLabel: isoDate(f).slice(0, 7),
      displayLabel: 'Últimos 6 meses',
    };
  }

  // custom
  const [fy, fm, fd] = customFrom.split('-');
  const [ty, tm, td] = customTo.split('-');
  return {
    from: customFrom,
    to: customTo,
    fileLabel: customFrom.slice(0, 7),
    displayLabel: `${fd}/${fm}/${fy} até ${td}/${tm}/${ty}`,
  };
}

async function fetchByRange(from: string, to: string): Promise<Expense[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('expenses')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as Expense['type'],
    amount: row.amount as number,
    description: row.description as string,
    category: row.category as Expense['category'],
    date: row.date as string,
    createdAt: row.created_at as string,
    recurringExpenseId: (row.recurring_expense_id as string | null) ?? undefined,
  }));
}

function doExportCSV(data: Expense[], filename: string) {
  const BOM = '﻿';
  const header = 'Data,Descricao,Categoria,Tipo,Valor\r\n';
  const rows = data
    .map((e) => {
      const desc = `"${e.description.replace(/"/g, '""')}"`;
      const cat = `"${e.category}"`;
      const tipo = e.type === 'income' ? 'Receita' : 'Gasto';
      const valor = `"${e.amount.toFixed(2).replace('.', ',')}"`;
      return `${e.date},${desc},${cat},${tipo},${valor}`;
    })
    .join('\r\n');

  const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function doExportPDF(data: Expense[], filename: string, displayLabel: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ml = 15, mr = 15;

  const colX = [ml, ml + 22, ml + 112, ml + 155];

  function addTableHeader(yPos: number): number {
    doc.setFillColor(245, 245, 245);
    doc.rect(ml, yPos - 5, W - ml - mr, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    ['Data', 'Descrição', 'Categoria', 'Valor'].forEach((lbl, i) => doc.text(lbl, colX[i], yPos));
    return yPos + 8;
  }

  // Page header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('TôOrganizado - Extrato', ml, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Periodo: ${displayLabel}`, ml, 28);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, ml, 33);

  doc.setDrawColor(220, 220, 220);
  doc.line(ml, 37, W - mr, 37);

  let y = addTableHeader(44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let totalIncome = 0;
  let totalExpense = 0;

  for (const e of data) {
    if (y > H - 30) {
      doc.addPage();
      y = addTableHeader(20);
    }

    const isIncome = e.type === 'income';
    if (isIncome) totalIncome += e.amount;
    else totalExpense += e.amount;

    const [yr, mo, da] = e.date.split('-');
    const dateStr = `${da}/${mo}/${yr}`;
    const desc = e.description.length > 50 ? e.description.slice(0, 47) + '...' : e.description;
    const cat = e.category.length > 18 ? e.category.slice(0, 16) + '..' : e.category;
    const valor = `R$ ${e.amount.toFixed(2).replace('.', ',')}`;

    doc.setTextColor(60, 60, 60);
    doc.text(dateStr, colX[0], y);
    doc.text(desc, colX[1], y);
    doc.text(cat, colX[2], y);
    // Semântica: receita → verde #16a34a · gasto → vermelho #dc2626
    if (isIncome) doc.setTextColor(22, 163, 74);
    else doc.setTextColor(220, 38, 38);
    doc.text(valor, colX[3], y);

    y += 6;
  }

  // Totals section
  if (y > H - 35) {
    doc.addPage();
    y = 20;
  }
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(ml, y, W - mr, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  // Total Receitas → verde #16a34a
  doc.setTextColor(22, 163, 74);
  doc.text(`Total Receitas: R$ ${totalIncome.toFixed(2).replace('.', ',')}`, ml, y);
  y += 6;

  // Total Gastos → vermelho #dc2626
  doc.setTextColor(220, 38, 38);
  doc.text(`Total Gastos: R$ ${totalExpense.toFixed(2).replace('.', ',')}`, ml, y);
  y += 6;

  // Saldo: positivo → verde #16a34a · negativo → vermelho #dc2626 (sem azul)
  const balance = totalIncome - totalExpense;
  if (balance >= 0) doc.setTextColor(22, 163, 74);
  else doc.setTextColor(220, 38, 38);
  doc.text(`Saldo: R$ ${balance.toFixed(2).replace('.', ',')}`, ml, y);

  doc.save(filename);
}

interface ExportModalProps {
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export default function ExportModal({ onClose, onSuccess }: ExportModalProps) {
  const now = new Date();
  const todayIso = isoDate(now);
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [period, setPeriod] = useState<PeriodOption>('thisMonth');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [customFrom, setCustomFrom] = useState(firstOfMonth);
  const [customTo, setCustomTo] = useState(todayIso);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    if (period === 'custom' && (!customFrom || !customTo || customFrom > customTo)) {
      setError('Selecione um período válido.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { from, to, fileLabel, displayLabel } = getPeriodInfo(period, customFrom, customTo);
      const data = await fetchByRange(from, to);

      if (format === 'csv') {
        doExportCSV(data, `toorganizado-extrato-${fileLabel}.csv`);
      } else {
        await doExportPDF(data, `toorganizado-extrato-${fileLabel}.pdf`, displayLabel);
      }

      onSuccess?.(`Extrato ${format.toUpperCase()} exportado`);
      onClose();
    } catch {
      setError('Erro ao exportar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl z-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Exportar extrato</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Period selector */}
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Período</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium text-left transition-all ${
                opt.value === 'custom' ? 'col-span-2' : ''
              } ${
                period === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">De</p>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Até</p>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Format toggle */}
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Formato</p>
        <div className="flex gap-2 mb-5">
          {(['csv', 'pdf'] as ExportFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
                format === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {loading ? 'Exportando...' : 'Exportar'}
        </button>
      </div>
    </div>
  );
}
