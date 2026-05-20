import { ExpenseCategory } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardFormData {
  nome: string;
  limite: string;
  diaFechamento: string;
  diaVencimento: string;
}

export interface RawTransaction {
  date: string;
  description: string;
  amount: number;
  nubank_category: string;
}

export interface PreviewItem extends RawTransaction {
  selectedCategory: ExpenseCategory;
  isDuplicate: boolean;
}

export interface BankMapping {
  bankName: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  negativeIsExpense: boolean;
  creditCardId: string;
}

export interface MappingFormData {
  bankName: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  negativeIsExpense: boolean;
  selectedCardId: string;
}

export interface CSVData {
  headers: string[];
  rows: string[][];
}

export interface ParseResult {
  transactions: RawTransaction[];
  skippedCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const EMPTY_FORM: CardFormData = { nome: '', limite: '', diaFechamento: '', diaVencimento: '' };
export const LS_MAPPINGS_PREFIX = 'gastometro_bank_mappings';
export const LS_MAPPINGS_VERSION = '3';

export function lsKey(userId: string) {
  return `${LS_MAPPINGS_PREFIX}_${userId}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function todayPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface MappingsStore {
  version: string;
  mappings: Record<string, BankMapping>;
}

export function getBankMappings(userId: string): Record<string, BankMapping> {
  if (!userId) return {};
  try {
    const store: MappingsStore = JSON.parse(localStorage.getItem(lsKey(userId)) ?? '{}');
    if (store.version !== LS_MAPPINGS_VERSION) return {};
    return store.mappings ?? {};
  } catch {
    return {};
  }
}

export function saveBankMapping(userId: string, headerKey: string, mapping: BankMapping) {
  if (!userId) return;
  const mappings = getBankMappings(userId);
  mappings[headerKey] = mapping;
  const store: MappingsStore = { version: LS_MAPPINGS_VERSION, mappings };
  localStorage.setItem(lsKey(userId), JSON.stringify(store));
}

// RFC 4180–compliant parser that handles quoted fields with embedded separators
export function parseCSVLine(line: string, separator = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function readCSVRobust(file: File): Promise<CSVData> {
  function parseText(text: string): CSVData {
    const clean = text.replace(/^﻿/, '');
    const nonEmpty = clean
      .split('\n')
      .map((l) => l.replace(/\r/g, ''))
      .filter((l) => l.trim().length > 0);

    if (nonEmpty.length === 0) return { headers: [], rows: [] };

    const headerLine = nonEmpty[0].replace(/^﻿/, '');
    const sep = headerLine.includes(';') ? ';' : ',';
    const headers = parseCSVLine(headerLine, sep).map((h) => h.trim());
    const rows = nonEmpty.slice(1).map((l) =>
      parseCSVLine(l, sep).map((c) => c.trim())
    );
    return { headers, rows };
  }

  return new Promise((resolve, reject) => {
    const utf8Reader = new FileReader();
    utf8Reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      if (text.includes('�')) {
        const latinReader = new FileReader();
        latinReader.onload = (e2) => resolve(parseText((e2.target?.result as string) ?? ''));
        latinReader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        latinReader.readAsText(file, 'ISO-8859-1');
      } else {
        resolve(parseText(text));
      }
    };
    utf8Reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    utf8Reader.readAsText(file, 'UTF-8');
  });
}

export function parseNubankCSV(file: File): Promise<RawTransaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = (e.target?.result as string) ?? '';
      const text = raw.replace(/^﻿/, '');
      const lines = text
        .split('\n')
        .map((l) => l.replace(/\r/g, ''))
        .filter((l) => l.trim());

      if (lines.length < 2) {
        reject(new Error('Arquivo vazio'));
        return;
      }

      // Discover column indices dynamically to support both formats:
      //   3-column (current Nubank): date,title,amount
      //   4-column (legacy):         date,category,title,amount
      const headerParts = parseCSVLine(lines[0].toLowerCase());
      const colDate = headerParts.findIndex((h) => h.trim() === 'date');
      const colTitle = headerParts.findIndex((h) => h.trim() === 'title');
      const colAmount = headerParts.findIndex((h) => h.trim() === 'amount');
      const colCategory = headerParts.findIndex((h) => h.trim() === 'category');

      if (colDate === -1 || colTitle === -1 || colAmount === -1) {
        reject(new Error('not_nubank'));
        return;
      }

      const result: RawTransaction[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        const date = parts[colDate]?.trim() ?? '';
        const description = parts[colTitle]?.trim() ?? '';
        const amountStr = parts[colAmount]?.trim() ?? '';
        const nubank_category = colCategory !== -1 ? (parts[colCategory]?.trim() ?? '') : '';
        const amount = parseFloat(amountStr);

        if (!date || !description || isNaN(amount)) continue;
        // Nubank exports expenses as positive values; negative = payment received — skip those
        if (amount < 0) continue;

        result.push({ date, description, amount, nubank_category });
      }

      resolve(result);
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

export function parseAmountBR(raw: string): number {
  const clean = raw
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  return parseFloat(clean);
}

export function parseDateToISO(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return isNaN(new Date(raw).getTime()) ? null : raw;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('/');
    const iso = `${y}-${m}-${d}`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
  }
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(raw)) {
    const [d, m, y] = raw.split('/');
    const iso = `20${y}-${m}-${d}`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
  }
  return null;
}

export function parseWithMapping(
  headers: string[],
  rows: string[][],
  mapping: BankMapping
): ParseResult {
  const colDate = headers.indexOf(mapping.dateColumn);
  const colDesc = headers.indexOf(mapping.descriptionColumn);
  const colAmount = headers.indexOf(mapping.amountColumn);

  if (colDate === -1 || colDesc === -1 || colAmount === -1) {
    return { transactions: [], skippedCount: rows.length };
  }

  const transactions: RawTransaction[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    const rawDate = row[colDate]?.trim() ?? '';
    const description = row[colDesc]?.trim() ?? '';
    const rawAmount = row[colAmount]?.trim() ?? '';

    const date = parseDateToISO(rawDate);
    const amount = parseAmountBR(rawAmount);

    if (!date || !description || isNaN(amount)) {
      skippedCount++;
      continue;
    }
    if (amount === 0) continue;

    if (mapping.negativeIsExpense) {
      if (amount >= 0) continue;
      transactions.push({ date, description, amount: Math.abs(amount), nubank_category: '' });
    } else {
      if (amount <= 0) continue;
      transactions.push({ date, description, amount, nubank_category: '' });
    }
  }

  return { transactions, skippedCount };
}

export function mapToAppCategory(nubankCat: string): ExpenseCategory {
  const map: Record<string, ExpenseCategory> = {
    'alimentação': 'Alimentação',
    'supermercado': 'Alimentação',
    'restaurante': 'Alimentação',
    'transporte': 'Transporte',
    'moradia': 'Moradia',
    'saúde': 'Saúde',
    'lazer': 'Lazer',
    'educação': 'Educação',
    'vestuário': 'Vestuário',
    'delivery': 'Delivery',
    'internet': 'Internet',
    'assinatura': 'Assinaturas',
    'assinaturas': 'Assinaturas',
    'farmácia': 'Farmácia',
    'farmacia': 'Farmácia',
    'combustível': 'Combustível',
    'telefone': 'Telefone',
    'beleza': 'Beleza',
    'pet': 'Pet',
    'viagem': 'Viagem',
    'investimentos': 'Investimentos',
  };
  return map[nubankCat.toLowerCase().trim()] ?? 'Outros';
}
