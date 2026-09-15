import { CONFIG } from './config.js';

const STORAGE_KEY = 'cotizador-v0.1:quotes';

function isValidQuote(q) {
  return Boolean(q && typeof q === 'object'
    && typeof q.number === 'string'
    && typeof q.client === 'string'
    && typeof q.currency === 'string'
    && Array.isArray(q.items));
}

export function loadQuotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    const quotes = Array.isArray(data) ? data : Array.isArray(data?.quotes) ? data.quotes : [];
    return quotes.filter(isValidQuote);
  } catch {
    return [];
  }
}

export function saveQuotes(quotes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
    return true;
  } catch {
    return false;
  }
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