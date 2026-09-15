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