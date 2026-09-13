/**
 * ¿Hace falta migrar a la Orders API, o /v1/payments ya cobra?
 *
 *   node --env-file=.env scripts/probar-pago-final.mjs
 *
 * POR QUE ESTA PREGUNTA SIGUE ABIERTA
 * En la corrida anterior /v1/payments con X-Test-Token dio 500, pero ese
 * intento tokenizaba TAMBIEN con la cabecera — y scripts/probar-orden-token
 * demostro que eso crea un token que la propia cuenta no puede leer (404),
 * o sea invalid_card_token. El 500 puede haber sido ese token roto y no el
 * endpoint.
 *
 * La combinacion buena nunca se probo contra /v1/payments:
 *
 *   tokenizar con la public key SIN cabecera  +  cobrar CON X-Test-Token
 *
 * Y es justo la forma del checkout real: el Payment Brick tokeniza en el
 * navegador con la public key y sin cabeceras raras, y el servidor cobra.
 * Si esto sale, no hay nada que migrar: lib/pagos/pasarela.ts ya manda la
 * cabecera y solo falta el .env.
 */

const TOKEN = process.env.MP_VENDEDOR_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.MP_VENDEDOR_PUBLIC_KEY;
const USUARIO_COMPRADOR = process.env.MP_COMPRADOR_USUARIO;

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const neg = (s) => `\x1b[1m${s}\x1b[0m`;

if (!TOKEN || !PUBLIC_KEY || !USUARIO_COMPRADOR) {
  console.error(rojo('\nFaltan MP_VENDEDOR_ACCESS_TOKEN, MP_VENDEDOR_PUBLIC_KEY o MP_COMPRADOR_USUARIO.\n'));
  process.exit(1);
}

const API = 'https://api.mercadopago.com';
const PAGADOR_EMAIL = `test_user_${String(USUARIO_COMPRADOR).replace(/\D/g, '')}@testuser.com`;
const clave = () => `pf-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function llamar(metodo, ruta, { bearer, cuerpo, pk, extra } = {}) {
  const url = pk ? `${API}${ruta}?public_key=${encodeURIComponent(pk)}` : `${API}${ruta}`;
  const headers = { 'Content-Type': 'application/json', ...(extra ?? {}) };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (metodo !== 'GET') headers['X-Idempotency-Key'] = clave();
  const r = await fetch(url, { method: metodo, headers, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) });
  const body = await r.json().catch(() => ({}));
  return { http: r.status, body, rid: r.headers.get('x-request-id') ?? '(sin header)' };
}

const TARJETA = {
  card_number: '5031755734530604',
  expiration_month: 11,
  expiration_year: 2030,
  security_code: '123',
  cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
};

/** Como tokeniza el Brick: public key, sin cabeceras. Nunca con X-Test-Token. */
async function tokenDelBrick() {
  const r = await llamar('POST', '/v1/card_tokens', { pk: PUBLIC_KEY, cuerpo: TARJETA });
  return r.body.id ?? null;
}

async function pagar(etiqueta, { testToken }) {
  const token = await tokenDelBrick();
  if (!token) { console.log(rojo(`   ${etiqueta}: no tokenizo\n`)); return null; }

  const r = await llamar('POST', '/v1/payments', {
    bearer: TOKEN,
    extra: testToken ? { 'X-Test-Token': 'true' } : undefined,
    cuerpo: {
      transaction_amount: 89,
      token,
      description: 'Experiencia QR · prueba final',
      installments: 1,
      payment_method_id: 'master',
      payer: {
        email: PAGADOR_EMAIL,
        first_name: 'Test',
        last_name: 'Comprador',
        identification: { type: 'DNI', number: '12345678' },
      },
    },
  });

  const ok = r.body.status === 'approved';
  const pinta = ok ? verde : r.http >= 500 ? rojo : ambar;
  console.log(`${pinta(String(r.http).padEnd(5))} ${etiqueta}`);
  console.log(gris(`      estado: ${r.body.status ?? '—'} / ${r.body.status_detail ?? '—'} · pago ${r.body.id ?? '—'}`));
  console.log(gris(`      x-request-id: ${r.rid}`));
  if (!ok) console.log(gris(`      ${JSON.stringify(r.body).slice(0, 300)}`));
  console.log();
  return r;
}

console.log(`\n${neg('¿/v1/payments cobra con el token bueno?')}`);
console.log(gris(`pagador ${PAGADOR_EMAIL} · Mastercard APRO · S/ 89.00\n`));

const conCabecera = await pagar('token del Brick  +  CON X-Test-Token', { testToken: true });
const sinCabecera = await pagar('token del Brick  +  sin cabecera (control)', { testToken: false });

console.log(neg('Veredicto'));
if (conCabecera?.body?.status === 'approved') {
  console.log(verde('  /v1/payments cobra. NO hay que migrar nada.'));
  console.log('  El 500 de antes era el token creado con la cabecera, no el endpoint.');
  console.log('  lib/pagos/pasarela.ts ya manda X-Test-Token cuando MP_MODO=prueba,');
  console.log('  asi que solo falta el .env:\n');
  console.log(`    MP_ACCESS_TOKEN=${TOKEN}`);
  console.log(`    NEXT_PUBLIC_MP_PUBLIC_KEY=${PUBLIC_KEY}`);
  console.log(`    MP_TEST_PAYER_EMAIL=${PAGADOR_EMAIL}`);
  console.log(`    MP_MODO=prueba`);
  console.log(gris('\n  Reinicia el dev server (el .env se lee al arrancar) y paga en'));
  console.log(gris('  /checkout/… con la Mastercard 5031 7557 3453 0604, titular APRO,'));
  console.log(gris('  cualquier fecha futura, CVV 123.'));
} else if (conCabecera?.http === 500) {
  console.log(ambar('  /v1/payments sigue en 500 con el token bueno.'));
  console.log('  Entonces si es el endpoint viejo. Toca migrar a la Orders API,');
  console.log('  que en scripts/probar-orden-token.mjs cobro processed/accredited.');
} else {
  console.log(ambar(`  HTTP ${conCabecera?.http}. Lee la causa arriba.`));
}
console.log();
