/**
 * Diagnostico de la cuenta de Mercado Pago.
 *
 *   node --env-file=.env scripts/diagnostico-mp.mjs
 *
 * Reproduce, desde fuera del navegador, las mismas llamadas que hace el
 * Payment Brick. Sirve para separar dos cosas que se confunden:
 *
 *   - si aqui tambien falla  -> el problema es la cuenta o la aplicacion
 *                               de Mercado Pago, no tu codigo;
 *   - si aqui funciona       -> el problema esta en el navegador o en el
 *                               SDK del Brick.
 */

const TOKEN = process.env.MP_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const negrita = (s) => `\x1b[1m${s}\x1b[0m`;

if (!TOKEN || !PUBLIC_KEY) {
  console.error(rojo('\nFaltan MP_ACCESS_TOKEN o NEXT_PUBLIC_MP_PUBLIC_KEY.\n'));
  process.exit(1);
}

async function pedir(etiqueta, url, opciones = {}) {
  const r = await fetch(url, opciones);
  const texto = await r.text();
  let cuerpo;
  try { cuerpo = JSON.parse(texto); } catch { cuerpo = texto; }
  const ok = r.ok;
  console.log(`  ${ok ? verde('OK  ') : rojo(`${r.status} `)} ${etiqueta}`);
  return { ok, status: r.status, cuerpo };
}

/* ---------- 1 · quien es el dueno del token ---------- */
console.log(`\n${negrita('1 · La cuenta')}`);
const yo = await pedir('/users/me', 'https://api.mercadopago.com/users/me', {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
if (yo.ok) {
  console.log(`      id ${yo.cuerpo.id} · pais ${negrita(yo.cuerpo.site_id)} · ${yo.cuerpo.email ?? ''}`);
  if (yo.cuerpo.site_id !== 'MPE') {
    console.log(rojo(`      La cuenta NO es de Peru (${yo.cuerpo.site_id}).`));
    console.log('      Las tarjetas de prueba peruanas no van a funcionar aqui.');
  }
} else {
  console.log(rojo('      El access token no es valido.'));
  console.log(gris('      ' + JSON.stringify(yo.cuerpo).slice(0, 300)));
}

/* ---------- 2 · medios de pago habilitados en la cuenta ---------- */
console.log(`\n${negrita('2 · Medios de pago de la cuenta')}`);
const medios = await pedir(
  '/v1/payment_methods (con access token)',
  'https://api.mercadopago.com/v1/payment_methods',
  { headers: { Authorization: `Bearer ${TOKEN}` } }
);
if (medios.ok && Array.isArray(medios.cuerpo)) {
  const tarjetas = medios.cuerpo.filter((m) => m.payment_type_id?.includes('card'));
  console.log(`      ${medios.cuerpo.length} medios · ${tarjetas.length} de tarjeta`);
  if (!tarjetas.length) {
    console.log(rojo('      NINGUN medio de tarjeta habilitado.'));
    console.log('      Por eso el Brick no puede identificar el BIN.');
  } else {
    console.log(gris('      ' + tarjetas.slice(0, 8).map((m) => m.id).join(', ')));
  }
} else {
  console.log(rojo('      No se pudieron listar los medios de pago.'));
  console.log(gris('      ' + JSON.stringify(medios.cuerpo).slice(0, 300)));
}

/* ---------- 3 · la llamada exacta que hace el Brick ---------- */
console.log(`\n${negrita('3 · La consulta de BIN que hace el Brick')}`);
const BINS = [
  ['40091753', 'Visa credito'],
  ['50317557', 'Mastercard credito'],
  ['51787816', 'Mastercard debito'],
];
let fallos = 0;
for (const [bin, nombre] of BINS) {
  const u = new URL('https://api.mercadopago.com/v1/payment_methods/search');
  u.searchParams.set('public_key', PUBLIC_KEY);
  u.searchParams.set('bins', bin);
  u.searchParams.set('processing_mode', 'aggregator');
  const r = await pedir(`bin ${bin} · ${nombre}`, u);
  if (!r.ok) {
    fallos++;
    console.log(gris('      ' + JSON.stringify(r.cuerpo).slice(0, 300)));
  }
}

/* ---------- veredicto ---------- */
console.log(`\n${negrita('Veredicto')}`);
if (fallos === BINS.length) {
  console.log(rojo('  Los tres BINs fallan tambien fuera del navegador.'));
  console.log('  Tu codigo no tiene nada que ver: es la aplicacion o la cuenta.');
  console.log('\n  Que revisar, en este orden:');
  console.log('   1. Panel > Configuracion de la aplicacion. La aplicacion debe estar');
  console.log('      creada para PAGOS ONLINE con Checkout Bricks/API y modelo');
  console.log('      "aggregator". Si se creo para otro producto, los medios de pago');
  console.log('      no quedan aprovisionados y esta llamada devuelve 500.');
  console.log('   2. Si la configuracion se ve bien, crea una aplicacion NUEVA');
  console.log('      eligiendo Peru + Pagos online + Checkout Bricks, y cambia las');
  console.log('      dos credenciales en el .env.');
  console.log('   3. Si acabas de hacer muchos intentos seguidos, espera 15 minutos:');
  console.log('      MP limita temporalmente tras rafagas de errores.');
} else if (fallos === 0) {
  console.log(verde('  Las tres consultas funcionan desde aqui.'));
  console.log('  Entonces el fallo es del navegador o del SDK: prueba en ventana');
  console.log('  privada, sin extensiones, y con la cache limpia.');
} else {
  console.log(ambar(`  ${fallos} de ${BINS.length} BINs fallan.`));
  console.log('  Usa uno de los que si responde y sigue adelante.');
}
console.log();
