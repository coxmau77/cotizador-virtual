import { CONFIG } from './config.js';
import { createQuote } from './quote.js';

const state = {
  view: 'new',
  quotes: [],
  draft: null,
  editingNumber: null
};

export function getState() { return state; }
export function setQuotes(quotes) { state.quotes = quotes; }
export function existingNumbers() { return state.quotes.map((q) => q.number); }

export function startNewDraft() {
  state.editingNumber = null;
  state.draft = createQuote({
    items: [emptyItem()],
    existingNumbers: existingNumbers()
  });
}

function emptyItem() {
  return { description: '', quantity: '', price: '' };
}

export function loadDraft(quote) {
  state.editingNumber = quote.number;
  state.draft = createQuote({
    number: quote.number,
    date: new Date(quote.date),
    client: quote.client,
    currency: quote.currency,
    discount: quote.discount,
    items: quote.items.map((i) => ({ ...i })),
    notes: quote.notes,
    existingNumbers: []
  });
}

export function duplicateIntoDraft(quote) {
  state.editingNumber = null;
  state.draft = createQuote({
    client: quote.client,
    currency: quote.currency,
    discount: quote.discount,
    items: quote.items.map((i) => ({ ...i })),
    notes: quote.notes,
    existingNumbers: existingNumbers().filter((n) => n !== quote.number)
  });
}