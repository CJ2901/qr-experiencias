/**
 * ¿Hay alguna forma de cobrar con esta cuenta, o ninguna?
 *
 *   node --env-file=.env scripts/probar-orders.mjs
 *
 * QUE QUEDO PROBADO CON scripts/diagnostico-500.mjs (set. 2026)
 *   GET  /users/me ................................. 200
 *   GET  /v1/payment_methods ....................... 200
 *   POST /v1/card_tokens (public key y bearer) ..... 200, misma aplicacion
 *   POST /checkout/preferences ..................... 201
 *   POST /v1/payments · tarjeta .................... 500 internal_error
 *   POST /v1/payments · pagoefectivo_atm ........... 500 internal_error
 *
 * O sea: la cuenta lee, tokeniza y crea preferencias, pero NO crea pagos
 * de NINGUN tipo. El payload nunca fue el problema.
 *
 * Falta una sola pregunta antes de dar por muerta la cuenta: /v1/payments
 * es el endpoint viejo. Mercado Pago lo esta reemplazando por la Orders
 * API (POST /v1/orders), que es otro servicio con otro backend. Si las
 * ordenes SI se crean, la cuenta puede cobrar y lo unico roto es el
 * endpoint viejo — y entonces la solucion es migrar lib/pagos/pasarela.ts
 * a ordenes, no pelear con soporte.
 *
 * Si /v1/orders tambien da 500, ya no hay ruta de codigo: es la cuenta.
 */

const TOKEN = process.env.MP_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
const PAYER = process.env.MP_TEST_PAYER_EMAIL || 'comprador.prueba.qr@gmail.com';

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const neg = (s) => `\x1b[1m${s}\x1b[0m`;

if (!TOKEN || !PUBLIC_KEY) {
  console.error(rojo('\nFaltan MP_ACCESS_TOKEN o NEXT_PUBLIC_MP_PUBLIC_KEY en .env\n'));
  process.exit(1);
}

const API = 'https://api.mercadopago.com';
const clave = () => `orders-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function llamar(metodo, ruta, { bearer, cuerpo, pk } = {}) {
  const url = pk ? `${API}${ruta}?public_key=${encodeURIComponent(pk)}` : `${API}${ruta}`;
  const headers = { 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (metodo !== 'GET') headers['X-Idempotency-Key'] = clave();
  const r = await fetch(url, { method: metodo, headers, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) });
  const body = await r.json().catch(() => ({}));
  return { http: r.status, body, rid: r.headers.get('x-request-id') ?? '(sin header)' };
}

const pinta = (h) => (h >= 200 && h < 300 ? verde : h >= 500 ? rojo : ambar)(String(h).padEnd(5));

function linea(etiqueta, r) {
  console.log(`${pinta(r.http)} ${etiqueta}`);
  console.log(gris(`      x-request-id: ${r.rid}`));
  console.log(gris(`      ${JSON.stringify(r.body).slice(0, 500)}`));
  console.log();
}

const TARJETA = {
  card_number: '5031755734530604',
  expiration_month: 11,
  expiration_year: 2030,
  security_code: '123',
  cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
};

console.log(`\n${neg('Orders API — ¿esta cuenta puede cobrar por la vía nueva?')}\n`);

/* --- 1 · orden con tarjeta, cobro automatico --- */
const tok = await llamar('POST', '/v1/card_tokens', { pk: PUBLIC_KEY, cuerpo: TARJETA });
if (!tok.body.id) {
  linea('tokenizar', tok);
  process.exit(1);
}
console.log(gris(`   token: ${tok.body.id}\n`));

// La Orders API pide los importes como TEXTO ("89.00"), no como numero.
// Mandarlos numericos es un 400 con "invalid_parameter", no un 500.
const orden = await llamar('POST', '/v1/orders', {
  bearer: TOKEN,
  cuerpo: {
    type: 'online',
    processing_mode: 'automatic',
    total_amount: '89.00',
    external_reference: `diag-${Date.now()}`,
    payer: { email: PAYER, identification: { type: 'DNI', number: '12345678' } },
    transactions: {
      payments: [
        {
          amount: '89.00',
          payment_method: {
            id: 'master',
            type: 'credit_card',
            token: tok.body.id,
            installments: 1,
          },
        },
      ],
    },
  },
});
linea('POST /v1/orders · tarjeta, cobro automático', orden);

/* --- 2 · si fallo, ver si al menos la orden se CREA sin cobrar --- */
let creaOrden = orden.http >= 200 && orden.http < 300;
if (!creaOrden) {
  const tok2 = await llamar('POST', '/v1/card_tokens', { pk: PUBLIC_KEY, cuerpo: TARJETA });
  const manual = await llamar('POST', '/v1/orders', {
    bearer: TOKEN,
    cuerpo: {
      type: 'online',
      processing_mode: 'manual',
      total_amount: '89.00',
      external_reference: `diag-m-${Date.now()}`,
      payer: { email: PAYER },
      transactions: {
        payments: [
          {
            amount: '89.00',
            payment_method: { id: 'master', type: 'credit_card', token: tok2.body.id, installments: 1 },
          },
        ],
      },
    },
  });
  linea('POST /v1/orders · processing_mode manual (crear sin cobrar)', manual);
  creaOrden = manual.http >= 200 && manual.http < 300;
}

/* --- veredicto --- */
console.log(neg('Veredicto'));
if (creaOrden) {
  console.log(verde('  La cuenta SI cobra por la Orders API.'));
  console.log('  El roto es /v1/payments, el endpoint viejo. Se arregla en codigo:');
  console.log('  migrar lib/pagos/pasarela.ts a POST /v1/orders. Nada mas del');
  console.log('  proyecto cambia — cobrar.ts sigue hablando de OrdenDeCobro.');
} else {
  console.log(rojo('  Ni /v1/payments ni /v1/orders. Esta cuenta no puede cobrar.'));
  console.log('  Con esto el diagnostico esta cerrado y no queda nada que probar');
  console.log('  del lado del codigo. Quedan dos caminos, en este orden:');
  console.log('    A · vendedor de prueba  → scripts/probar-vendedor-prueba.mjs');
  console.log('    B · soporte de Mercado Pago, con los x-request-id de arriba');
  console.log('        y los de diagnostico-500.mjs.');
}
console.log();
