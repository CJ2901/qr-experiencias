/**
 * Crea un usuario de prueba de Mercado Pago y te devuelve SU CORREO.
 *
 *   node --env-file=.env scripts/usuario-prueba.mjs
 *
 * El panel de "Cuentas de prueba" muestra User ID, usuario y contrasena,
 * pero no el correo. La API si lo devuelve, y es el que necesitas para
 * MP_TEST_PAYER_EMAIL.
 *
 * Si responde 401/403, usa el access token de PRODUCCION solo para esta
 * llamada: crear usuarios de prueba es una operacion de cuenta, no de
 * ambiente. Puedes pasarlo por delante sin tocar el .env:
 *
 *   MP_ACCESS_TOKEN=APP_USR-... node scripts/usuario-prueba.mjs
 */

const TOKEN = process.env.MP_ACCESS_TOKEN;
const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;

if (!TOKEN) {
  console.error(rojo('\nFalta MP_ACCESS_TOKEN.\n'));
  process.exit(1);
}

const r = await fetch('https://api.mercadopago.com/users/test_user', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ site_id: 'MPE' }), // MPE = Peru
});

const cuerpo = await r.json().catch(() => ({}));

if (!r.ok) {
  console.error(rojo(`\nMercado Pago respondio ${r.status}`));
  console.error(gris(JSON.stringify(cuerpo, null, 2)));
  if (r.status === 401 || r.status === 403) {
    console.error(
      '\nProbablemente necesita el token de PRODUCCION. Reintenta asi:\n' +
        gris('  MP_ACCESS_TOKEN=APP_USR-tu-token node scripts/usuario-prueba.mjs\n')
    );
  }
  process.exit(1);
}

console.log(`\n${verde('Usuario de prueba creado')}\n`);
console.log(`  id         ${cuerpo.id}`);
console.log(`  correo     ${verde(cuerpo.email)}`);
console.log(`  usuario    ${cuerpo.nickname}`);
console.log(`  contrasena ${cuerpo.password}`);
console.log(`\nPega esto en tu .env:\n`);
console.log(`  MP_TEST_PAYER_EMAIL=${cuerpo.email}\n`);
console.log(gris('Guarda usuario y contrasena: sirven para iniciar sesion como comprador'));
console.log(gris('si algun dia pruebas pagos con billetera en vez de tarjeta.\n'));
