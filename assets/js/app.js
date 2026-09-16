import { startNewDraft } from './state.js';
import { init as initRender, openLoginDialog, startSessionWatch, unlockApp } from './render.js';
import { hasValidSession } from './auth.js';

function init() {
  startNewDraft();
  initRender();
  startSessionWatch();
  if (hasValidSession()) {
    unlockApp();
  } else {
    openLoginDialog();
  }
}

init();