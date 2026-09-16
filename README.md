# Cotizador Virtual — Especificación técnica y plan de implementación

## 1. Visión general

Aplicación web moderna, nativa y ligera para crear, guardar y exportar cotizaciones profesionales desde el navegador, sin depender de un backend para el funcionamiento principal.

SPA construida con JavaScript nativo (ES Modules), HTML semántico y CSS moderno, con persistencia local, cálculo automático y exportación profesional mediante impresión.

Producto local-first orientado a uso individual o de pequeña empresa, con foco en:
- rapidez,
- experiencia visual sólida,
- cálculo automático,
- historial persistente,
- exportación profesional,
- despliegue simple.

---

## 2. Decisiones de arquitectura (v0.1)

### 2.1 Stack

- HTML5 semántico
- CSS moderno con variables, flex/grid, media queries
- JavaScript ES Modules (vanilla, sin frameworks)
- `localStorage` para persistencia
- Impresión con CSS (`print.css`) + `window.print()` para el PDF
- Despliegue en Vercel o GitHub Pages

### 2.2 Principios

- La app es una herramienta de trabajo diario: intuitiva, robusta frente a recarga, sin latencia innecesaria.
- Separación estricta de responsabilidades:
  - `quote.js`, `formatters.js` y `storage.js` **nunca tocan el DOM**.
  - `render.js` es la **única** capa de manipulación del DOM.
  - Este aislamiento permite migrar a un framework en la v0.2 reemplazando solo `render.js` y `ui/*`, sin reescribir modelo ni lógica de cálculo.

---

## 3. Alcance funcional (v0.1)

### 3.1 Emisor (datos de la empresa)

- **Fijo en un objeto JavaScript** (`assets/js/emisor.js`), no editable por el usuario.
- Incluye: nombre, RUC o documento, dirección, teléfono, correo y notas/pie de documento.
- Sin logo editable, sin módulo de configuración.

### 3.2 Cliente

- Texto libre al crear la cotización.
- Se usa el atributo HTML `autocomplete` para que el navegador recuerde lo ingresado.
- **No existe agenda ni base de datos de clientes.**

### 3.3 Cotización

- Número generado automáticamente (ver §6).
- Divisas: `AR$` y `U$D`.
- Estado único: `generado`.
- Items, descuento global, totales y notas.
- Fecha de validez (`validUntil`): obligatoria, elegida libremente por el emisor con un input de fecha. Precargada con la fecha actual; el guardado se bloquea mientras no se elija un día posterior a hoy.

### 3.4 Items

Cada item tiene:
- descripción,
- cantidad,
- precio unitario,
- subtotal por línea.

El descuento es **global**, no por item.

### 3.5 Cálculo

Ver §5. Cálculo canónico.

### 3.6 Historial

- Listado de cotizaciones guardadas (hasta el tope configurable).
- Vista previa (imprimir/exportar PDF) y eliminar.
- Límite configurable en JS (`QUOTE_LIMIT`, default 8).

### 3.7 Exportación

- Vista de impresión siempre en un `dialog` con formato A4.
- `window.print()`.
- Compartir desde dispositivo con Web Share API (solo móvil, opcional).

---

## 4. Fuera de alcance en v0.1

- Framework (React/Vue/Alpine) — se incorpora en v0.2.
- Configuración del emisor / logo.
- Agenda de clientes.
- Conversión o tasas de cambio.
- Múltiples empresas.
- Estados avanzados de cotización (borrador, enviada, aceptada, vencida).
- Backend, autenticación o sincronización.

---

## 5. Reglas de negocio

### 5.1 Cálculo canónico

```text
subtotal   = Σ (cantidad × precio)                por cada item
base       = subtotal × (1 − descuento/100)       descuento ∈ [0, 100], default 0
IVA        = base × 0.21                          solo si moneda = AR$
total      = base + IVA                           si U$D: total = base, sin línea de IVA
```

- Con descuento 0% el cálculo no se altera.
- Redondeo a 2 decimales al final, con redondeo financiero (`Math.round(total * 100) / 100`).

