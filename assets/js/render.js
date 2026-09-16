import { getState, startNewDraft, setQuotes, existingNumbers } from './state.js';
import { CONFIG } from './config.js';
import { resolveNumberCollision, makeQuoteNumber, lineTotal, validateQuote, isItemComplete, toISODate } from './quote.js';
import { formatMoney } from './formatters.js';
import {
  isAtLimit,
  migrateDatabase,
  saveQuotes,
  eraseQuotes,
  pushQuote,
  deleteQuote as removeQuoteNumber,
  oldestQuote,
  exportJSONString,
  parseJSON,
  loadQuotes,
  findInDatabase
} from './storage.js';
import { sidebarMarkup } from './ui/sidebar.js';
import { formMarkup, totalsMarkup } from './ui/quote-form.js';
import { itemsMarkup } from './ui/quote-table.js';
import { historyMarkup } from './ui/history-list.js';
import { openPrintPreview } from './ui/print-view.js';
import { emisorBrandMarkup } from './ui/emisor-brand.js';
import { loginDialogMarkup } from './ui/login-dialog.js';
import { EMISOR } from './emisor.js';
import {
  authenticate,
  saveSession,
  clearSession,
  hasValidSession,
  registerFailedAttempt,
  resetAuthAttempts,
  isAccountLocked,
  sessionExpiry
} from './auth.js';

const clone = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

let root = null;
let messageTimer = null;
let privateDataLoaded = false;

const VIEW_TITLES = {
  new: 'Nueva cotización · Cotizador Virtual',
  history: 'Historial · Cotizador Virtual'
};

export function init() {
  root = document.getElementById('app-main');
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('submit', onFormSubmit);
  render();
}

export function render() {
  const state = getState();
  renderSidebar();
  if (state.view === 'history') {
    root.innerHTML = historyMarkup();
    const totalsArea = document.getElementById('totals-area');
    if (totalsArea) totalsArea.innerHTML = '';
    setDocumentTitle('history');
  } else {
    root.innerHTML = formMarkup();
    renderItems();
    renderTotals();
    updateFormState();
    updateAddButton();
    setDocumentTitle('new');
  }
}

export function unlockApp() {
  if (!privateDataLoaded) {
    migrateDatabase();
    setQuotes(loadQuotes());
    privateDataLoaded = true;
  }
  render();
}

function lockApp() {
  privateDataLoaded = false;
  setQuotes([]);
  render();
}

function renderSidebar() {
  const slot = document.getElementById('sidebar-slot');
  slot.innerHTML = sidebarMarkup();
  const brandSlot = document.getElementById('sidebar-brand');
  if (brandSlot) brandSlot.innerHTML = emisorBrandMarkup();
}

function renderItems() {
  const { draft } = getState();
  const area = document.getElementById('items-area');
  area.innerHTML = itemsMarkup(draft.items, draft.currency);
}

function renderTotals() {
  const area = document.getElementById('totals-area');
  area.innerHTML = totalsMarkup();
}

function updateAddButton() {
  const btn = document.querySelector('[data-action="add-item"]');
  if (!btn) return;
  const { draft } = getState();
  const last = draft.items[draft.items.length - 1];
  const complete = isItemComplete(last);
  btn.disabled = !complete;
  btn.setAttribute('aria-disabled', complete ? 'false' : 'true');
  btn.title = complete ? '' : 'Completá la fila actual para agregar otro item';
}

function updateFormState() {
  const btnGenerate = document.getElementById('btn-generate');
  const btnOverwrite = document.getElementById('btn-overwrite');
  if (!btnGenerate || !btnOverwrite) return;
  const { draft, quotes } = getState();
  const valid = Object.keys(validateQuote(draft)).length === 0;
  const full = isAtLimit(quotes);
  btnGenerate.disabled = full || !valid;
  btnGenerate.title = !valid ? 'Completá los campos requeridos para guardar.' : '';
  btnOverwrite.hidden = !full;
  btnOverwrite.disabled = !valid;
  btnOverwrite.title = !valid ? 'Completá los campos requeridos.' : '';
}

function setDocumentTitle(viewKey) {
  document.title = VIEW_TITLES[viewKey] || VIEW_TITLES.new;
}

