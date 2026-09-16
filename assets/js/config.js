export const CONFIG = {
  QUOTE_LIMIT: 8,
  CURRENCIES: [
    { code: 'AR$', name: 'Peso Argentino', tax: 0.21 },
    { code: 'U$D', name: 'Dólar estadounidense', tax: 0 }
  ],
  DEFAULT_CURRENCY: 'AR$',
  VALIDITY_DAYS_DEFAULT: 30,
  SESSION_TTL_DAYS: 7,
  SESSION_TTL_MINUTES: null
};
// SESSION_TTL_MINUTES: 1