import { EMISOR } from './emisor.js';
import { CONFIG } from './config.js';

const SESSION_KEY = 'cotizador-v0.1:session';
const ATTEMPTS_KEY = 'cotizador-v0.1:auth-attempts';
const CIPHER_KEY = 'cotizador-v0.1';
const MAX_AUTH_ATTEMPTS = 3;

let memorySession = null;
let memoryAttempts = 0;
let memoryLocked = false;

export async function hashText(text) {
  if (!crypto?.subtle) {
    throw new Error('Tu navegador no admite cifrado seguro (crypto.subtle).');
  }
  const data = new TextEncoder().encode(String(text));
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function matchesSecret(input) {
  const a = await hashText(String(input || '').trim());
  const b = await hashText(String(EMISOR.activationCode || '').trim());
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function xorText(str) {
  let out = '';
  for (let i = 0; i < str.length; i += 1) {
    out += String.fromCharCode(str.charCodeAt(i) ^ CIPHER_KEY.charCodeAt(i % CIPHER_KEY.length));
  }
  return out;
}

function encodeRecord(record) {
  return btoa(xorText(JSON.stringify(record)));
}

function decodeRecord(raw) {
  return JSON.parse(xorText(atob(String(raw))));
}

export async function authenticate(email, code) {
  const emailOk = String(email || '').trim().toLowerCase() === EMISOR.email.trim().toLowerCase();
  const codeOk = String(code || '').trim() !== '' && await matchesSecret(code);
  return emailOk && codeOk;
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function saveSession(email) {
  const now = Date.now();
  const ttlMs = CONFIG.SESSION_TTL_MINUTES
    ? CONFIG.SESSION_TTL_MINUTES * 60 * 1000
    : CONFIG.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  const record = {
    v: 2,
    email: String(email).trim().toLowerCase(),
    loggedInAt: now,
    expiresAt: now + ttlMs,
    codeFingerprint: encodeRecord({ code: String(EMISOR.activationCode || '').trim() })
  };
  memorySession = record;
  const persistent = writeStorage(SESSION_KEY, encodeRecord(record));
  return { ok: true, persistent };
}

export function loadSession() {
  try {
    const raw = readStorage(SESSION_KEY);
    if (!raw) return memorySession;
    const record = decodeRecord(raw);
    if (!record || typeof record !== 'object' || record.v !== 2) return null;
    if (typeof record.email !== 'string' || !Number.isFinite(record.expiresAt)) return null;
    return record;
  } catch {
    return memorySession;
  }
}

export function clearSession() {
  memorySession = null;
  try {
    localStorage.removeItem(SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}

function loadAttempts() {
  const raw = readStorage(ATTEMPTS_KEY);
  if (!raw) return { failed: memoryAttempts, locked: memoryLocked };
  try {
    const record = JSON.parse(raw);
    if (!record || !Number.isInteger(record.failed) || record.failed < 0) {
      return { failed: 0, locked: false };
    }
    return { failed: record.failed, locked: record.locked === true };
  } catch {
    return { failed: memoryAttempts, locked: memoryLocked };
  }
}

function saveAttempts(failed, locked) {
  memoryAttempts = failed;
  memoryLocked = locked;
  writeStorage(ATTEMPTS_KEY, JSON.stringify({ failed, locked }));
}

export function authAttemptStatus() {
  const { failed, locked } = loadAttempts();
  return { failed, remaining: Math.max(0, MAX_AUTH_ATTEMPTS - failed), locked };
}

export function registerFailedAttempt() {
  const status = authAttemptStatus();
  const failed = Math.min(MAX_AUTH_ATTEMPTS, status.failed + 1);
  const locked = failed >= MAX_AUTH_ATTEMPTS;
  saveAttempts(failed, locked);
  return { failed, remaining: MAX_AUTH_ATTEMPTS - failed, locked };
}

export function resetAuthAttempts() {
  saveAttempts(0, false);
}

export function isAccountLocked() {
  return authAttemptStatus().locked;
}

export function hasValidSession() {
  const record = loadSession();
  if (!record) return false;
  if (record.email !== EMISOR.email.trim().toLowerCase()) return false;
  const expected = encodeRecord({ code: String(EMISOR.activationCode || '').trim() });
  if (record.codeFingerprint !== expected) return false;
  return Number(record.expiresAt) > Date.now();
}

export function sessionExpiry() {
  const record = loadSession();
  return record && Number.isFinite(record.expiresAt) ? Number(record.expiresAt) : null;
}