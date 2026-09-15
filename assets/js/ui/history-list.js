import { getState } from '../state.js';
import { CONFIG } from '../config.js';
import { calculateQuote } from '../quote.js';
import { formatMoney, formatDateTime, escapeHtml } from '../formatters.js';

export function historyMarkup() {
  const { quotes } = getState();
  if (!quotes.length) {
    return `
      <header class="view-header">
        <div>
          <h1>Historial</h1>
          <p class="view-subtitle">0 / ${CONFIG.QUOTE_LIMIT} guardadas</p>
        </div>
      </header>
      <p class="form-message" id="form-message" role="status" aria-live="polite"></p>
      <div class="empty-history">
        <p>No hay cotizaciones guardadas todavía.</p>
        <p>Creá tu primera cotización ahora.</p>
        <button type="button" class="btn btn-primary" data-action="view-new">Crear cotización</button>
      </div>`;
  }

  const newestFirst = [...quotes].reverse();
  return `
    <header class="view-header">
      <div>
        <h1>Historial</h1>
        <p class="view-subtitle">${quotes.length} / ${CONFIG.QUOTE_LIMIT} guardadas</p>
      </div>
      <div class="view-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="export-json">Exportar respaldo (JSON)</button>
      </div>
    </header>
    <p class="form-message" id="form-message" role="status" aria-live="polite"></p>
    <ul class="history-list">
      ${newestFirst.map(card).join('')}
    </ul>`;
}

function card(quote) {
  const calc = calculateQuote(quote);
  const itemCount = quote.items.length;
  return `
    <li class="history-card">
      <div class="hc-head">
        <div>
          <h2 class="hc-number mono">${escapeHtml(quote.number)}</h2>
          <p class="hc-date">${escapeHtml(formatDateTime(quote.date))}</p>
        </div>
        <span class="badge">${escapeHtml(quote.currency)}</span>
      </div>
      <p class="hc-client">${escapeHtml(quote.client)}</p>
      <p class="hc-meta">${itemCount} item${itemCount === 1 ? '' : 's'} · ${formatMoney(calc.total, quote.currency)}</p>
      <div class="hc-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="duplicate-quote" data-number="${escapeHtml(quote.number)}">Duplicar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="reprint-quote" data-number="${escapeHtml(quote.number)}">Reimprimir</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete-quote" data-number="${escapeHtml(quote.number)}">Eliminar</button>
      </div>
    </li>`;
}