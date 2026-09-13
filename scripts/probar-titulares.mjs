/**
 * Que simula cada titular de tarjeta, y si tenemos mensaje para todos.
 *
 *   node --env-file=.env scripts/probar-titulares.mjs
 *
 * DOS PREGUNTAS EN UNA CORRIDA
 *
 * 1. El nombre del titular en las tarjetas de prueba de Mercado Pago no es
 *    un nombre: es la instruccion de que resultado simular. APRO aprueba,
 *    y hay una palabra por cada forma de fallar. Cualquier palabra fuera
 *    de la lista cae en el rechazo por defecto — por eso "no funcionaba"
 *    al poner un nombre real. Este script recorre la lista y anota que
 *    devuelve MP de verdad, en vez de fiarse de la documentacion.
 *
 * 2. Y lo que de verdad importa: cada `status_detail` que MP devuelva
 *    tiene que tener una frase en lib/pagos/mensajes.ts. Los que no la
 *    tienen caen en el texto generico ("no se completo y no se te cobro
 *    nada"), que es correcto pero no dice que hacer. Al final se listan
 *    los huecos.
 *
 * No mueve dinero: son ordenes de prueba contra el vendedor de prueba.
 */

import { readFileSync } from 'node:fs';

const TOKEN = process.env.MP_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
const PAGADOR_EMAIL = process.env.MP_TEST_PAYER_EMAIL;

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const neg = (s) => `\x1b[1m${s}\x1b[0m`;

if (!TOKEN || !PUBLIC_KEY || !PAGADOR_EMAIL) {
  console.error(rojo('\nFaltan MP_ACCESS_TOKEN, NEXT_PUBLIC_MP_PUBLIC_KEY o MP_TEST_PAYER_EMAIL.\n'));
  process.exit(1);
}

const API = 'https://api.mercadopago.com';
const clave = () => `tit-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function llamar(metodo, ruta, { bearer, cuerpo, pk } = {}) {
  const url = pk ? `${API}${ruta}?public_key=${encodeURIComponent(pk)}` : `${API}${ruta}`;
  const headers = { 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (metodo !== 'GET') headers['X-Idempotency-Key'] = clave();
  const r = await fetch(url, { method: metodo, headers, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) });
  return { http: r.status, body: await r.json().catch(() => ({})) };
}

/* Los titulares que documenta MP, mas dos controles: un nombre real y uno
   inventado, que es lo que hace cualquiera la primera vez. */
const TITULARES = [
  ['APRO', 'aprobado'],
  ['CONT', 'pendiente'],
  ['OTHE', 'rechazo general'],
  ['CALL', 'validación con el banco'],
  ['FUND', 'fondos insuficientes'],
  ['SECU', 'código de seguridad'],
  ['EXPI', 'fecha de vencimiento'],
  ['FORM', 'error de formulario'],
  ['CHRISTIAN MAGALLANES', gris('control · un nombre real')],
  ['JUAN PEREZ', gris('control · un nombre inventado')],
];

/* Y una comprobacion aparte: ¿el documento cambia algo, o da igual? */
const DOCUMENTOS = [
  ['12345678', 'el de la documentación'],
  ['87654321', 'otro DNI válido'],
  ['123', 'DNI demasiado corto'],
];

async function cobrar(titular, documento = '12345678') {
  const tok = await llamar('POST', '/v1/card_tokens', {
    pk: PUBLIC_KEY,
    cuerpo: {
      card_number: '5031755734530604',
      expiration_month: 11,
      expiration_year: 2030,
      security_code: '123',
      cardholder: { name: titular, identification: { type: 'DNI', number: documento } },
    },
  });
  if (!tok.body.id) {
    return { estado: `token ${tok.http}`, detalle: tok.body?.cause?.[0]?.description ?? tok.body.message ?? '' };
  }

  const r = await llamar('POST', '/v1/orders', {
    bearer: TOKEN,
    cuerpo: {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: '89.00',
      external_reference: `tit-${Date.now()}`,
      payer: { email: PAGADOR_EMAIL, identification: { type: 'DNI', number: documento } },
      transactions: {
        payments: [
          {
            amount: '89.00',
            payment_method: { id: 'master', type: 'credit_card', token: tok.body.id, installments: 1 },
          },
        ],
      },
    },
  });

  const d = r.body.data ?? r.body;
  const pago = d.transactions?.payments?.[0];
  return {
    estado: pago?.status ?? d.status ?? `http ${r.http}`,
    detalle:
      pago?.status_detail ??
      d.status_detail ??
      r.body.errors?.[0]?.details?.join(', ') ??
      r.body.errors?.[0]?.message ??
      '',
  };
}

const pinta = (e) => (e === 'processed' || e === 'approved' ? verde : e === 'pending' ? ambar : rojo);

console.log(`\n${neg('1 · Qué simula cada titular')}`);
console.log(gris('Mastercard 5031 7557 3453 0604 · S/ 89.00 · DNI 12345678\n'));

const detalles = new Set();
for (const [titular, que] of TITULARES) {
  const { estado, detalle } = await cobrar(titular);
  if (detalle) detalles.add(detalle);
  console.log(`  ${titular.padEnd(22)} ${pinta(estado)(estado.padEnd(11))} ${detalle}`);
  if (que) console.log(gris(`  ${''.padEnd(22)} ${que}`));
}

console.log(`\n${neg('2 · ¿El documento cambia algo? (titular APRO en los tres)')}\n`);
for (const [doc, que] of DOCUMENTOS) {
  const { estado, detalle } = await cobrar('APRO', doc);
  console.log(`  DNI ${doc.padEnd(18)} ${pinta(estado)(estado.padEnd(11))} ${detalle}`);
  console.log(gris(`  ${''.padEnd(22)} ${que}`));
}

/* ── 3 · huecos en los mensajes al comprador ─────────────────────────── */
console.log(`\n${neg('3 · ¿Tenemos una frase para cada motivo?')}\n`);
const fuente = readFileSync(new URL('../lib/pagos/mensajes.ts', import.meta.url), 'utf8');
const huecos = [...detalles].filter((d) => d && d !== 'accredited' && !fuente.includes(d)).sort();

if (!huecos.length) {
  console.log(verde('  Todos los motivos que devolvió MP tienen su mensaje. Nada que hacer.'));
} else {
  console.log(ambar('  Estos motivos caen en el texto genérico. Cada uno merece una'));
  console.log(ambar('  frase propia en lib/pagos/mensajes.ts que diga QUÉ HACER:\n'));
  huecos.forEach((d) => console.log(`    ${d}`));
}
console.log();
