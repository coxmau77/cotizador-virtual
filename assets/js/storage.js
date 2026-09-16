import { CONFIG } from './config.js';
import { makeValidUntil } from './quote.js';

const STORAGE_KEY = 'cotizador-v0.1:quotes';
const SEED_FLAG_KEY = 'cotizador-v0.1:seeded';
const SEED_NUMBERS = new Set(['COT-20260903-101500', 'COT-20260910-163045']);

function isValidQuote(q) {
  return Boolean(q && typeof q === 'object'
    && typeof q.number === 'string'
    && typeof q.client === 'string'
    && typeof q.currency === 'string'
    && Array.isArray(q.items));
}

function normalizeQuote(q) {
  if (q.validUntil && /^\d{4}-\d{2}-\d{2}$/.test(String(q.validUntil))) return q;
  const date = q.date ? new Date(q.date) : new Date();
  return { ...q, validUntil: makeValidUntil(Number.isNaN(date.getTime()) ? new Date() : date) };
}

function parseDatabase(raw) {
  if (!raw) return { quotes: [] };
  const data = JSON.parse(raw);
  const quotes = Array.isArray(data) ? data : Array.isArray(data?.quotes) ? data.quotes : [];
  return { quotes: quotes.filter(isValidQuote).map(normalizeQuote) };
}

export function loadQuotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return parseDatabase(raw).quotes;
  } catch {
    return [];
  }
}

export function saveQuotes(quotes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ quotes }));
    return true;
  } catch {
    return false;
  }
}

export function eraseQuotes() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function migrateDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const { quotes } = parseDatabase(raw);
    const cleaned = quotes.filter((q) => !SEED_NUMBERS.has(q.number));
    const rawQuotes = raw ? (() => {
      const d = JSON.parse(raw);
      return (Array.isArray(d) ? d : Array.isArray(d?.quotes) ? d.quotes : []).filter(isValidQuote);
    })() : [];
    const needsBackfill = rawQuotes.some((q) => !q.validUntil || !/^\d{4}-\d{2}-\d{2}$/.test(String(q.validUntil)));
    if (needsBackfill || !raw || cleaned.length !== quotes.length || !raw.trim().startsWith('{')) {
      saveQuotes(cleaned);
    }
    localStorage.removeItem(SEED_FLAG_KEY);
    return cleaned;
  } catch {
    return loadQuotes();
  }
}

export function findInDatabase(number) {
  return loadQuotes().find((q) => q.number === number) || null;
}

export function isAtLimit(quotes) {
  return quotes.length >= CONFIG.QUOTE_LIMIT;
}

export function pushQuote(quotes, quote) {
  const index = quotes.findIndex((q) => q.number === quote.number);
  if (index === -1) {
    quotes.push(quote);
  } else {
    quotes[index] = quote;
  }
  return quotes;
}

export function deleteQuote(quotes, number) {
  return quotes.filter((q) => q.number !== number);
}

export function oldestQuote(quotes) {
  return quotes[0] || null;
}

export function exportJSONString(quotes) {
  return JSON.stringify({
    app: 'cotizador-virtual',
    version: '0.1',
    exportedAt: new Date().toISOString(),
    quotes
  }, null, 2);
}

export function parseJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || data.app !== 'cotizador-virtual' || data.version !== '0.1') {
    throw new Error('Este archivo no fue generado por el cotizador. El formato es incompatible.');
  }
  const quotes = data.quotes;
  if (!Array.isArray(quotes) || !quotes.length) {
    throw new Error('El archivo no contiene cotizaciones.');
  }
  if (!quotes.every(isValidQuoteForImport)) {
    throw new Error('El formato del archivo contiene errores y es incompatible.');
  }
  return quotes.map(normalizeQuote);
}

function isValidQuoteForImport(q) {
  if (!isValidQuote(q)) return false;
  if (!String(q.number).trim() || !String(q.client).trim() || !String(q.currency).trim()) return false;
  if (!(typeof q.date === 'string' && !Number.isNaN(Date.parse(q.date)))) return false;
  if (q.validUntil !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(q.validUntil))) return false;
  const discount = Number(q.discount);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) return false;
  if (!Array.isArray(q.items) || !q.items.length) return false;
  return q.items.every((item) => item
    && typeof item.description === 'string' && String(item.description).trim() !== ''
    && Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
    && Number.isFinite(Number(item.price)) && Number(item.price) >= 0);
}