/**
 * Ruta A: cobrar con el par vendedor-de-prueba + comprador-de-prueba.
 *
 *   node --env-file=.env scripts/probar-vendedor-prueba.mjs
 *
 * POR QUE ESTE SCRIPT NO TOCA MP_ACCESS_TOKEN
 * Lee credenciales NUEVAS y aparte:
 *
 *   MP_VENDEDOR_ACCESS_TOKEN=TEST-...
 *   MP_VENDEDOR_PUBLIC_KEY=TEST-...
 *   MP_COMPRADOR_USUARIO=TESTUSER7378515948445158953
 *
 * Asi se prueba la ruta A sin romper lo que ya hay: si funciona, el propio
 * script te imprime las tres lineas listas para pisar tu .env; si no, no
 * perdiste las credenciales viejas.
 *
 * DE DONDE SALEN LOS CORREOS QUE EL PANEL NO MUESTRA
 * Un usuario de prueba no tiene casilla real, por eso el panel solo lista
 * usuario y contrasena. Su correo se deriva del nombre de usuario:
 *
 *   TESTUSER7378515948445158953  ->  test_user_7378515948445158953@testuser.com
 *
 * El paso 0 lo confirma contra GET /users/me, que si devuelve el email del
 * dueno del token. No lo adivines: leelo ahi.
 *
 * DE DONDE SALEN LAS CREDENCIALES DEL VENDEDOR
 *  1. Ventana de incognito -> mercadopago.com.pe
 *  2. Entra con el USUARIO y la CONTRASENA de la fila "Cuenta de prueba
 *     vendedor" (TESTUSER3290986102609607253). No con tu cuenta real.
 *  3. Ya dentro de ESA sesion: Tus integraciones -> crea una aplicacion
 *     (Pagos online, Checkout API) -> Credenciales de prueba.
 *  4. Copia de ESA pantalla el Access Token y la Public Key.
 *
 * El paso 0 de aqui te dice si te equivocaste de sesion: si el nickname no
 * empieza con TESTUSER, copiaste las de la cuenta real otra vez.
 */

const TOKEN = process.env.MP_VENDEDOR_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.MP_VENDEDOR_PUBLIC_KEY;
const USUARIO_COMPRADOR = process.env.MP_COMPRADOR_USUARIO;
const EMAIL_COMPRADOR_MANUAL = process.env.MP_COMPRADOR_EMAIL;

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const neg = (s) => `\x1b[1m${s}\x1b[0m`;

if (!TOKEN || !PUBLIC_KEY) {
  console.error(rojo('\nFaltan MP_VENDEDOR_ACCESS_TOKEN o MP_VENDEDOR_PUBLIC_KEY en .env.'));
  console.error('Lee la cabecera de este archivo: salen de una sesion de incognito');
  console.error('logueada como el vendedor de prueba, no de tu cuenta real.\n');
  process.exit(1);
}

