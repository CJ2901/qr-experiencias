/**
 * Cruza TUS pedidos con lo que Mercado Pago dice de cada pago.
 *
 *   node --env-file=.env scripts/pagos.mjs
 *
 * Consulta cada pago POR ID, tomando los ids de tu propia tabla `pedidos`.
 * Es mas fiable que /v1/payments/search, que con credenciales de prueba
 * suele devolver vacio aunque los pagos existan.
 *
 * Si un pago responde 404, casi siempre significa que se creo con OTRAS
 * credenciales (produccion) y ahora estas consultando con las de prueba:
 * cada ambiente solo ve sus propios pagos.
 */

import { createClient } from '@supabase/supabase-js';

const TOKEN = process.env.MP_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? '';

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const negrita = (s) => `\x1b[1m${s}\x1b[0m`;

if (!TOKEN || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(rojo('\nFaltan variables. Corre:  node --env-file=.env scripts/pagos.mjs\n'));
  process.exit(1);
}

/* ---------- 1 · ambiente ---------- */
const tokenPrueba = TOKEN.startsWith('TEST-');
const keyPrueba = PUBLIC_KEY.startsWith('TEST-');

console.log(`\n${negrita('Credenciales')}`);
console.log(`  access token   ${tokenPrueba ? verde('PRUEBA') : ambar('PRODUCCION')}`);
console.log(`  public key     ${keyPrueba ? verde('PRUEBA') : ambar('PRODUCCION')}`);
if (tokenPrueba !== keyPrueba) {
  console.log(rojo('  ¡MEZCLADAS! Las dos tienen que ser del mismo ambiente.'));
}

/* ---------- 2 · los pedidos que tienen pago ---------- */
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: pedidos, error } = await sb
  .from('pedidos')
  .select('id, ocasion, slug, estado, mp_payment_id, mp_status, precio_centavos, creado_en')
  .not('mp_payment_id', 'is', null)
  .order('creado_en', { ascending: false })
  .limit(20);

if (error) {
  console.error(rojo('\nNo pude leer la tabla pedidos: ' + error.message + '\n'));
  process.exit(1);
}
if (!pedidos.length) {
  console.log('\nNingun pedido tiene mp_payment_id. Todavia no se cobro nada.\n');
  process.exit(0);
}

/* ---------- 3 · que dice Mercado Pago de cada uno ---------- */
const PISTAS = {
  accredited: 'Aprobado y acreditado. Todo bien.',
  pending_contingency:
    'MP lo mando a revision. En PRUEBA pasa cuando el titular NO fue APRO.',
  pending_review_manual: 'Revision manual de MP. Puede tardar dias; no se desbloquea solo.',
  pending_waiting_transfer: 'Esperando que el pagador complete la transferencia.',
  pending_waiting_payment: 'Esperando pago en efectivo o cupon.',
  cc_rejected_other_reason: 'Rechazo generico. Titular OTHE en pruebas.',
  cc_rejected_insufficient_amount: 'Fondos insuficientes. Titular FUND.',
  cc_rejected_bad_filled_security_code: 'CVV invalido. Titular SECU.',
  cc_rejected_call_for_authorize: 'Requiere autorizacion del banco. Titular CALL.',
};

const color = (s) => (s === 'approved' ? verde(s) : s === 'rejected' ? rojo(s) : ambar(s));

console.log(`\n${negrita(`${pedidos.length} pedidos con pago`)}\n`);

let huerfanos = 0;

for (const p of pedidos) {
  const fecha = new Date(p.creado_en).toLocaleString('es-PE');
  console.log(`  ${negrita(`/${p.ocasion}/${p.slug}`)}  ${gris(fecha)}`);
  console.log(`  ${gris('pago mp:')} ${p.mp_payment_id}   ${gris('en tu base:')} ${p.estado} / ${p.mp_status ?? '—'}`);

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${p.mp_payment_id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (r.status === 404) {
    huerfanos++;
    console.log(rojo('  MP no conoce este pago con las credenciales actuales.'));
    console.log(gris('     Se creo con las del OTRO ambiente. Cada ambiente ve solo lo suyo.'));
    console.log();
    continue;
  }
  if (!r.ok) {
    console.log(rojo(`  MP respondio ${r.status}`));
    console.log(gris('     ' + (await r.text()).slice(0, 200)));
    console.log();
    continue;
  }

  const pago = await r.json();
  console.log(`  ${gris('en mp:')}   ${color(pago.status)}  ·  ${pago.status_detail}`);
  console.log(`  ${gris('monto:')}   S/ ${pago.transaction_amount}`);

  // El pagador es la causa mas frecuente de pending_contingency en pruebas:
  // no se puede pagar con el correo dueno de la aplicacion.
  const correo = pago.payer?.email ?? '(vacio)';
  const esDelDuenoDeLaApp = correo && !/@testuser\.com$/i.test(correo);
  console.log(
    `  ${gris('pagador:')} ${correo}` +
      (esDelDuenoDeLaApp
        ? rojo('  <- no es un usuario de prueba; MP no aprueba pagos a uno mismo')
        : verde('  (usuario de prueba)'))
  );

  if (!pago.card?.cardholder?.name) {
    console.log(`  ${gris('titular:')} ${rojo('(vacio)')} ${gris('MP no recibio el nombre del titular')}`);
  }
  if (pago.card?.cardholder?.name) {
    const titular = pago.card.cardholder.name;
    const esCodigo = /^(APRO|CONT|OTHE|CALL|FUND|SECU|EXPI|FORM|CARD|INST|DUPL|LOCK|BLAC)$/i.test(titular.trim());
    console.log(
      `  ${gris('titular:')} ${titular}${esCodigo ? verde('  (codigo de prueba)') : rojo('  <- no es un codigo; por eso no se aprueba')}`
    );
  }
  if (PISTAS[pago.status_detail]) console.log(`  ${gris('->')} ${PISTAS[pago.status_detail]}`);
  console.log();
}

console.log(negrita('Si sigues viendo pending_contingency'));
console.log('  1. El titular de la tarjeta debe ser exactamente  ' + negrita('APRO'));
console.log('  2. El pagador debe ser un usuario de prueba, no tu correo:');
console.log(gris('     panel > Pruebas > Cuentas de prueba > crear cuenta compradora'));
console.log(gris('     y pon ese correo en MP_TEST_PAYER_EMAIL dentro de .env\n'));

if (huerfanos) {
  console.log(ambar(`${huerfanos} pago(s) creados con credenciales de otro ambiente.`));
  console.log('Esos pedidos no se van a poder desbloquear con las credenciales de ahora.');
  console.log(gris('Descartalos y empieza de cero con las de prueba en ambas variables.\n'));
}