function focusFirstInvalid() {
  const first = document.querySelector('[aria-invalid="true"]') || document.getElementById('client');
  if (first) {
    first.focus();
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function setInvalid(el, invalid) {
  if (el) el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
}

function validateFieldVisual(el) {
  if (!el) return;
  if (el.name === 'client') setInvalid(el, !String(el.value).trim());
  else if (el.name === 'discount') {
    const v = Number(el.value);
    setInvalid(el, !(Number.isFinite(v) && v >= 0 && v <= 100));
  } else if (el.name === 'validUntil') {
    const v = el.value;
    const warned = !v || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v <= toISODate(new Date());
    el.classList.toggle('is-warning', warned);
  } else if (el.dataset.item === 'description') setInvalid(el, !String(el.value).trim());
  else if (el.dataset.item === 'quantity') {
    const v = el.value;
    setInvalid(el, v === '' || !(Number(v) > 0));
  } else if (el.dataset.item === 'price') {
    const v = el.value;
    setInvalid(el, v === '' || !(Number(v) >= 0));
  }
}

function fieldForError(key) {
  if (key === 'client' || key === 'discount' || key === 'validUntil') return document.getElementById(key);
  if (key.startsWith('item-')) {
    const [, index, field] = key.split('-');
    return document.querySelector(`#items-area tr[data-index="${index}"] [data-item="${field}"]`);
  }
  return null;
}

function setFieldError(el, message) {
  if (!el) return;
  el.setAttribute('aria-invalid', 'true');
  el.parentElement?.querySelector('.field-error')?.remove();
  const err = document.createElement('p');
  err.className = 'field-error';
  err.textContent = message;
  el.insertAdjacentElement('afterend', err);
}

function highlightErrors(errors) {
  Object.entries(errors).forEach(([key, message]) => {
    if (key === 'items') {
      document.querySelectorAll('#items-area [data-item="description"]').forEach((el) => setFieldError(el, message));
    } else {
      setFieldError(fieldForError(key), message);
    }
  });
  focusFirstInvalid();
}

function showMessage(text, kind = 'info') {
  const el = document.getElementById('form-message');
  if (!el) return;
  el.textContent = text;
  el.className = `form-message ${kind}`;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    el.textContent = '';
    el.className = 'form-message';
  }, 6000);
}

/* ---------- Navegación y acciones de vista ---------- */

function navigate(view) {
  getState().view = view;
  render();
  root.scrollTop = 0;
  window.scrollTo({ top: 0 });
}

function persist() {
  return saveQuotes(getState().quotes);
}

function requireValidSession() {
  if (hasValidSession()) return true;
  checkSessionGate();
  return false;
}

function handleSaveQuote() {
  if (!requireValidSession()) return;
  const state = getState();
  const errors = validateQuote(state.draft);
  if (Object.keys(errors).length) {
    highlightErrors(errors);
    showMessage('Revisá los campos marcados antes de guardar.', 'error');
    return;
  }

  state.draft.number = resolveNumberCollision(state.draft.number || makeQuoteNumber(), existingNumbers());
  const savedNumber = state.draft.number;
  pushQuote(state.quotes, clone(state.draft));

  if (!persist()) {
    showMessage('No se pudo guardar: almacenamiento lleno o bloqueado. Exportá un respaldo JSON.', 'error');
    return;
  }

  const fullAfter = isAtLimit(state.quotes);
  if (!fullAfter) {
    startNewDraft();
  }

  navigate('history');

  if (fullAfter) {
    showMessage(`Slot lleno (${CONFIG.QUOTE_LIMIT}): para crear otra cotización usá “Reemplazar cotización más antigua” o exportá un respaldo.`, 'warn');
  } else {
    showMessage(`Cotización guardada: ${savedNumber}.`, 'ok');
  }
  flashNewQuote(savedNumber);
}

