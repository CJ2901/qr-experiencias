/**
 * Que correo de pagador acepta TU cuenta. Resuelve el 403 "Payer email
 * forbidden" con datos, no con teorias.
 *
 *   node --env-file=.env scripts/probar-pago.mjs
 *
 * COMO FUNCIONA
 * Con credenciales de prueba se puede tokenizar una tarjeta desde el
 * servidor (POST /v1/card_tokens con la public key), asi que no hace
 * falta el navegador ni el Brick. El script crea UN token por intento
 * (son de un solo uso) y cobra S/ 89 con cada correo candidato.
 *
 * No mueve dinero real: el token es TEST-.
 *
 * QUE ESTAMOS SEPARANDO
 * Mercado Pago exige que pagador y cobrador sean de la MISMA naturaleza:
 * dos usuarios de prueba, o dos usuarios reales. Tu cuenta cobradora es
 * real (con credenciales de prueba), asi que un pagador @testuser.com es
 * una mezcla. Este script confirma o descarta esa regla probando ambos
 * tipos de correo de una sola pasada.
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

/* Tarjeta de prueba de Peru. APRO = el titular que MP aprueba. */
const TARJETA = {
  card_number: '5031755734530604',
  expiration_month: 11,
  expiration_year: 2030,
  security_code: '123',
  cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
};
const METODO = 'master';

async function tokenizar() {
  const r = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(PUBLIC_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TARJETA),
    }
  );
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.id) {
    console.error(rojo(`\nNo se pudo tokenizar la tarjeta (${r.status}).`));
    console.error(gris(JSON.stringify(b).slice(0, 400)));
    process.exit(1);
  }
  return b.id;
}

async function cobrarCon(email) {
  const token = await tokenizar();
  const r = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `probar-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    body: JSON.stringify({
      transaction_amount: 89,
      token,
      description: 'Prueba de correo de pagador',
      installments: 1,
      payment_method_id: METODO,
      payer: { email, identification: { type: 'DNI', number: '12345678' } },
    }),
  });
  const b = await r.json().catch(() => ({}));
  return { http: r.status, cuerpo: b };
}

/* ---------- candidatos ---------- */
const candidatos = [
  [PAYER_ENV, 'el de tu .env (usuario de prueba)'],
  ['test_user_no_existe_9988776655@testuser.com', 'usuario de prueba inventado'],
  ['comprador.prueba.qr@gmail.com', 'correo normal, ajeno a la cuenta'],
  ['christian.magallanes.j@gmail.com', 'tu correo de comprador real'],
].filter(([e]) => e);

console.log(`\n${negrita('Probando correos de pagador contra tu cuenta')}`);
console.log(gris('Tarjeta Mastercard de prueba · titular APRO · S/ 89.00\n'));

const resultados = [];
for (const [email, etiqueta] of candidatos) {
  const { http, cuerpo } = await cobrarCon(email);

  // OJO: en una respuesta de ERROR, `status` es el codigo HTTP (numero).
  // En una respuesta de PAGO, es el estado ("approved", "rejected"...).
  // Confundirlos fue lo que reventó la version anterior de este script.
  const esPago = typeof cuerpo.status === 'string';
  const estado = String(esPago ? cuerpo.status : (cuerpo.error ?? `HTTP ${http}`));

  const detalle =
    (esPago ? cuerpo.status_detail : null) ??
    (Array.isArray(cuerpo.cause) ? cuerpo.cause[0]?.description : null) ??
    cuerpo.message ??
    '';

  const ok = cuerpo.status === 'approved';
  const pinta = ok ? verde : http === 403 ? rojo : ambar;

  console.log(`${pinta(estado.padEnd(24))} ${email}`);
  console.log(gris(`${''.padEnd(24)} ${etiqueta}`));
  if (detalle) console.log(gris(`${''.padEnd(24)} ${detalle}`));
  if (cuerpo.id) console.log(gris(`${''.padEnd(24)} pago ${cuerpo.id}`));
  if (!ok) console.log(gris(`${''.padEnd(24)} crudo ${JSON.stringify(cuerpo).slice(0, 260)}`));
  console.log();

  resultados.push({ email, etiqueta, http, estado, detalle, ok });
}

/* ---------- veredicto ---------- */
console.log(negrita('Veredicto'));
const aprobados = resultados.filter((r) => r.ok);
const prohibidos = resultados.filter((r) => r.http === 403);

if (aprobados.length) {
  console.log(verde(`  Funciona con: ${aprobados.map((r) => r.email).join(', ')}`));
  console.log(`\n  Pon en tu .env:\n`);
  console.log(`    MP_TEST_PAYER_EMAIL=${aprobados[0].email}\n`);
} else if (prohibidos.length === resultados.length) {
  console.log(rojo('  TODOS los correos dan 403. El problema no es el correo:'));
  console.log('  es la aplicacion o la cuenta. Revisa en el panel que la');
  console.log('  aplicacion este creada para PAGOS ONLINE con Checkout API/');
  console.log('  Bricks y modelo "aggregator". Si no, crea una nueva.');
} else {
  console.log(ambar('  Ninguno aprobo, pero no todos dieron 403.'));
  console.log('  Mira el detalle de cada linea: si dice cc_rejected_*, la');
  console.log('  cuenta ya cobra bien y el problema es otro.');
}
console.log();
