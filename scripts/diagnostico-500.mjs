/**
 * Por que POST /v1/payments devuelve 500 "internal_error".
 *
 *   node --env-file=.env scripts/diagnostico-500.mjs
 *
 * Los scripts anteriores probaron variaciones del PAYLOAD (tarjeta, correo,
 * campos extra) y todas dieron 500. Eso ya descarta el payload. Este script
 * no vuelve a tocarlo: separa las cuatro cosas que quedan, en orden, y cada
 * paso responde una pregunta de si/no.
 *
 *   1  la public key y el access token, son de la MISMA aplicacion?
 *   2  esta cuenta puede POSTear algo, o solo leer?
 *   3  falla crear CUALQUIER pago, o solo los de tarjeta?
 *   4  con un token tokenizado por el propio access token, tambien falla?
 *
 * El paso 4 es el decisivo. Si ahi el pago SI sale y en el paso 5 (que
 * tokeniza con la public key, igual que el Brick) sale 500, la causa es
 * que NEXT_PUBLIC_MP_PUBLIC_KEY pertenece a otra aplicacion que
 * MP_ACCESS_TOKEN, y se arregla copiando las dos credenciales de la MISMA
 * pantalla de "Credenciales de prueba".
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
if (!TOKEN.startsWith('TEST-')) {
  console.error(rojo('\nSolo con credenciales de prueba. Aborto.\n'));
  process.exit(1);
}

const API = 'https://api.mercadopago.com';
const uuid = () => `d500-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Una sola forma de llamar a MP, para que todo se imprima igual. */
async function llamar(metodo, ruta, { bearer, cuerpo, pk } = {}) {
  const url = pk ? `${API}${ruta}?public_key=${encodeURIComponent(pk)}` : `${API}${ruta}`;
  const headers = { 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (metodo !== 'GET') headers['X-Idempotency-Key'] = uuid();

  const r = await fetch(url, {
    method: metodo,
    headers,
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const body = await r.json().catch(() => ({}));
  return { http: r.status, body, rid: r.headers.get('x-request-id') ?? '(sin header)' };
}

function pinta(http) {
  if (http >= 200 && http < 300) return verde(String(http).padEnd(5));
  if (http >= 500) return rojo(String(http).padEnd(5));
  return ambar(String(http).padEnd(5));
}

function linea(etiqueta, r, { corto = false } = {}) {
  console.log(`${pinta(r.http)} ${etiqueta}`);
  console.log(gris(`      x-request-id: ${r.rid}`));
  console.log(gris(`      ${JSON.stringify(r.body).slice(0, corto ? 200 : 420)}`));
  console.log();
}

/* ---------- tarjeta de prueba oficial de Peru ---------- */
const TARJETA = {
  card_number: '5031755734530604',
  expiration_month: 11,
  expiration_year: 2030,
  security_code: '123',
  cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
};
const METODO = 'master';

const PAGADOR = {
  email: PAYER,
  first_name: 'Test',
  last_name: 'Comprador',
  identification: { type: 'DNI', number: '12345678' },
};

const veredicto = {};

/* ═════════════════════════ 0 · quien es esta cuenta ═════════════════════ */
console.log(`\n${neg('0 · Identidad de las credenciales')}`);

const yo = await llamar('GET', '/users/me', { bearer: TOKEN });
const u = yo.body;
// El access token termina en el id del usuario dueno: TEST-<app>-<fecha>-<hash>-<userId>
const idEnToken = TOKEN.split('-').pop();
const esUsuarioDePrueba = String(u.nickname ?? '').startsWith('TEST');

console.log(`   id ${neg(String(u.id))} · site ${u.site_id} · ${u.email ?? '(sin email)'}`);
console.log(gris(`   nickname ${u.nickname ?? '?'} · tags ${JSON.stringify(u.tags ?? [])}`));
console.log(gris(`   id al final del access token: ${idEnToken} ${String(u.id) === idEnToken ? '(coincide)' : rojo('(NO coincide)')}`));
console.log(
  `   vendedor de prueba (@testuser): ${esUsuarioDePrueba ? verde('SI') : ambar('NO — es una cuenta real con credenciales TEST-')}`
);
console.log(gris(`   pagador de las pruebas: ${PAYER}`));
console.log();
veredicto.vendedorDePrueba = esUsuarioDePrueba;

/* ═══════ 1 · la public key, es de la misma aplicacion que el token? ══════ */
console.log(neg('1 · La public key y el access token, ¿son de la misma aplicación?'));

const tokPk = await llamar('POST', '/v1/card_tokens', { pk: PUBLIC_KEY, cuerpo: TARJETA });
if (tokPk.http >= 300 || !tokPk.body.id) {
  linea('tokenizar con la public key', tokPk);
  console.log(rojo('   La public key ni siquiera tokeniza. Ese es el primer problema.\n'));
  process.exit(1);
}
console.log(gris(`   token creado con la public key: ${tokPk.body.id}`));

// Un card_token solo se puede leer con las credenciales de SU aplicacion.
// Si el access token no lo ve, es que la public key es de otra aplicacion.
const leer = await llamar('GET', `/v1/card_tokens/${tokPk.body.id}`, { bearer: TOKEN });
const mismaApp = leer.http >= 200 && leer.http < 300;
console.log(
  `   leerlo con el access token: ${pinta(leer.http).trim()} → ${
    mismaApp ? verde('MISMA aplicación') : rojo('APLICACIONES DISTINTAS')
  }`
);
console.log(gris(`      ${JSON.stringify(leer.body).slice(0, 240)}`));
console.log();
veredicto.mismaApp = mismaApp;

/* ═══════════════ 2 · esta cuenta puede POSTear algo? ════════════════════ */
console.log(neg('2 · ¿Esta cuenta puede crear algo, o solo leer?'));
const pref = await llamar('POST', '/checkout/preferences', {
  bearer: TOKEN,
  cuerpo: { items: [{ title: 'Diagnostico', quantity: 1, unit_price: 89, currency_id: 'PEN' }] },
});
linea('POST /checkout/preferences (una preferencia vacía)', pref, { corto: true });
veredicto.puedePostear = pref.http >= 200 && pref.http < 300;

/* ══════════ 3 · falla crear cualquier pago, o solo los de tarjeta? ══════ */
console.log(neg('3 · ¿Falla crear CUALQUIER pago, o solo los de tarjeta?'));
const efectivo = await llamar('POST', '/v1/payments', {
  bearer: TOKEN,
  cuerpo: {
    transaction_amount: 89,
    description: 'Diagnostico sin tarjeta',
    payment_method_id: 'pagoefectivo_atm',
    payer: PAGADOR,
  },
});
linea('POST /v1/payments · pagoefectivo_atm (sin token de tarjeta)', efectivo);
veredicto.pagoSinTarjeta = efectivo.http >= 200 && efectivo.http < 300;

/* ══════ 4 · pago con un token tokenizado por el PROPIO access token ═════ */
console.log(neg('4 · Pago con un token tokenizado por el propio access token'));
const tokBearer = await llamar('POST', '/v1/card_tokens', { bearer: TOKEN, cuerpo: TARJETA });
if (tokBearer.http >= 300 || !tokBearer.body.id) {
  linea('tokenizar con el access token', tokBearer);
  veredicto.pagoConTokenPropio = false;
} else {
  console.log(gris(`   token: ${tokBearer.body.id}`));
  const pago = await llamar('POST', '/v1/payments', {
    bearer: TOKEN,
    cuerpo: {
      transaction_amount: 89,
      token: tokBearer.body.id,
      description: 'Diagnostico token propio',
      installments: 1,
      payment_method_id: METODO,
      payer: PAGADOR,
    },
  });
  linea('POST /v1/payments · token del access token', pago);
  veredicto.pagoConTokenPropio = pago.http >= 200 && pago.http < 300;
  veredicto.estadoTokenPropio = pago.body.status ?? null;
}

/* ═════ 5 · pago con un token de la public key (lo que hace el Brick) ════ */
console.log(neg('5 · Pago con un token de la public key (el camino real del Brick)'));
const tokPk2 = await llamar('POST', '/v1/card_tokens', { pk: PUBLIC_KEY, cuerpo: TARJETA });
if (tokPk2.body.id) {
  const pago = await llamar('POST', '/v1/payments', {
    bearer: TOKEN,
    cuerpo: {
      transaction_amount: 89,
      token: tokPk2.body.id,
      description: 'Diagnostico token public key',
      installments: 1,
      payment_method_id: METODO,
      payer: PAGADOR,
    },
  });
  linea('POST /v1/payments · token de la public key', pago);
  veredicto.pagoConTokenPk = pago.http >= 200 && pago.http < 300;
  veredicto.estadoTokenPk = pago.body.status ?? null;
}

/* ══════════════════════════════ veredicto ══════════════════════════════ */
console.log(neg('Veredicto'));

if (!veredicto.mismaApp) {
  console.log(rojo('  La public key y el access token son de aplicaciones distintas.'));
  console.log('  Esa es la causa mas probable del 500: MP recibe un token de');
  console.log('  tarjeta que no pertenece a la aplicacion que intenta cobrar.');
  console.log(neg('\n  Que hacer:'));
  console.log('  Panel de Mercado Pago → Tus integraciones → ABRE UNA SOLA');
  console.log('  aplicacion → Credenciales de prueba. Copia de ESA misma');
  console.log('  pantalla las dos: Public Key y Access Token. Vuelve a correr');
  console.log('  este script: el paso 1 tiene que decir "MISMA aplicación".');
} else if (veredicto.pagoConTokenPropio && !veredicto.pagoConTokenPk) {
  console.log(ambar('  Con un token tokenizado por el access token el pago SI sale;'));
  console.log('  con el de la public key, no. Aunque las dos credenciales digan');
  console.log('  ser de la misma app, la public key es la que esta mal. Copiala');
  console.log('  de nuevo desde Credenciales de prueba.');
} else if (veredicto.pagoConTokenPropio) {
  console.log(verde(`  El pago SI se crea (estado: ${veredicto.estadoTokenPropio}).`));
  console.log('  El 500 no estaba en la cuenta. Corre de nuevo el checkout real.');
} else if (veredicto.pagoSinTarjeta) {
  console.log(ambar('  Los pagos sin tarjeta SI se crean; los de tarjeta no.'));
  console.log('  El problema esta en el procesamiento de tarjeta de esta cuenta,');
  console.log('  no en tu payload. Escala a soporte con los x-request-id de arriba.');
} else if (veredicto.puedePostear) {
  console.log(rojo('  La cuenta crea preferencias pero NO crea pagos, de ningun tipo.'));
  console.log('  Eso es Checkout API no habilitado o la cuenta sin activar como');
  console.log('  cobrador en MPE. No es codigo.');
  if (!veredicto.vendedorDePrueba) {
    console.log(neg('\n  Antes de escalar, prueba la ruta A:'));
    console.log('  usar las credenciales del VENDEDOR de prueba (nickname TESTUSER…)');
    console.log('  en vez de las de la cuenta real. El paso 0 de este script te dice');
    console.log('  si el token ya es el correcto.');
  }
} else {
  console.log(rojo('  Ni siquiera se pueden crear preferencias. Es la cuenta o la'));
  console.log('  aplicacion, no el codigo. A soporte con los x-request-id.');
}
console.log();
