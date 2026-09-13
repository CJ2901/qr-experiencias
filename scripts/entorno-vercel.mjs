/**
 * Que variables necesita Vercel, y cuales tienes listas.
 *
 *   node --env-file=.env scripts/entorno-vercel.mjs
 *
 * `.env*` esta en .gitignore —como debe—, asi que NADA de tu .env llega a
 * Vercel: hay que cargarlo a mano en Settings > Environment Variables. Si
 * falta una, el visitante ve "Application error: a server-side exception"
 * con un digest y ninguna pista.
 *
 * Este script NO imprime valores, solo si estan y de que largo son.
 */

const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const neg = (s) => `\x1b[1m${s}\x1b[0m`;

const SITIO = process.argv[2] ?? 'https://qr-experiencias.vercel.app';

const VARIABLES = [
  ['NEXT_PUBLIC_SUPABASE_URL', true, 'sin esta, TODA página con sesión da 500'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', true, 'idem'],
  ['SUPABASE_SERVICE_ROLE_KEY', true, 'crear pedidos y firmar fotos'],
  ['NEXT_PUBLIC_SITE_URL', true, `en Vercel va ${SITIO}, NO localhost`],
  ['MP_ACCESS_TOKEN', true, 'cobrar'],
  ['NEXT_PUBLIC_MP_PUBLIC_KEY', true, 'el Brick en el navegador'],
  ['MP_MODO', true, 'prueba | produccion'],
  ['ADMIN_EMAILS', true, 'quién entra a /admin'],
  ['MP_TEST_PAYER_EMAIL', false, 'solo con MP_MODO=prueba'],
  ['MP_WEBHOOK_SECRET', false, 'sin esta el webhook rechaza todo con 401'],
  ['API_KEY', false, 'solo si creas pedidos desde Make/Tally'],
  ['NEXT_PUBLIC_MP_YAPE', false, '1 para mostrar la pestaña de Yape'],
];

console.log(`\n${neg('Variables para Vercel')}`);
console.log(gris('valores no se imprimen; solo presencia y longitud\n'));

const faltan = [];
for (const [nombre, obligatoria, para] of VARIABLES) {
  const v = process.env[nombre];
  const marca = v ? verde('✓') : obligatoria ? rojo('FALTA') : ambar('—');
  console.log(`  ${marca.padEnd(16)} ${nombre.padEnd(30)} ${gris(para)}`);
  if (v) console.log(gris(`${''.padEnd(18)} ${v.length} caracteres`));
  if (!v && obligatoria) faltan.push(nombre);
}

/* --- avisos que solo se ven comparando local contra producción --- */
console.log(`\n${neg('Revisiones propias del despliegue')}`);
const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? '';
if (sitio.includes('localhost')) {
  console.log(ambar(`  NEXT_PUBLIC_SITE_URL apunta a localhost.`));
  console.log(`  En Vercel tiene que ser ${SITIO}: de ahí sale el enlace mágico`);
  console.log('  del correo y la URL que se le enseña al comprador.');
} else if (sitio) {
  console.log(verde(`  NEXT_PUBLIC_SITE_URL = ${sitio}`));
}

const token = process.env.MP_ACCESS_TOKEN ?? '';
const modo = (process.env.MP_MODO ?? '').toLowerCase();
if (token.startsWith('APP_USR-') && modo !== 'prueba' && modo !== 'produccion') {
  console.log(rojo('  MP_ACCESS_TOKEN es APP_USR- y MP_MODO está vacía.'));
  console.log('  El código deduciría "producción" por el prefijo. Si son las');
  console.log('  credenciales del vendedor de prueba, pon MP_MODO=prueba.');
} else if (modo === 'prueba') {
  console.log(ambar('  MP_MODO=prueba: el sitio publicado NO cobra de verdad.'));
}

if (!process.env.MP_WEBHOOK_SECRET) {
  console.log(ambar('  MP_WEBHOOK_SECRET vacía: /api/mp/webhook rechaza todo con 401.'));
  console.log('  Los pagos diferidos no se acreditarán solos. En local da igual');
  console.log('  (MP no llega a localhost); publicado, no.');
}

console.log(`\n${neg('Y en Supabase')}`);
console.log('  Authentication > URL Configuration');
console.log(`    Site URL:      ${SITIO}`);
console.log(`    Redirect URLs: ${SITIO}/auth/callback`);
console.log(gris('  Supabase valida redirect_to con match exacto. Si esa URL no'));
console.log(gris('  está en la lista, el enlace mágico cae en la raíz sin canjear'));
console.log(gris('  el código y la sesión se pierde. Ver app/auth/callback/route.ts.'));

console.log();
if (faltan.length) {
  console.log(rojo(`Faltan ${faltan.length} obligatorias: ${faltan.join(', ')}`));
} else {
  console.log(verde('Están todas las obligatorias, al menos aquí.'));
}
console.log(gris('\nDespués de cargarlas en Vercel hay que VOLVER A DESPLEGAR: las'));
console.log(gris('NEXT_PUBLIC_ se incrustan al construir, no se leen al arrancar.\n'));