const API = 'https://api.mercadopago.com';
const clave = () => `vp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function llamar(metodo, ruta, { bearer, cuerpo, pk, extra } = {}) {
  const url = pk ? `${API}${ruta}?public_key=${encodeURIComponent(pk)}` : `${API}${ruta}`;
  const headers = { 'Content-Type': 'application/json', ...(extra ?? {}) };
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
  console.log(gris(`      ${JSON.stringify(r.body).slice(0, 460)}`));
  console.log();
}

/* ═════════════ 0 · ¿de quién son estas credenciales, de verdad? ═════════ */
/* Prueba (TEST-) y produccion (APP_USR-) son dos juegos DISTINTOS dentro
   de la misma aplicacion. Mezclar uno de cada lado es exactamente lo que
   MP responde como 401 code 7 "Unauthorized use of live credentials". */
const tipo = (c) =>
  c.startsWith('TEST-') ? 'prueba' : c.startsWith('APP_USR-') ? 'producción' : 'desconocido';

console.log(`\n${neg('0 · ¿El token es del vendedor de prueba?')}`);
console.log(gris(`   access token: ${tipo(TOKEN)} (${TOKEN.slice(0, 12)}…)`));
console.log(gris(`   public key:   ${tipo(PUBLIC_KEY)} (${PUBLIC_KEY.slice(0, 12)}…)`));
if (tipo(TOKEN) !== tipo(PUBLIC_KEY)) {
  console.log(rojo('\n   Las dos credenciales son de juegos distintos.'));
  console.log('   Copia las DOS de la misma pestaña: o ambas de "Credenciales de');
  console.log('   prueba", o ambas de "Credenciales de producción". Nunca una de cada.\n');
  process.exit(1);
}
const yo = (await llamar('GET', '/users/me', { bearer: TOKEN })).body;
const esPrueba = String(yo.nickname ?? '').toUpperCase().startsWith('TESTUSER');

console.log(`   id ${neg(String(yo.id))} · site ${yo.site_id} · ${yo.email ?? '(sin email)'}`);
console.log(gris(`   nickname ${yo.nickname ?? '?'}`));
console.log(`   vendedor de prueba: ${esPrueba ? verde('SÍ') : rojo('NO — son las de la cuenta real otra vez')}`);
console.log();

if (!esPrueba) {
  console.log(rojo('  Detente aqui. El paso 3 de la cabecera no se completo: la pantalla'));
  console.log('  de "Credenciales de prueba" que abriste era la de tu cuenta real.');
  console.log('  Tiene que ser dentro de la sesion de incognito del vendedor.\n');
  process.exit(1);
}

/* ═══════════════ 1 · el correo del comprador de prueba ══════════════════ */
console.log(neg('1 · Correo del comprador de prueba'));
let emailComprador = EMAIL_COMPRADOR_MANUAL;
if (!emailComprador && USUARIO_COMPRADOR) {
  // Solo sirve el nombre de usuario del comprador: TESTUSER seguido de
  // digitos. Un gmail aqui dejaba `test_user_@testuser.com` —un correo que
  // no existe— y MP contestaba con un error que no tenia nada que ver.
  // Derivar a ciegas y no validar fue el bug de la primera version.
  const digitos = String(USUARIO_COMPRADOR).replace(/\D/g, '');
  if (digitos.length < 8) {
    console.log(rojo(`   MP_COMPRADOR_USUARIO="${USUARIO_COMPRADOR}" no es un usuario de prueba.`));
    console.log('   Tiene que ser el de la columna "Usuario" de la fila COMPRADOR');
    console.log('   en Cuentas de prueba, tal cual: TESTUSER seguido de digitos.');
    console.log(gris('\n     MP_COMPRADOR_USUARIO=TESTUSER7378515948445158953\n'));
    process.exit(1);
  }
  emailComprador = `test_user_${digitos}@testuser.com`;
  console.log(gris(`   derivado de ${USUARIO_COMPRADOR}`));
}
if (!emailComprador) {
  console.log(rojo('   Falta MP_COMPRADOR_USUARIO (el TESTUSER… del comprador) o MP_COMPRADOR_EMAIL.\n'));
  process.exit(1);
}
if (!/^test_user_\d{8,}@testuser\.com$/.test(emailComprador)) {
  console.log(rojo(`   "${emailComprador}" no tiene forma de correo de usuario de prueba.`));
  console.log('   Con el vendedor de prueba cobrando, el pagador TIENE que ser otro');
  console.log('   usuario de prueba: cualquier gmail real da 403 por la misma regla.\n');
  process.exit(1);
}
if (emailComprador === yo.email) {
  console.log(rojo('   Ese es el correo del VENDEDOR. Nadie puede pagarse a si mismo: seria 403.\n'));
  process.exit(1);
}
console.log(`   pagador: ${neg(emailComprador)}\n`);

/* ═══════════════════════ 2 · el cobro de verdad ═════════════════════════ */
/*
 * LA PIEZA QUE FALTABA: X-Test-Token
 *
 * Mercado Pago lo dijo con todas sus letras al llamar a /v1/orders:
 *   "Test credentials are not supported, use test users with production
 *    credentials to sandbox environment"
 *
 * O sea: las TEST- no van, van las APP_USR- del usuario de prueba. Pero
 * entonces MP ve credenciales de produccion y una tarjeta de prueba, y no
 * tiene con que distinguir un sandbox de un fraude: 401 code 7
 * "Unauthorized use of live credentials".
 *
 * La cabecera `X-Test-Token: true` es lo que marca la peticion como de
 * prueba. Esta en el SDK (requestOptions.testToken) y ninguno de los
 * scripts anteriores la mandaba. Aqui se prueban las dos variantes en la
 * misma corrida para no volver a mezclar dos cambios.
 */
console.log(neg('2 · Cobro con tarjeta Mastercard de prueba · S/ 89.00'));

const TARJETA = {
  card_number: '5031755734530604',
  expiration_month: 11,
  expiration_year: 2030,
  security_code: '123',
  cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
};

const PAGADOR = {
  email: emailComprador,
  first_name: 'Test',
  last_name: 'Comprador',
  identification: { type: 'DNI', number: '12345678' },
};

async function cobrar(etiqueta, { testToken, orders = false } = {}) {
  const extra = testToken ? { 'X-Test-Token': 'true' } : undefined;

  // el token de tarjeta es de un solo uso: uno nuevo por intento
  const tok = await llamar('POST', '/v1/card_tokens', { pk: PUBLIC_KEY, cuerpo: TARJETA, extra });
  if (!tok.body.id) {
    linea(`${etiqueta} · tokenizar`, tok);
    return { ok: false, http: tok.http, body: tok.body };
  }

  const r = orders
    ? await llamar('POST', '/v1/orders', {
        bearer: TOKEN,
        extra,
        cuerpo: {
          type: 'online',
          processing_mode: 'automatic',
          total_amount: '89.00',
          external_reference: `vp-${Date.now()}`,
          payer: PAGADOR,
          transactions: {
            payments: [
              {
                amount: '89.00',
                payment_method: { id: 'master', type: 'credit_card', token: tok.body.id, installments: 1 },
              },
            ],
          },
        },
      })
    : await llamar('POST', '/v1/payments', {
        bearer: TOKEN,
        extra,
        cuerpo: {
          transaction_amount: 89,
          token: tok.body.id,
          description: 'Experiencia QR · prueba vendedor',
          installments: 1,
          payment_method_id: 'master',
          payer: PAGADOR,
        },
      });

  linea(etiqueta, r);
  return { ok: r.http >= 200 && r.http < 300, http: r.http, body: r.body };
}

const sinCabecera = await cobrar('/v1/payments · SIN X-Test-Token');
const conCabecera = await cobrar('/v1/payments · CON X-Test-Token: true', { testToken: true });
const orden = conCabecera.ok
  ? null
  : await cobrar('/v1/orders · CON X-Test-Token: true', { testToken: true, orders: true });

/* ═══════════════════════════ veredicto ═════════════════════════════════ */
console.log(neg('Veredicto'));

const bueno = conCabecera.ok ? conCabecera : orden?.ok ? orden : sinCabecera.ok ? sinCabecera : null;

if (bueno) {
  const estado = bueno.body.status ?? bueno.body.status_detail ?? '(creado)';
  const cual = bueno === conCabecera ? 'con X-Test-Token' : bueno === orden ? 'por la Orders API' : 'sin cabecera extra';
  console.log(verde(`  Cobrado ${cual}. estado: ${estado}`));
  console.log('\n  Pon esto en tu .env:\n');
  console.log(`    MP_ACCESS_TOKEN=${TOKEN}`);
  console.log(`    NEXT_PUBLIC_MP_PUBLIC_KEY=${PUBLIC_KEY}`);
  console.log(`    MP_TEST_PAYER_EMAIL=${emailComprador}`);
  if (bueno === conCabecera || bueno === orden) {
    console.log(`    MP_MODO=prueba`);
    console.log(gris('\n  MP_MODO=prueba es obligatorio: son credenciales APP_USR-, asi que'));
    console.log(gris('  el codigo ya no puede deducir por el prefijo que esto es un sandbox.'));
    console.log(gris('  Esa variable es la que hace que se mande X-Test-Token y que el'));
    console.log(gris('  checkout siga mostrando el cartel de "modo prueba".'));
  }
} else if (conCabecera.http === 401) {
  console.log(rojo('  401 tambien con X-Test-Token.'));
  console.log('  Revisa que la aplicacion del vendedor de prueba este creada como');
  console.log('  "Pagos online" con Checkout API / Bricks. Si lo esta, esto ya es');
  console.log('  para soporte, con los x-request-id de arriba.');
} else {
  console.log(ambar(`  HTTP ${conCabecera.http}. La causa esta arriba: ya no es el 401 generico.`));
}
console.log();
