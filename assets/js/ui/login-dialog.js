import { EMISOR } from '../emisor.js';
import { logoMarkup } from './logo.js';

export function loginDialogMarkup() {
  return `
    <div class="auth-overlay" id="auth-overlay">
      <div class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" id="auth-dialog" tabindex="-1">
        <div class="auth-brand">${logoMarkup()}</div>
        <h2 class="auth-title" id="auth-title">Acceso al cotizador</h2>
        <p class="auth-subtitle">Ingresá el correo del emisor y tu código secreto para continuar.</p>

        <form id="auth-form" autocomplete="on">
          <label class="field" for="auth-email">
            <span>Correo electrónico</span>
            <input id="auth-email" name="email" type="email" value="${EMISOR.email}" autocomplete="username" spellcheck="false" />
          </label>

          <label class="field" for="auth-code">
            <span>Código secreto</span>
            <input id="auth-code" name="code" type="password" autocomplete="current-password" />
          </label>

          <button type="submit" class="btn btn-primary btn-block" id="btn-auth-login">Ingresar</button>
        </form>

        <p class="form-message" id="auth-message" role="status" aria-live="polite"></p>
      </div>
    </div>`;
}