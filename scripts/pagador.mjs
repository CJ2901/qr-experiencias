/**
 * Quien cobra vs. quien paga. Resuelve el 403 "Payer email forbidden".
 *
 *   node --env-file=.env scripts/pagador.mjs          # diagnostica
 *   node --env-file=.env scripts/pagador.mjs crear    # ademas crea un comprador nuevo
 *
 * Mercado Pago devuelve 403 "Payer email forbidden" cuando el correo del
 * pagador NO puede pagarle a la cuenta dueña del access token. En prueba
 * hay dos causas, y este script las separa:
 *
 *   a) el pagador es la MISMA cuenta que cobra  → nadie se paga a si mismo;
 *   b) el usuario de prueba pertenece a OTRA cuenta (se creo con otras
 *      credenciales, o se copio de un tutorial).
 *
 * En los dos casos la salida es la misma: crear un comprador de prueba
 * con ESTE token y pegar su correo en MP_TEST_PAYER_EMAIL.
 */

const TOKEN = process.env.MP_ACCESS_TOKEN;
const PAGADOR = process.env.MP_TEST_PAYER_EMAIL ?? '';

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const negrita = (s) => `\x1b[1m${s}\x1b[0m`;

if (!TOKEN) {
  console.error(rojo('\nFalta MP_ACCESS_TOKEN.\n'));
  process.exit(1);
}
const esPrueba = TOKEN.startsWith('TEST-');

/* ---------- 1 · quien cobra ---------- */
console.log(`\n${negrita('1 · La cuenta que cobra (dueña del access token)')}`);
const r = await fetch('https://api.mercadopago.com/users/me', {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const yo = await r.json().catch(() => ({}));

if (!r.ok) {
  console.log(rojo(`  ${r.status} · el access token no sirve`));
  console.log(gris('  ' + JSON.stringify(yo).slice(0, 300)));
  process.exit(1);
}

const esCuentaDePrueba = String(yo.email ?? '').endsWith('@testuser.com');
console.log(`  id       ${yo.id}`);
console.log(`  correo   ${negrita(yo.email ?? '—')}`);
console.log(`  usuario  ${yo.nickname ?? '—'}`);
console.log(`  pais     ${yo.site_id}`);
console.log(`  ambiente ${esPrueba ? verde('PRUEBA') : ambar('PRODUCCION')}`);
if (yo.site_id !== 'MPE') {
  console.log(rojo('  La cuenta NO es de Peru: las tarjetas peruanas de prueba no aplican.'));
}
if (esCuentaDePrueba) {
  console.log(ambar('  Ojo: estas cobrando CON un usuario de prueba (cuenta vendedora de prueba).'));
}

/* ---------- 2 · quien paga ---------- */
console.log(`\n${negrita('2 · El correo que enviamos como pagador')}`);
if (!PAGADOR) {
  console.log(rojo('  MP_TEST_PAYER_EMAIL esta vacio.'));
  console.log('  Con el token de prueba se manda el correo del comprador real,');
  console.log('  y si ese correo es el tuyo, MP responde 403.');
} else {
  console.log(`  ${negrita(PAGADOR)}`);
  if (!PAGADOR.endsWith('@testuser.com')) {
    console.log(ambar('  No parece un usuario de prueba (@testuser.com).'));
  }
}

/* ---------- 3 · veredicto ---------- */
console.log(`\n${negrita('Veredicto')}`);
const mismoCorreo = PAGADOR && yo.email && PAGADOR.toLowerCase() === String(yo.email).toLowerCase();

if (mismoCorreo) {
  console.log(rojo('  El pagador y el cobrador son LA MISMA cuenta.'));
  console.log('  Nadie puede pagarse a si mismo: de ahi el 403.');
} else if (PAGADOR) {
  console.log(ambar('  Son cuentas distintas, asi que el usuario de prueba'));
  console.log(ambar('  probablemente pertenece a OTRA cuenta de Mercado Pago.'));
  console.log('  Un comprador de prueba solo sirve con las credenciales de');
  console.log('  la cuenta donde se creo.');
}
console.log(gris('\n  Solucion en ambos casos: crear un comprador con ESTE token.'));
console.log(gris('  node --env-file=.env scripts/pagador.mjs crear'));
console.log(gris('\n  Y no, el correo de un comprador ya existente no se puede recuperar:'));
console.log(gris('  el panel no lo muestra y GET /users/{id} no devuelve email. Mercado Pago'));
console.log(gris('  solo lo entrega UNA vez, en la respuesta de POST /users/test_user. Si no'));
console.log(gris('  lo guardaste, el camino es crear otro; no cuesta nada y no rompe nada.\n'));

/* ---------- 4 · crear comprador ---------- */
if (process.argv[2] !== 'crear') process.exit(0);

console.log(negrita('3 · Creando comprador de prueba con este token'));
const c = await fetch('https://api.mercadopago.com/users/test_user', {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ site_id: yo.site_id ?? 'MPE' }),
});
const nuevo = await c.json().catch(() => ({}));

if (!c.ok) {
  console.log(rojo(`  ${c.status} · no se pudo crear`));
  console.log(gris('  ' + JSON.stringify(nuevo).slice(0, 400)));
  console.log('\n  Crear usuarios de prueba es una operacion de CUENTA, no de');
  console.log('  ambiente. Reintenta con el token de produccion solo para esto:');
  console.log(gris('    MP_ACCESS_TOKEN=APP_USR-... node scripts/pagador.mjs crear\n'));
  process.exit(1);
}

console.log(`  ${verde('creado')}`);
console.log(`  id         ${nuevo.id}`);
console.log(`  correo     ${verde(nuevo.email)}`);
console.log(`  usuario    ${nuevo.nickname}`);
console.log(`  contrasena ${nuevo.password}`);
console.log(`\n${negrita('Pega esto en tu .env y reinicia el next dev:')}\n`);
console.log(`  MP_TEST_PAYER_EMAIL=${nuevo.email}\n`);
