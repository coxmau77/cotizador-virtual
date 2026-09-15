import { loadQuotes, migrateDatabase } from './storage.js';
import { setQuotes, startNewDraft } from './state.js';
import { init as initRender } from './render.js';

function init() {
  migrateDatabase();
  setQuotes(loadQuotes());
  startNewDraft();
  initRender();
}

init();