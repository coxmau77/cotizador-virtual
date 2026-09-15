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
      ${view === 'history' ? `
      <button type="button" class="btn btn-nav-clear" data-action="clear-history" ${quotes.length ? '' : 'disabled'} title="${quotes.length ? '' : 'No hay historial para borrar.'}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
        Borrar historial
      </button>` : ''}
      <p class="sidebar-limit" role="status">${quotes.length} / ${limit} slots${full ? ' · lleno' : ''}</p>
      <p class="sidebar-hint">Los datos se guardan en este dispositivo (localStorage).</p>
    </nav>`;
}