import { EMISOR } from '../emisor.js';
import { escapeHtml } from '../formatters.js';

export function emisorBrandMarkup(base = '') {
  return `
    <div class="view-header-emisor">
      <img class="vh-logo" src="${base}assets/img/user-logo.png" alt="${escapeHtml(EMISOR.name)}" />
      <p class="vh-name">${escapeHtml(EMISOR.name)}</p>
      <p>${escapeHtml(EMISOR.cuit)}</p>
      <p>${escapeHtml(EMISOR.email)}</p>
      ${EMISOR.phone ? `<p>${escapeHtml(EMISOR.phone)}</p>` : ''}
    </div>`;
}