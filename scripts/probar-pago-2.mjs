/**
 * Diagnostico ampliado: por que POST /v1/payments da 500 "internal_error".
 *
 *   node --env-file=.env scripts/probar-pago-2.mjs
 *
 * Distinto de probar-pago.mjs en que:
 *  - confirma primero A QUE CUENTA pertenece el token que estas usando
 *    (por si el .env no quedo con las credenciales del vendedor de prueba
 *    nuevo, sino que sigue con las de la cuenta real);
 *  - prueba con Visa ademas de Mastercard, por si es la tarjeta;
 *  - prueba con y sin campos extra (capture, binary_mode,
 *    three_d_secure_mode, statement_descriptor) por si a la cuenta le
 *    falta un default que MP dejo de aplicar solo;
 *  - imprime el cuerpo COMPLETO y los headers de la respuesta (x-request-id
 *    en particular), que es lo que pide soporte de Mercado Pago si hay que
 *    escalar.
 */

const TOKEN = process.env.MP_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
const PAYER_ENV = process.env.MP_TEST_PAYER_EMAIL;

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const negrita = (s) => `\x1b[1m${s}\x1b[0m`;

if (!TOKEN || !PUBLIC_KEY) {
  console.error(rojo('\nFaltan MP_ACCESS_TOKEN o NEXT_PUBLIC_MP_PUBLIC_KEY.\n'));
  process.exit(1);
}
if (!TOKEN.startsWith('TEST-')) {
  console.error(rojo('\nEste script SOLO corre con credenciales de prueba. Aborto.\n'));
  process.exit(1);
}

/* ---------- 0 · a que cuenta pertenece este token ---------- */
console.log(`\n${negrita('0 · De quien es este token')}`);
const yo = await fetch('https://api.mercadopago.com/users/me', {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
console.log(`   id ${negrita(String(yo.id))} · site ${yo.site_id} · ${yo.email ?? '(sin email)'}`);
console.log(gris(`   nickname ${yo.nickname ?? '?'} · es vendedor de prueba: ${String(yo.nickname ?? '').startsWith('TESTUSER') ? 'SI' : 'NO / dudoso'}`));
console.log(gris(`   pagador que probaremos: ${PAYER_ENV ?? '(no seteado en .env)'}\n`));

/* ---------- tarjetas de prueba, Peru, seg. doc. oficial ---------- */
const TARJETAS = {
  mastercard_apro: {
    card_number: '5031755734530604',
    expiration_month: 11,
    expiration_year: 2030,
    security_code: '123',
    cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
    payment_method_id: 'master',
  },
  visa_apro: {
    card_number: '4009175332806176',
    expiration_month: 11,
    expiration_year: 2030,
    security_code: '123',
    cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
    payment_method_id: 'visa',
  },
};

async function tokenizar(tarjeta) {
  const { payment_method_id, ...body } = tarjeta;
  const r = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(PUBLIC_KEY)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.id) {
    console.log(rojo(`   no se pudo tokenizar: ${r.status} ${JSON.stringify(b).slice(0, 200)}`));
    return null;
  }
  return b.id;
}

async function intentar(etiqueta, tarjetaKey, extra) {
  const tarjeta = TARJETAS[tarjetaKey];
  const token = await tokenizar(tarjeta);
  if (!token) return;

  const cuerpo = {
    transaction_amount: 89,
    token,
    description: 'Diagnostico ampliado',
    installments: 1,
    payment_method_id: tarjeta.payment_method_id,
    payer: { email: PAYER_ENV, identification: { type: 'DNI', number: '12345678' } },
    ...extra,
  };

  const r = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `diag2-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    body: JSON.stringify(cuerpo),
  });
  const b = await r.json().catch(() => ({}));
  const requestId = r.headers.get('x-request-id') || r.headers.get('x-diagnostic-context') || '(sin header)';

  const ok = b.status === 'approved';
  const pinta = ok ? verde : r.status === 500 ? rojo : ambar;
  console.log(`${pinta(String(r.status).padEnd(5))} ${etiqueta}`);
  console.log(gris(`      x-request-id: ${requestId}`));
  console.log(gris(`      cuerpo: ${JSON.stringify(b)}`));
  console.log();
}

console.log(negrita('1 · Variaciones de tarjeta y de campos'));
await intentar('Mastercard APRO · payload minimo (igual al script anterior)', 'mastercard_apro', {});
await intentar('Visa APRO · payload minimo', 'visa_apro', {});
await intentar('Mastercard APRO · + capture/binary_mode/3ds/statement_descriptor', 'mastercard_apro', {
  capture: true,
  binary_mode: true,
  three_d_secure_mode: 'optional',
  statement_descriptor: 'EXPERIENCIAS QR',
});

console.log(negrita('Si TODO lo anterior dio 500:'));
console.log('  No es la tarjeta, ni los campos, ni el correo. Con el id de cuenta de');
console.log('  arriba y cualquiera de los x-request-id, esto ya es para soporte de');
console.log('  Mercado Pago (Desarrolladores > Soporte): "POST /v1/payments devuelve');
console.log('  500 internal_error con cause vacio, de forma consistente, para esta');
console.log('  aplicacion/cuenta de prueba" — con esa cuenta el problema esta de su lado.');
console.log();