function handleSaveOverwrite() {
  if (!requireValidSession()) return;
  const state = getState();
  const errors = validateQuote(state.draft);
  if (Object.keys(errors).length) {
    highlightErrors(errors);
    showMessage('Revisá los campos marcados antes de guardar.', 'error');
    return;
  }

  const oldest = oldestQuote(state.quotes);
  if (!oldest) return;

  const ok = window.confirm(
    `Se reemplazará la cotización más antigua:\n${oldest.number} · ${oldest.client}\n\n¿Continuar?`
  );
  if (!ok) return;

  const freshNumber = resolveNumberCollision(
    makeQuoteNumber(),
    existingNumbers().filter((n) => n !== oldest.number)
  );
  const replacement = { ...clone(state.draft), number: freshNumber };

  const index = state.quotes.indexOf(oldest);
  state.quotes[index] = replacement;

  if (!persist()) {
    showMessage('No se pudo guardar: almacenamiento lleno o bloqueado.', 'error');
    return;
  }

  startNewDraft();
  navigate('history');
  showMessage(`Se reemplazó ${oldest.number}. Nueva cotización: ${freshNumber}.`, 'ok');
  flashNewQuote(freshNumber);
}

function findByNumber(number) {
  return getState().quotes.find((q) => q.number === number) || null;
}

const FLASH_DURATION_MS = 2400;

function flashNewQuote(number) {
  const card = root.querySelector(`[data-number="${number}"]`);
  if (!card) return;
  card.classList.add('history-card--saved');
  setTimeout(() => {
    const el = root.querySelector(`[data-number="${number}"]`);
    if (el) el.classList.remove('history-card--saved');
  }, FLASH_DURATION_MS);
}

function deleteQuote(number) {
  if (!requireValidSession()) return;
  const quote = findByNumber(number);
  if (!quote) return;
  if (!window.confirm(`¿Eliminar ${quote.number} (${quote.client})?\nEsta acción no se puede deshacer.`)) return;
  setQuotes(removeQuoteNumber(getState().quotes, number));
  persist();
  render();
  showMessage('Cotización eliminada.', 'ok');
}

function clearHistory() {
  if (!requireValidSession()) return;
  if (!getState().quotes.length) return;
  if (!window.confirm('Se borrarán todas las cotizaciones guardadas. Esta acción no se puede deshacer.\n\n¿Continuar?')) return;
  setQuotes([]);
  eraseQuotes();
  render();
  showMessage('Historial borrado.', 'ok');
}

function addItem() {
  const { draft } = getState();
  const last = draft.items[draft.items.length - 1];
  if (!isItemComplete(last)) return;
  draft.items.push({ description: '', quantity: '', price: '' });
  renderItems();
  renderTotals();
  updateAddButton();
  updateFormState();
  const first = document.querySelector('tr:last-child [data-item="description"]');
  if (first) first.focus();
}

function removeItem(index) {
  const { draft } = getState();
  if (index < 0 || index >= draft.items.length) return;
  draft.items.splice(index, 1);
  if (!draft.items.length) draft.items.push({ description: '', quantity: '', price: '' });
  renderItems();
  renderTotals();
  updateAddButton();
  updateFormState();
}

function updateRowSubtotal(row, index) {
  const { draft } = getState();
  const el = row && row.querySelector('[data-item-subtotal]');
  if (el && draft.items[index]) {
    const item = draft.items[index];
    el.textContent = item.quantity === '' || item.price === '' ? '—' : formatMoney(lineTotal(item), draft.currency);
  }
}

/* ---------- Export / Import ---------- */

