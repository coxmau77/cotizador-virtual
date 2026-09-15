import { formatMoney, escapeHtml } from '../formatters.js';
import { lineTotal } from '../quote.js';

export function itemsMarkup(items, currency) {
  return `
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-desc">Descripción</th>
          <th class="col-qty">Cant.</th>
          <th class="col-price">Precio unitario</th>
          <th class="col-st">Subtotal</th>
          <th class="col-rm"></th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => itemRow(item, index, currency)).join('')}
      </tbody>
    </table>`;
}

function itemRow(item, index, currency) {
  return `
    <tr data-index="${index}">
      <td class="col-desc">
        <input class="item-desc" type="text" data-item="description" value="${escapeHtml(item.description)}" placeholder="Descripción…" aria-label="Descripción del item ${index + 1}" autocomplete="off" />
      </td>
      <td class="col-qty">
        <input class="item-qty" type="number" data-item="quantity" min="0" step="any" inputmode="decimal" value="${item.quantity}" aria-label="Cantidad del item ${index + 1}" />
      </td>
      <td class="col-price">
        <input class="item-price" type="number" data-item="price" min="0" step="any" inputmode="decimal" value="${item.price}" aria-label="Precio unitario del item ${index + 1}" />
      </td>
      <td class="col-st">
        <span class="item-subtotal" data-item-subtotal>${formatMoney(lineTotal(item), currency)}</span>
      </td>
      <td class="col-rm">
        <button type="button" class="btn-icon" data-action="remove-item" data-index="${index}" aria-label="Quitar item ${index + 1}">✕</button>
      </td>
    </tr>`;
}