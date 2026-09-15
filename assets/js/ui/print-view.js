import { EMISOR } from '../emisor.js';
import { calculateQuote } from '../quote.js';
import { formatMoney, formatDate, escapeHtml } from '../formatters.js';

export function printDialogMarkup() {
  return `
    <div class="print-dialog-body">
      <div class="print-controls">
        <strong>Vista de impresión · A4</strong>
        <div class="print-controls-actions">
          <button type="button" class="btn btn-primary" data-action="print-do">Imprimir</button>
          <button type="button" class="btn btn-ghost" data-action="print-share" id="btn-share" hidden>Compartir</button>
          <button type="button" class="btn btn-ghost" data-action="print-cancel">Cerrar</button>
        </div>
      </div>
      <div id="print-sheet" class="print-sheet"></div>
    </div>`;
}

export function buildPrintSheet(quote) {
  const calc = calculateQuote(quote);
  const currency = quote.currency;

  const discountLine = calc.discount > 0
    ? `<div class="pt-line"><span>Descuento (${calc.discount}%)</span><strong>−${formatMoney(calc.discountAmount, currency)}</strong></div>`
    : '';

  const taxLine = calc.taxRate > 0
    ? `<div class="pt-line"><span>IVA (${Math.round(calc.taxRate * 100)}%)</span><strong>${formatMoney(calc.tax, currency)}</strong></div>`
    : '';

  const rows = calc.items
    .map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(item.description)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatMoney(item.price, currency)}</td>
        <td class="num">${formatMoney(item.subtotal, currency)}</td>
      </tr>`)
    .join('');

  return `
    <header class="print-header">
      <div class="ph-brand">
        <h1>${escapeHtml(EMISOR.name)}</h1>
        <p>${escapeHtml(EMISOR.document)}</p>
        <p>${escapeHtml(EMISOR.address)}</p>
        <p>${escapeHtml(EMISOR.phone)}${EMISOR.email ? ` · ${escapeHtml(EMISOR.email)}` : ''}</p>
      </div>
      <div class="ph-doc">
        <p class="ph-doc-label">Cotización</p>
        <p class="ph-doc-number">${escapeHtml(quote.number)}</p>
        <p>Fecha: ${escapeHtml(formatDate(quote.date))}</p>
      </div>
    </header>

    <section class="print-client">
      <h2>Cliente</h2>
      <p>${escapeHtml(quote.client)}</p>
    </section>

    <table class="print-items">
      <thead>
        <tr><th>#</th><th>Descripción</th><th class="num">Cant.</th><th class="num">P. unitario</th><th class="num">Subtotal</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="print-totals">
      <div class="pt-line"><span>Subtotal</span><strong>${formatMoney(calc.subtotal, currency)}</strong></div>
      ${discountLine}
      <div class="pt-line"><span>Base</span><strong>${formatMoney(calc.base, currency)}</strong></div>
      ${taxLine}
      <div class="pt-line pt-total"><span>Total</span><strong>${formatMoney(calc.total, currency)}</strong></div>
    </div>

    ${quote.notes ? `<section class="print-notes"><h2>Notas</h2><p>${escapeHtml(quote.notes)}</p></section>` : ''}

    <footer class="print-footer">${escapeHtml(EMISOR.footer)}</footer>`;
}

export function documentTitleFor(quote) {
  return `${quote.number} - ${quote.client}`;
}