/**
 * invalid_card_token: ¿como hay que tokenizar en el sandbox de MP?
 *
 *   node --env-file=.env scripts/probar-orden-token.mjs
 *
 * DONDE ESTAMOS (set. 2026)
 * Con las credenciales APP_USR- del vendedor de prueba y la cabecera
 * X-Test-Token: true, POST /v1/orders CREA la orden — el id vuelve como
 * ORDTST…, o sea que MP la reconoce como de prueba y la cuenta si puede
 * cobrar. Lo unico que falla es el cobro dentro de la orden:
 *
 *   402 · "The following transactions failed"
 *         PAY01…: invalid_card_token
 *
 * Y muy probablemente ESE es el 500 de /v1/payments: el endpoint viejo
 * devuelve internal_error donde el nuevo dice invalid_card_token.
 *
 * QUE SEPARA ESTE SCRIPT
 * Queda una sola variable: como se crea el token de tarjeta. Hay dos ejes
 * —con public key o con el access token, y con o sin X-Test-Token— y hasta
 * ahora se probo una sola casilla. Aqui se prueban las cinco que tienen
 * sentido, todas contra /v1/orders, que es el unico endpoint que esta
 * dando causas legibles. De cada token se imprime ademas su `status` y si
 * el access token puede leerlo: un token que la propia cuenta no ve es un
 * token de otro ambiente.
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
const clave = () => `ot-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

const TEST = { 'X-Test-Token': 'true' };

/** Las cinco casillas que tienen sentido probar. */
const CASOS = [
  { nombre: 'public key · sin cabecera  →  orden CON cabecera', pk: true, tokTest: false, ordTest: true },
  { nombre: 'public key · CON cabecera  →  orden CON cabecera', pk: true, tokTest: true, ordTest: true },
  { nombre: 'public key · sin cabecera  →  orden sin cabecera', pk: true, tokTest: false, ordTest: false },
  { nombre: 'access token · sin cabecera →  orden CON cabecera', pk: false, tokTest: false, ordTest: true },
  { nombre: 'access token · CON cabecera →  orden CON cabecera', pk: false, tokTest: true, ordTest: true },
];

console.log(`\n${neg('Matriz de tokenización contra /v1/orders')}`);
console.log(gris(`pagador ${PAGADOR_EMAIL} · tarjeta Mastercard APRO · S/ 89.00\n`));

let ganador = null;

for (const caso of CASOS) {
  console.log(neg(`· ${caso.nombre}`));

  const tok = await llamar('POST', '/v1/card_tokens', {
    ...(caso.pk ? { pk: PUBLIC_KEY } : { bearer: TOKEN }),
    cuerpo: TARJETA,
    extra: caso.tokTest ? TEST : undefined,
  });

  if (!tok.body.id) {
    console.log(rojo(`   token: ${tok.http} · ${JSON.stringify(tok.body).slice(0, 180)}\n`));
    continue;
  }

  // Un token que la propia cuenta no puede leer es de otro ambiente.
  const leer = await llamar('GET', `/v1/card_tokens/${tok.body.id}`, { bearer: TOKEN });
  console.log(
    gris(`   token ${tok.body.id} · status ${tok.body.status ?? '?'} · lo lee la cuenta: ${leer.http}`)
  );

  const orden = await llamar('POST', '/v1/orders', {
    bearer: TOKEN,
    extra: caso.ordTest ? TEST : undefined,
    cuerpo: {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: '89.00',
      external_reference: `ot-${Date.now()}`,
      payer: {
        email: PAGADOR_EMAIL,
        first_name: 'Test',
        last_name: 'Comprador',
        identification: { type: 'DNI', number: '12345678' },
      },
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

  const d = orden.body.data ?? orden.body;
  const estado = d.status ?? '(sin estado)';
  const detalle =
    orden.body.errors?.[0]?.details?.join(', ') ??
    orden.body.errors?.[0]?.message ??
    d.status_detail ??
    '';
  const ok = estado === 'processed' || estado === 'authorized';
  const pinta = ok ? verde : orden.http >= 500 ? rojo : ambar;

  console.log(`   ${pinta(String(orden.http).padEnd(4))} orden ${d.id ?? '—'} · ${estado}`);
  if (detalle) console.log(gris(`        ${detalle}`));
  console.log(gris(`        x-request-id: ${orden.rid}`));
  console.log();

  if (ok && !ganador) ganador = caso;
}

console.log(neg('Veredicto'));
if (ganador) {
  console.log(verde(`  Funciona: ${ganador.nombre}`));
  console.log('\n  Con eso ya se puede migrar lib/pagos/pasarela.ts a la Orders API');
  console.log('  y el checkout queda cobrando. Pasame esta salida.');
} else {
  console.log(ambar('  Ninguna casilla proceso el pago. Mira los detalles de arriba:'));
  console.log('  si TODAS dicen invalid_card_token, el problema es la tarjeta o el');
  console.log('  ambiente del token, no como se pide. Si alguna dice otra cosa');
  console.log('  (cc_rejected_*, por ejemplo), esa ya cobra y el resto es el banco.');
}
console.log();
