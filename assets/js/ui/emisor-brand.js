import { EMISOR } from '../emisor.js';
import { escapeHtml } from '../formatters.js';
import { logoMarkup } from './logo.js';

export function emisorBrandMarkup(base = '') {
  return `
    <div class="view-header-emisor">
      ${logoMarkup(base)}
      <p class="vh-name">${escapeHtml(EMISOR.name)}</p>
      <p>${escapeHtml(EMISOR.cuit)}</p>
      <p>${escapeHtml(EMISOR.email)}</p>
      ${EMISOR.phone ? `<p>${escapeHtml(EMISOR.phone)}</p>` : ''}
    </div>`;
}