### 5.2 Divisas y formato numérico

| Moneda | IVA | Prefijo | Ejemplo |
|--------|-----|---------|---------|
| AR$ | 21% | `AR$` | `AR$ 1.500,50` |
| U$D | No | `U$D` | `U$D 1.500,50` |

- Formato numérico idéntico en ambas: miles con `.`, dos decimales con `,`.
- No existe conversión de moneda; solo se muestra el presupuesto en la moneda elegida.

### 5.3 Validaciones

- Cliente no vacío.
- Al menos un item con cantidad > 0 y precio ≥ 0.
- Descuento entre 0 y 100.
- Cantidades > 0.
- Precios ≥ 0.
- Fecha de validez obligatoria, válida (formato `YYYY-MM-DD`) y posterior a hoy (día futuro).

---

## 6. Numeración y nombres de archivo

```
fechaHora = YYYYMMDD-HHMMSS  (hora local)
numero    = COT-<fechaHora>
colisión en el mismo segundo → numero = COT-<fechaHora>-A, -B, …
nombreArchivo = título = `${numero} - ${nombreCliente}`
```

- El sufijo (`-A`, `-B`…) solo aparece si existe otra cotización con el mismo `fechaHora`.
- El nombre del cliente entra en el **nombre de archivo** y en `document.title`, no en el número.
- Esta numeración evita duplicados aunque se eliminen cotizaciones.

---

## 7. Persistencia y límite (localStorage)

### 7.1 Persistencia

- `localStorage`, sobrevive a la recarga (local-first).
- Guardado automático al guardar la cotización.
- Exportación/importación en JSON como respaldo (obligatoria por el límite de slots).

### 7.2 Política de desborde (`QUOTE_LIMIT`)

- `QUOTE_LIMIT` se define en `config.js` y es la única fuente de la restricción (hoy 8, mañana 100).
- Si se guardan `< LIMIT` cotizaciones → botón "Generar cotización" habilitado (crea una nueva).
- Si se guardan `== LIMIT` cotizaciones → botón principal deshabilitado y se habilita "Sobrescribir la más antigua", que pide confirmación al usuario antes de reemplazar la cotización más antigua.

---

## 8. Estructura del proyecto

```text
cotizador-virtual/
├── index.html
├── assets/
│   ├── css/
│   │   ├── variables.css      → tokens (colores, espacios, fuentes)
│   │   ├── styles.css         → app (shell, formulario, historial, dialog)
│   │   └── print.css          → vista de impresión A4
│   └── js/
│       ├── app.js             → entry point, init, router de vistas
│       ├── config.js          → QUOTE_LIMIT, monedas, IVA
│       ├── emisor.js          → objeto emisor fijo
│       ├── state.js           → estado global en memoria
│       ├── storage.js         → localStorage, límite, export/import JSON, numeración
│       ├── quote.js           → lógica pura: numeración, cálculo, validación (sin DOM)
│       ├── formatters.js      → formato monetario AR$/U$D, fechas
│       ├── render.js          → única capa de manipulación del DOM (aislada para v0.2)
│       └── ui/
│           ├── sidebar.js
│           ├── quote-form.js
│           ├── quote-table.js
│           ├── history-list.js
│           └── print-view.js  → dialog A4 de impresión
└── README.md
```

### 8.1 Configuración (`config.js`)

```js
export const CONFIG = {
  QUOTE_LIMIT: 8,
  CURRENCIES: [
    { code: 'AR$', name: 'Peso Argentino', tax: 0.21 },
    { code: 'U$D', name: 'Dólar', tax: 0 }
  ],
  DEFAULT_CURRENCY: 'AR$',
  VALIDITY_DAYS_DEFAULT: 30
};
```

---

## 9. Experiencia de usuario

### 9.1 Vistas

