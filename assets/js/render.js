import { getState, startNewDraft, loadDraft, duplicateIntoDraft, setQuotes, existingNumbers } from './state.js';
import { CONFIG } from './config.js';
import { resolveNumberCollision, makeQuoteNumber, lineTotal, validateQuote, isItemComplete } from './quote.js';
import { formatMoney } from './formatters.js';
import {
  isAtLimit,
  saveQuotes,
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
import { printDialogMarkup, buildPrintSheet, documentTitleFor } from './ui/print-view.js';

const clone = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

let root = null;
let dialog = null;
let messageTimer = null;
let currentPrintQuote = null;

const VIEW_TITLES = {
  new: 'Nueva cotización · Cotizador Virtual',
  history: 'Historial · Cotizador Virtual'
};

export function init() {
  root = document.getElementById('app-main');
  dialog = document.getElementById('print-dialog');
  dialog.innerHTML = printDialogMarkup();
  dialog.addEventListener('cancel', closePrint);
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
    setQuotes(loadQuotes());
    root.innerHTML = historyMarkup();
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

function renderSidebar() {
  const slot = document.getElementById('sidebar-slot');
  slot.innerHTML = sidebarMarkup();
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
  const state = getState();
  const btnGenerate = document.getElementById('btn-generate');
  const btnOverwrite = document.getElementById('btn-overwrite');
  if (!btnGenerate || !btnOverwrite) return;
  const isNew = !state.editingNumber;
  const full = isAtLimit(state.quotes);
  if (isNew && full) {
    btnGenerate.disabled = true;
    btnOverwrite.hidden = false;
  } else {
    btnGenerate.disabled = false;
    btnOverwrite.hidden = true;
  }
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
  if (key === 'client' || key === 'discount') return document.getElementById(key);
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

function handleSaveQuote() {
  const state = getState();
  const errors = validateQuote(state.draft);
  if (Object.keys(errors).length) {
    highlightErrors(errors);
    showMessage('Revisá los campos marcados antes de guardar.', 'error');
    return;
  }

  const wasNew = !state.editingNumber;
  if (wasNew) {
    state.draft.number = resolveNumberCollision(state.draft.number || makeQuoteNumber(), existingNumbers());
  }
  const savedNumber = state.draft.number;
  pushQuote(state.quotes, clone(state.draft));

  if (!persist()) {
    showMessage('No se pudo guardar: almacenamiento lleno o bloqueado. Exportá un respaldo JSON.', 'error');
    return;
  }

  const fullAfter = isAtLimit(state.quotes);
  if (wasNew && !fullAfter) {
    startNewDraft();
  }

  render();

  if (wasNew && fullAfter) {
    showMessage(`Slot lleno (${CONFIG.QUOTE_LIMIT}): para crear otra cotización usá “Reemplazar cotización más antigua” o exportá un respaldo.`, 'warn');
  } else {
    showMessage(wasNew ? `Cotización guardada: ${savedNumber}.` : `Cambios guardados en ${savedNumber}.`, 'ok');
  }
}

function handleSaveOverwrite() {
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
  render();
  showMessage(`Se reemplazó ${oldest.number}. Nueva cotización: ${freshNumber}.`, 'ok');
}

function handleClearForm() {
  const { draft } = getState();
  const hasContent = Boolean(draft.client)
    || Boolean(draft.notes)
    || draft.items.some((i) => i.description || i.quantity !== '' || i.price !== '');
  if (hasContent && !window.confirm('¿Limpiar el formulario y empezar de nuevo?')) return;
  startNewDraft();
  render();
}

function findByNumber(number) {
  return getState().quotes.find((q) => q.number === number) || null;
}

function editQuote(number) {
  const quote = findByNumber(number);
  if (!quote) return;
  loadDraft(quote);
  getState().view = 'new';
  render();
}

function duplicateQuote(number) {
  const quote = findByNumber(number);
  if (!quote) return;
  duplicateIntoDraft(quote);
  getState().view = 'new';
  render();
  showMessage('Cotización duplicada. Guardala para asignar el nuevo número.', 'ok');
}

function deleteQuote(number) {
  const quote = findByNumber(number);
  if (!quote) return;
  if (!window.confirm(`¿Eliminar ${quote.number} (${quote.client})?\nEsta acción no se puede deshacer.`)) return;
  setQuotes(removeQuoteNumber(getState().quotes, number));
  persist();
  render();
  showMessage('Cotización eliminada.', 'ok');
}

function addItem() {
  const { draft } = getState();
  const last = draft.items[draft.items.length - 1];
  if (!isItemComplete(last)) return;
  draft.items.push({ description: '', quantity: '', price: '' });
  renderItems();
  renderTotals();
  updateAddButton();
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
}

function updateRowSubtotal(row, index) {
  const { draft } = getState();
  const el = row && row.querySelector('[data-item-subtotal]');
  if (el && draft.items[index]) {
    const item = draft.items[index];
    el.textContent = item.quantity === '' || item.price === '' ? '—' : formatMoney(lineTotal(item), draft.currency);
  }
}

/* ---------- Impresión ---------- */

function printQuote(quote) {
  if (!quote) return;
  currentPrintQuote = quote;
  const sheet = dialog.querySelector('#print-sheet');
  sheet.innerHTML = buildPrintSheet(quote);
  const shareBtn = dialog.querySelector('#btn-share');
  shareBtn.hidden = !navigator.share;
  document.title = documentTitleFor(quote);
  document.body.classList.add('print-mode');
  if (!dialog.open) dialog.showModal();
  const printBtn = dialog.querySelector('[data-action="print-do"]');
  if (printBtn) printBtn.focus();
}

function closePrint() {
  if (dialog.open) dialog.close();
  document.body.classList.remove('print-mode');
  const sheet = dialog.querySelector('#print-sheet');
  if (sheet) sheet.innerHTML = '';
  currentPrintQuote = null;
  setDocumentTitle(getState().view);
}

async function sharePrint() {
  const sheetText = dialog.querySelector('#print-sheet')?.textContent || '';
  if (!navigator.share) return;
  try {
    await navigator.share({
      title: document.title,
      text: `${document.title}\n${sheetText}`
    });
  } catch {
    /* el usuario canceló el share */
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
  const quotes = getState().quotes;
  downloadBlob(
    exportJSONString(quotes),
    `cotizaciones-respaldo-${new Date().toISOString().slice(0, 10)}.json`
  );
  showMessage(`Respaldo exportado (${quotes.length} cotizaciones).`, 'ok');
}

function handleImportFile(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  const resetInput = () => { inputEl.value = ''; };
  if (!file) return;

  const reader = new FileReader();
  reader.onerror = () => {
    showMessage('No se pudo leer el archivo.', 'error');
    resetInput();
  };
  reader.onload = () => {
    try {
      const quotes = parseJSON(String(reader.result));
      if (!window.confirm(`Se reemplazarán las ${getState().quotes.length} cotizaciones actuales por ${quotes.length} importadas. ¿Continuar?`)) return;
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

/* ---------- Eventos ---------- */

function onClick(e) {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  e.preventDefault();
  const action = actionEl.dataset.action;

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
    case 'clear-form':
      handleClearForm();
      break;
    case 'print-draft':
      printQuote(getState().draft);
      break;
    case 'edit-quote':
      editQuote(actionEl.dataset.number);
      break;
    case 'duplicate-quote':
      duplicateQuote(actionEl.dataset.number);
      break;
    case 'reprint-quote':
      printQuote(findInDatabase(actionEl.dataset.number));
      break;
    case 'delete-quote':
      deleteQuote(actionEl.dataset.number);
      break;
    case 'export-json':
      exportJSON();
      break;
    case 'print-do':
      if (currentPrintQuote) printQuote(currentPrintQuote);
      window.print();
      break;
    case 'print-cancel':
      closePrint();
      break;
    case 'print-share':
      sharePrint();
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

  el.parentElement?.querySelector('.field-error')?.remove();
  validateFieldVisual(el);

  if (el.name === 'client') {
    draft.client = el.value;
    return;
  }

  if (el.name === 'discount') {
    draft.discount = el.value;
    renderTotals();
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
  }
}

function onFormSubmit(e) {
  e.preventDefault();
}

function onKeydown(e) {
  const el = e.target;
  const isTextInput = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

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