function downloadBlob(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportJSON() {
  if (!requireValidSession()) return;
  const quotes = getState().quotes;
  downloadBlob(
    exportJSONString(quotes),
    `cotizaciones-respaldo-${new Date().toISOString().slice(0, 10)}.json`
  );
  showMessage(`Respaldo exportado (${quotes.length} cotizaciones).`, 'ok');
}

const IMPORT_BLOCKED_MSG = 'No es posible importar porque los slots de almacenamiento no son suficientes. Contactá al desarrollador.';

function blockImport() {
  showMessage(IMPORT_BLOCKED_MSG, 'error');
  window.alert(IMPORT_BLOCKED_MSG);
}

function handleImportFile(inputEl) {
  if (!requireValidSession()) {
    inputEl.value = '';
    return;
  }
  const file = inputEl.files && inputEl.files[0];
  const resetInput = () => { inputEl.value = ''; };
  if (!file) return;

  const isJson = file.type === 'application/json' || /\.json$/i.test(file.name);
  if (!isJson) {
    showMessage('El respaldo debe ser un archivo en formato JSON (.json).', 'error');
    resetInput();
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => {
    showMessage('No se pudo leer el archivo.', 'error');
    resetInput();
  };
  reader.onload = () => {
    try {
      if (!requireValidSession()) return;
      const quotes = parseJSON(String(reader.result));
      if (getState().quotes.length + quotes.length > CONFIG.QUOTE_LIMIT) {
        blockImport();
        return;
      }
      if (!window.confirm(`Se importarán ${quotes.length} cotizaciones. ¿Continuar?`)) return;
      setQuotes(quotes);
      persist();
      startNewDraft();
      render();
      showMessage(`Importadas ${quotes.length} cotizaciones.`, 'ok');
    } catch (err) {
      showMessage(err.message || 'No se pudo importar el archivo.', 'error');
    } finally {
      resetInput();
    }
  };
  reader.readAsText(file);
}

/* ---------- Puerta de acceso ---------- */

export function openLoginDialog() {
  if (document.getElementById('auth-overlay')) return;
  document.body.classList.add('is-auth-locked');
  document.body.insertAdjacentHTML('beforeend', loginDialogMarkup());
  if (isAccountLocked()) {
    setAuthLockedMessage();
  }
  const dialog = document.getElementById('auth-dialog');
  if (dialog) dialog.focus();
  const email = document.getElementById('auth-email');
  if (email) {
    email.focus();
    email.select();
  }
}

function setAuthLockedMessage() {
  const btn = document.getElementById('btn-auth-login');
  const email = document.getElementById('auth-email');
  const code = document.getElementById('auth-code');
  if (btn) btn.disabled = true;
  if (email) email.disabled = true;
  if (code) code.disabled = true;
  authMessage(`Acceso bloqueado. Comunicate con el área de desarrollo: ${EMISOR.proveedorEmail}.`, 'error');
}

function closeLoginDialog() {
  const overlay = document.getElementById('auth-overlay');
  if (!overlay) return;
  overlay.classList.add('is-closing');
  setTimeout(() => {
    if (!document.body.contains(overlay)) return;
    document.body.classList.remove('is-auth-locked');
    overlay.remove();
    const nav = document.querySelector('[data-action="view-new"], [data-action="view-history"]');
    if (nav) nav.focus();
  }, 220);
}

function authMessage(text, kind = 'info') {
  const el = document.getElementById('auth-message');
  if (!el) return;
  el.textContent = text;
  el.className = `form-message ${kind}`;
}

async function handleAuthLogin() {
  const email = document.getElementById('auth-email');
  const code = document.getElementById('auth-code');
  const btn = document.getElementById('btn-auth-login');
  if (!email || !code || !btn || btn.disabled || isAccountLocked()) return;

  btn.disabled = true;
  authMessage('Verificando…', 'info');
  try {
    const ok = await authenticate(email.value, code.value);
    if (!ok) {
      const attempt = registerFailedAttempt();
      setInvalid(email, !String(email.value).trim());
      setInvalid(code, true);
      if (attempt.locked) {
        setAuthLockedMessage();
        authMessage(`Acceso bloqueado. Comunicate con el área de desarrollo: ${EMISOR.proveedorEmail}.`, 'error');
      } else {
        authMessage(`Correo o código incorrecto. Verificá los datos. Intentos restantes: ${attempt.remaining}.`, 'error');
      }
      code.focus();
      code.select();
      return;
    }
    const session = saveSession(email.value);
    resetAuthAttempts();
    unlockApp();
    scheduleSessionCheck();
    closeLoginDialog();
    if (!session.persistent) {
      showMessage('Sesión temporal: el navegador no permite guardar el acceso. Se solicitará nuevamente al recargar.', 'warn');
    }
  } catch (err) {
    authMessage(err.message || 'No se pudo iniciar sesión.', 'error');
  } finally {
    if (!isAccountLocked()) btn.disabled = false;
  }
}

function handleLogout() {
  clearSession();
  lockApp();
  openLoginDialog();
}

let sessionTimer = null;

export function startSessionWatch() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkSessionGate();
  });
  scheduleSessionCheck();
}

function checkSessionGate() {
  if (document.body.classList.contains('is-auth-locked')) return;
  if (!hasValidSession()) {
    lockApp();
    openLoginDialog();
    return;
  }
  scheduleSessionCheck();
}