1. **Nueva cotización**: cliente (texto libre + autocomplete), selector AR$/U$D, tabla de items, descuento global %, fecha de validez (obligatoria), resumen de totales en vivo.
2. **Historial**: listado (hasta `QUOTE_LIMIT`) con acciones de vista previa (imprimir/exportar PDF) y eliminar.
3. **Impresión**: siempre un `dialog` con formato A4 y botón imprimir (`window.print()`), que usa `document.title` como nombre sugerido del PDF.

### 9.2 Requisitos de UX

- Recálculo inmediato al cambiar cantidades, precios o descuento.
- Validación visual en tiempo real.
- Foco por teclado en acciones clave.
- Respuesta móvil y contraste adecuado.

---

## 10. Fases de implementación y criterios de aceptación

### Fase 0 — Fundación
- `index.html`, CSS base (variables + shell), `config.js`, `emisor.js`, router de vistas (Nueva, Historial).
- ✔ App carga un shell navegable sin errores de consola.

### Fase 1 — Lógica pura (`quote.js`, `formatters.js`, `storage.js`, `state.js`)
- Numeración, cálculo, formato, persistencia y límite.
- ✔ Casos de cálculo (con/sin descuento, AR$ y U$D) verificados contra valores esperados; 0% no altera el total.

### Fase 2 — Formulario y recálculo en vivo
- Cliente, selector de moneda, fecha de validez, tabla de items (agregar/quitar), descuento global %.
- ✔ Al cambiar cantidad/precio/descuento el resumen se actualiza al instante.

### Fase 3 — Persistencia y desborde
- Guardado, carga al iniciar, límite configurable, botones generar/sobrescribir con confirmación, export/import JSON.
- ✔ Con `QUOTE_LIMIT` alcanzado, el botón principal se deshabilita y sobrescribir pide confirmación.

### Fase 4 — Historial
- Lista (hasta `QUOTE_LIMIT`), vista previa (imprimir/exportar PDF) y eliminar.
- ✔ Eliminar pide confirmación y la vista previa genera el documento A4.

### Fase 5 — Vista de impresión + `window.print()`
- `print.css` A4: encabezado emisor fijo, cliente, número, fecha de emisión y validez, items, totales, notas; `dialog` de impresión.
- ✔ La impresión/PDF muestra el documento con formato `AR$ 1.500,50` / `U$D 1.500,50` y la fecha de validez elegida.

### Fase 6 — Calidad
- Validaciones visuales, foco por teclado, responsive móvil, casos límite, `document.title` correcto en cada vista.

### Fase 7 — Despliegue
- GitHub Pages o Vercel, verificación en Chrome, Edge, Firefox y Safari modernos.

---

## 11. Criterios de aceptación generales

La v0.1 estará terminada cuando:
- se pueda crear una cotización desde cero (cliente + items),
- se calcule automáticamente subtotal, descuento, base, IVA (solo AR$) y total,
- se formateen los montos en AR$ y U$D según convención,
- se guarde en `localStorage` y se recupere tras recargar,
- se respete el límite configurable con política de sobrescritura con confirmación,
- se pueda exportar/importar el respaldo en JSON,
- el historial permita eliminar y generar la vista previa/impresión de cada cotización,
- la cotización incluya una fecha de vencimiento/validez obligatoria elegida por el emisor y visible en el documento,
- la impresión genere un PDF A4 profesional en un `dialog`,
- todo funcione sin backend,
- se despliegue correctamente en GitHub Pages o Vercel.

---

## 12. Roadmap

### v0.1 (este plan)
- Base funcional completa según las fases 0–7.

### v0.2 (mejoras futuras)
- Migración de la capa de UI a un framework (React/Vue/Alpine) aprovechando el aislamiento de `render.js`.
- Configuración editable del emisor y logo.
- Agenda de clientes.
- Estados avanzados de cotización.
- Múltiples monedas con tasas de cambio.
- Backend, autenticación y sincronización multiusuario.
- Plantillas de cotización y firma digital.

---

## 13. Seguridad y uso local

- Prioridad: evitar pérdida de datos mediante exportación de respaldo JSON.
- Información sensible solo en el cliente; no se recomienda almacenar datos críticos sin estrategia de copias de seguridad.
- No depende de almacenamiento externo.