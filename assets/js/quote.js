import { CONFIG } from './config.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const pad2 = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function makeValidUntil(date = new Date(), days = CONFIG.VALIDITY_DAYS_DEFAULT) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function makeQuoteNumber(date = new Date()) {
  const p = (n) => pad2(n);
  return `COT-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

export function resolveNumberCollision(base, existingNumbers = []) {
  if (!existingNumbers.includes(base)) return base;
  for (const suffix of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const candidate = `${base}-${suffix}`;
    if (!existingNumbers.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

const normNumber = (value) => (value === '' || value === null || value === undefined ? '' : Number(value));

const normItem = (item) => ({
  description: String(item?.description ?? ''),
  quantity: normNumber(item?.quantity),
  price: normNumber(item?.price)
});

export function createQuote({
  client = '',
  currency = CONFIG.DEFAULT_CURRENCY,
  discount = 0,
  items = [],
  notes = '',
  number = null,
  date = new Date(),
  validUntil = null,
  existingNumbers = []
} = {}) {
  return {
    number: number || resolveNumberCollision(makeQuoteNumber(date), existingNumbers),
    date: date.toISOString(),
    validUntil: validUntil || toISODate(date),
    client: String(client),
    currency,
    discount: Number(discount) || 0,
    items: items.map(normItem),
    notes: String(notes),
    status: 'generado'
  };
}

export const lineTotal = (item) => round2((Number(item.quantity) || 0) * (Number(item.price) || 0));

export function calculateQuote(quote) {
  const currency = CONFIG.CURRENCIES.find((c) => c.code === quote.currency) || CONFIG.CURRENCIES[0];
  const items = quote.items.map((item) => ({ ...item, subtotal: lineTotal(item) }));
  const subtotal = round2(items.reduce((sum, item) => sum + item.subtotal, 0));
  const discount = Math.min(Math.max(Number(quote.discount) || 0, 0), 100);
  const discountAmount = round2(subtotal * (discount / 100));
  const base = round2(subtotal - discountAmount);
  const taxRate = currency.tax;
  const tax = taxRate ? round2(base * taxRate) : 0;
  const total = round2(base + tax);
  return { items, subtotal, discount, discountAmount, base, tax, taxRate, total, currency };
}

export function validateQuote(quote) {
  const errors = {};
  if (!String(quote.client ?? '').trim()) errors.client = 'Ingresá el nombre del cliente.';

  const items = Array.isArray(quote.items) ? quote.items : [];
  if (!items.length) {
    errors.items = 'Agregá al menos un item.';
  } else {
    items.forEach((item, index) => {
      if (!String(item.description ?? '').trim()) errors[`item-${index}-description`] = 'Agregá una descripción.';
      const quantity = item.quantity;
      const price = item.price;
      if (quantity === '' || quantity === null || quantity === undefined) {
        errors[`item-${index}-quantity`] = 'Ingresá una cantidad.';
      } else if (!(Number(quantity) > 0)) {
        errors[`item-${index}-quantity`] = 'La cantidad debe ser mayor a 0.';
      }
      if (price === '' || price === null || price === undefined) {
        errors[`item-${index}-price`] = 'Ingresá el precio.';
      } else if (!(Number(price) >= 0)) {
        errors[`item-${index}-price`] = 'El precio no puede ser negativo.';
      }
    });
  }

  const discount = Number(quote.discount);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    errors.discount = 'El descuento debe estar entre 0 y 100.';
  }

  const validUntil = quote.validUntil;
  if (!validUntil || !/^\d{4}-\d{2}-\d{2}$/.test(String(validUntil))) {
    errors.validUntil = 'Elegí una fecha de validez.';
  } else if (String(validUntil) <= toISODate(new Date())) {
    errors.validUntil = 'La fecha de validez debe ser posterior a hoy.';
  }

  return errors;
}

export function isItemComplete(item) {
  if (!item || !String(item.description ?? '').trim()) return false;
  const quantity = item.quantity;
  const price = item.price;
  if (quantity === '' || quantity === null || quantity === undefined || !(Number(quantity) > 0)) return false;
  if (price === '' || price === null || price === undefined || !(Number(price) >= 0)) return false;
  return true;
}