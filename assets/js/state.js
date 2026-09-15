import { CONFIG } from './config.js';
import { createQuote } from './quote.js';

const state = {
  view: 'new',
  quotes: [],
  draft: null
};

export function getState() { return state; }
export function setQuotes(quotes) { state.quotes = quotes; }
export function existingNumbers() { return state.quotes.map((q) => q.number); }

export function startNewDraft() {
  state.draft = createQuote({
    items: [emptyItem()],
    existingNumbers: existingNumbers()
  });
}

function emptyItem() {
  return { description: '', quantity: '', price: '' };
}

export function duplicateIntoDraft(quote) {
  state.draft = createQuote({
    client: quote.client,
    currency: quote.currency,
    discount: quote.discount,
    items: quote.items.map((i) => ({ ...i })),
    notes: quote.notes,
    existingNumbers: existingNumbers().filter((n) => n !== quote.number)
  });
}