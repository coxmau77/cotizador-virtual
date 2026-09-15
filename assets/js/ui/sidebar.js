import { getState } from '../state.js';
import { CONFIG } from '../config.js';

export function sidebarMarkup() {
  const { view, quotes } = getState();
  const limit = CONFIG.QUOTE_LIMIT;
  const full = quotes.length >= limit;
  return `
    <nav class="sidebar" aria-label="Navegación principal">
      <button type="button" class="btn btn-nav ${view === 'new' ? 'is-active' : ''}" data-action="view-new">Nueva cotización</button>
      <button type="button" class="btn btn-nav ${view === 'history' ? 'is-active' : ''}" data-action="view-history">Historial <span class="count">${quotes.length}</span></button>
      <p class="sidebar-limit" role="status">${quotes.length} / ${limit} slots${full ? ' · lleno' : ''}</p>
      <p class="sidebar-hint">Los datos se guardan en este dispositivo (localStorage).</p>
    </nav>`;
}