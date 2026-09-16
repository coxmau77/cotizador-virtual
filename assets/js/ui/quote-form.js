import { CONFIG } from '../config.js';
import { getState } from '../state.js';
import { calculateQuote, toISODate, makeValidUntil } from '../quote.js';
import { formatMoney, escapeHtml } from '../formatters.js';

export function formMarkup() {
  const { draft } = getState();
  const currencyOptions = CONFIG.CURRENCIES
    .map((c) => `<option value="${c.code}" ${c.code === draft.currency ? 'selected' : ''}>${c.code} · ${escapeHtml(c.name)}</option>`)
    .join('');
  const validUntilError = (() => {
    const v = draft.validUntil;
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || String(v) <= toISODate(new Date())) {
      return '<p class="field-error">La fecha de validez debe ser posterior a hoy.</p>';
    }
    return '';
  })();

  return `
    <form id="quote-form" autocomplete="on">
      <div class="card form-client">
        <label class="field" for="client">
          <span>Cliente</span>
          <input id="client" name="client" type="text" value="${escapeHtml(draft.client)}" placeholder="Nombre de la persona o empresa" autocomplete="organization" />
        </label>
        <div class="field-row">
          <label class="field" for="currency">
            <span>Moneda</span>
            <select id="currency" name="currency">
              ${currencyOptions}
            </select>
          </label>
          <label class="field" for="discount">
            <span>Descuento global (%)</span>
            <input id="discount" name="discount" type="number" min="0" max="100" step="any" inputmode="decimal" value="${draft.discount}" />
          </label>
        </div>
        <label class="field" for="validUntil">
          <span>Válida hasta</span>
          <input id="validUntil" name="validUntil" type="date" min="${makeValidUntil(new Date(), 1)}" value="${draft.validUntil}" required />
          ${validUntilError}
        </label>
      </div>

      <div class="card form-items">
        <h2 class="card-title">Items</h2>
        <div id="items-area"></div>
        <button type="button" class="btn btn-primary btn-sm" data-action="add-item">+ Agregar item</button>
      </div>

      <div class="card form-notes">
        <label class="field" for="notes" style="margin-bottom:0">
          <span>Notas</span>
          <textarea id="notes" name="notes" rows="3" placeholder="Condiciones, validez, observaciones…">${escapeHtml(draft.notes)}</textarea>
        </label>
      </div>

      <div class="action-bar">
        <button type="button" class="btn btn-primary" data-action="save-quote" id="btn-generate">Guardar cotización</button>
        <button type="button" class="btn btn-warning" data-action="save-overwrite" id="btn-overwrite" hidden>Reemplazar cotización más antigua</button>
      </div>
      <p class="form-message" id="form-message" role="status" aria-live="polite"></p>
    </form>`;
}

export function totalsMarkup() {
  const { draft } = getState();
  const calc = calculateQuote(draft);
  const currency = draft.currency;

  const discountLine = calc.discount > 0
    ? `<div class="totals-line"><span>Descuento (${calc.discount}%)</span><strong>−${formatMoney(calc.discountAmount, currency)}</strong></div>`
    : '';

  const taxLine = calc.taxRate > 0
    ? `<div class="totals-line"><span>IVA (${Math.round(calc.taxRate * 100)}%)</span><strong>${formatMoney(calc.tax, currency)}</strong></div>`
    : '';

  const noTaxNote = calc.taxRate === 0
    ? '<p class="totals-note">Sin IVA · el total es el importe base.</p>'
    : '';

  return `
    <aside class="card totals" aria-label="Totales">
      <div class="totals-line"><span>Subtotal</span><strong>${formatMoney(calc.subtotal, currency)}</strong></div>
      ${discountLine}
      <div class="totals-line"><span>Base</span><strong>${formatMoney(calc.base, currency)}</strong></div>
      ${taxLine}
      <div class="totals-line total"><span>Total</span><strong>${formatMoney(calc.total, currency)}</strong></div>
      ${noTaxNote}
    </aside>`;
}