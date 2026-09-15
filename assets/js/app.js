import { CONFIG } from './config.js';
import { loadQuotes, saveQuotes } from './storage.js';
import { setQuotes, startNewDraft } from './state.js';
import { init as initRender } from './render.js';
import { SAMPLE_QUOTES } from '../../data/sample-data.js';

const SEED_KEY = 'cotizador-v0.1:seeded';

function seedIfNeeded() {
  if (!CONFIG.SEED_SAMPLE) return;
  try {
    if (localStorage.getItem(SEED_KEY)) return;
    const seeded = SAMPLE_QUOTES.map((q) => ({
      ...q,
      items: q.items.map((i) => ({ ...i }))
    }));
    saveQuotes(seeded);
    localStorage.setItem(SEED_KEY, '1');
  } catch {
    /* si el almacenamiento falla, seguimos sin semilla */
  }
}

function init() {
  seedIfNeeded();
  setQuotes(loadQuotes());
  startNewDraft();
  initRender();
}

init();