function scheduleSessionCheck() {
  clearTimeout(sessionTimer);
  if (document.body.classList.contains('is-auth-locked')) return;
  const expiry = sessionExpiry();
  if (!expiry) return;
  sessionTimer = setTimeout(checkSessionGate, Math.max(0, expiry - Date.now()));
}

/* ---------- Eventos ---------- */

function onClick(e) {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === 'import-toggle') {
    if (getState().quotes.length > 0) {
      e.preventDefault();
      blockImport();
    }
    return;
  }

  if (action === 'import-json') {
    return;
  }

  e.preventDefault();

  switch (action) {
    case 'view-new':
      navigate('new');
      break;
    case 'view-history':
      navigate('history');
      break;
    case 'add-item':
      addItem();
      break;
    case 'remove-item': {
      const index = Number(actionEl.dataset.index);
      removeItem(index);
      break;
    }
    case 'save-quote':
      handleSaveQuote();
      break;
    case 'save-overwrite':
      handleSaveOverwrite();
      break;
    case 'preview-quote':
      openPrintPreview(findInDatabase(actionEl.dataset.number));
      break;
    case 'delete-quote':
      deleteQuote(actionEl.dataset.number);
      break;
    case 'clear-history':
      clearHistory();
      break;
    case 'export-json':
      exportJSON();
      break;
    case 'auth-login':
      handleAuthLogin();
      break;
    case 'logout':
      handleLogout();
      break;
    default:
      break;
  }
}

function onChange(e) {
  const { draft } = getState();

  if (e.target.name === 'currency') {
    draft.currency = e.target.value;
    const label = document.getElementById('form-currency-label');
    if (label) label.textContent = draft.currency;
    renderItems();
    renderTotals();
    return;
  }

  if (e.target.dataset.action === 'import-json') {
    handleImportFile(e.target);
  }
}

function onInput(e) {
  const { draft } = getState();
  const el = e.target;

  el.parentElement?.querySelector('.field-error, .field-warning')?.remove();
  if (el.closest?.('#auth-dialog')) {
    setInvalid(el, false);
    return;
  }
  validateFieldVisual(el);

  if (el.name === 'client') {
    draft.client = el.value;
    updateFormState();
    return;
  }

  if (el.name === 'discount') {
    draft.discount = el.value;
    renderTotals();
    updateFormState();
    return;
  }

  if (el.name === 'validUntil') {
    draft.validUntil = el.value;
    updateFormState();
    return;
  }

  if (el.name === 'notes') {
    draft.notes = el.value;
    return;
  }

  if (el.dataset.item) {
    const index = Number(el.closest('tr[data-index]')?.dataset.index);
    if (Number.isNaN(index) || !draft.items[index]) return;
    if (el.dataset.item === 'description') draft.items[index].description = el.value;
    else if (el.dataset.item === 'quantity') draft.items[index].quantity = el.value;
    else if (el.dataset.item === 'price') draft.items[index].price = el.value;
    updateRowSubtotal(el.closest('tr[data-index]'), index);
    renderTotals();
    updateAddButton();
    updateFormState();
  }
}

function onFormSubmit(e) {
  e.preventDefault();
  if (e.target.id === 'auth-form') handleAuthLogin();
}

function onKeydown(e) {
  const el = e.target;
  const isTextInput = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

  if (el?.closest?.('#auth-dialog') && e.key === 'Enter') {
    e.preventDefault();
    handleAuthLogin();
    return;
  }

  if (el?.dataset?.item) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const fields = Array.from(document.querySelectorAll('#items-area [data-item]'));
      const index = fields.indexOf(el);
      const next = fields[index + 1];
      if (next) next.focus();
      return;
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (el.dataset.item === 'quantity' || el.dataset.item === 'price')) {
      e.preventDefault();
      const fields = Array.from(document.querySelectorAll('#items-area [data-item]'));
      const index = fields.indexOf(el);
      const targetIndex = e.key === 'ArrowUp' ? index - 3 : index + 3;
      const target = fields[targetIndex];
      if (target) target.focus();
      return;
    }
  }

  if (e.key === 'Enter' && isTextInput) {
    e.preventDefault();
  }
}