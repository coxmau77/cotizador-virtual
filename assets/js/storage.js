import { CONFIG } from './config.js';

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

function parseDatabase(raw) {
  if (!raw) return { quotes: [] };
  const data = JSON.parse(raw);
  const quotes = Array.isArray(data) ? data : Array.isArray(data?.quotes) ? data.quotes : [];
  return { quotes: quotes.filter(isValidQuote) };
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

export function migrateDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const { quotes } = parseDatabase(raw);
    const cleaned = quotes.filter((q) => !SEED_NUMBERS.has(q.number));
    if (!raw || cleaned.length !== quotes.length || !raw.trim().startsWith('{')) {
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
  const quotes = Array.isArray(data) ? data : Array.isArray(data?.quotes) ? data.quotes : null;
  if (!quotes) throw new Error('El archivo no contiene cotizaciones.');
  const valid = quotes.filter(isValidQuote);
  if (!valid.length) throw new Error('No se encontraron cotizaciones válidas en el archivo.');
  return valid;
}