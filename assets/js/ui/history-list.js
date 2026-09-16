import { getState } from '../state.js';
import { CONFIG } from '../config.js';
import { EMISOR } from '../emisor.js';
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
      </div>
      ${backupBarMarkup()}`;
  }

  const newestFirst = [...quotes].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return `
    <header class="view-header">
      <div>
        <h1>Historial</h1>
        <p class="view-subtitle">${quotes.length} / ${CONFIG.QUOTE_LIMIT} guardadas</p>
      </div>
    </header>
    <p class="form-message" id="form-message" role="status" aria-live="polite"></p>
    <ul class="history-list">
      ${newestFirst.map(card).join('')}
    </ul>
    ${backupBarMarkup()}`;
}

function backupBarMarkup() {
  const { quotes } = getState();
  const slotsFree = quotes.length === 0;
  const importTitle = slotsFree
    ? ''
    : 'No es posible importar: los slots de almacenamiento no son suficientes.';
  const contactHref = `mailto:${EMISOR.proveedorEmail}?subject=${encodeURIComponent('Extensión de slots · Cotizador Virtual')}`;
  return `
    <div class="backup-bar">
      <button type="button" class="btn btn-ghost btn-sm" data-action="export-json">Exportar respaldo (JSON)</button>
      <label class="btn btn-ghost btn-sm file-label${slotsFree ? '' : ' is-disabled'}" data-action="import-toggle" title="${escapeHtml(importTitle)}">Importar respaldo (JSON)<input type="file" accept="application/json,.json" data-action="import-json" hidden /></label>
      ${slotsFree ? '' : `<a class="backup-contact" href="${contactHref}">¿Necesitás más slots? Contactá al desarrollador</a>`}
      <span class="backup-hint" title="El cotizador no se responsabiliza por eliminaciones realizadas por el usuario ni garantiza el historial como respaldo. La app solo se limita a la creación de cotizaciones, no al almacenamiento de documentos.">El respaldo JSON evita perder cotizaciones ante el límite de slots.</span>
    </div>`;
}

function card(quote) {
  const calc = calculateQuote(quote);
  const itemCount = quote.items.length;
  return `
    <li class="history-card" data-number="${escapeHtml(quote.number)}">
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
        <button type="button" class="btn btn-ghost btn-sm" data-action="preview-quote" data-number="${escapeHtml(quote.number)}">Vista previa</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete-quote" data-number="${escapeHtml(quote.number)}">Eliminar</button>
      </div>
    </li>`;
}