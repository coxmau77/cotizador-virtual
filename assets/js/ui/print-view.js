import { EMISOR } from '../emisor.js';
import { calculateQuote } from '../quote.js';
import { formatMoney, formatDate, escapeHtml } from '../formatters.js';

export function buildPrintSheet(quote, base = '') {
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
        <img class="ph-logo" src="${base}assets/img/user-logo.png" alt="" />
        <div class="ph-text">
          <h1>${escapeHtml(EMISOR.name)}</h1>
          <p>${escapeHtml(EMISOR.document)}</p>
          <p>${escapeHtml(EMISOR.address)}</p>
          <p>${escapeHtml(EMISOR.phone)}${EMISOR.email ? ` · ${escapeHtml(EMISOR.email)}` : ''}</p>
        </div>
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

export function openPrintPreview(quote) {
  if (!quote) return null;
  const win = window.open('', '_blank');
  if (!win) return null;

  const base = new URL('.', document.baseURI).href;
  const sheetHtml = buildPrintSheet(quote, base);
  const css = (file) => `<link rel="stylesheet" href="${base + file}" />`;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitleFor(quote))}</title>
  ${css('assets/css/variables.css')}
  ${css('assets/css/styles.css')}
  ${css('assets/css/print.css')}
  <style>
    html, body { background: #e8edf3; margin: 0; }
    body { display: flex; flex-direction: column; align-items: center; padding: 24px 0; }
    #print-sheet { margin: 0; }
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      gap: 10px;
      justify-content: center;
      align-items: center;
      width: 100%;
      padding: 10px 0;
      background: rgba(232, 237, 243, 0.92);
      backdrop-filter: blur(4px);
      box-shadow: 0 1px 0 rgba(16, 24, 40, 0.08);
    }
    .print-toolbar button {
      font: inherit;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-print {
      background: #1a6df2;
      color: #fff;
      border: 1px solid #1a6df2;
    }
    .btn-print:hover { background: #1558c4; }
    .btn-close {
      background: #fff;
      color: #131722;
      border: 1px solid #c3ccd6;
    }
    .btn-close:hover { background: #f8fafc; }
    @media print {
      html, body { background: #fff; padding: 0; }
      .print-toolbar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <button type="button" class="btn-print" onclick="window.print()">Imprimir / Exportar PDF</button>
    <button type="button" class="btn-close" onclick="window.close()">Cerrar</button>
  </div>
  <div id="print-sheet" class="print-sheet">${sheetHtml}</div>
  <script>
    window.addEventListener('afterprint', function () {
      window.close();
    });
  </script>
</body>
</html>`);
  win.document.close();
  if (typeof win.focus === 'function') win.focus();
  return win;
}