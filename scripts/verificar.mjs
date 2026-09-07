/**
 * Chequeo previo al despliegue.
 *
 *   node --env-file=.env scripts/verificar.mjs
 *
 * Comprueba, en orden, todo lo que se puede romper en silencio:
 * variables presentes, conexion, esquema aplicado, GRANT del Data API,
 * RLS bien puesto y bucket de Storage creado.
 * No imprime ninguna clave.
 */

import { createClient } from '@supabase/supabase-js';

const ok = (m) => console.log('  \x1b[32mOK\x1b[0m    ' + m);
const mal = (m) => console.log('  \x1b[31mFALLA\x1b[0m ' + m);
const nota = (m) => console.log('  \x1b[33mAVISO\x1b[0m ' + m);

let errores = 0;

console.log('\nRevisando el proyecto...\n');

/* 1 · variables ---------------------------------------------------- */
const NECESARIAS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'API_KEY',
  'ADMIN_PASSWORD',
  'NEXT_PUBLIC_SITE_URL',
];
const faltan = NECESARIAS.filter((k) => !process.env[k]);
if (faltan.length) {
  mal('faltan variables: ' + faltan.join(', '));
  console.log('\nCargalas con:  node --env-file=.env scripts/verificar.mjs\n');
  process.exit(1);
}
ok('las 6 variables estan definidas');

if (process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  mal('la service_role y la anon key son iguales: copiaste la misma dos veces');
  errores++;
}
const sitio = process.env.NEXT_PUBLIC_SITE_URL;
if (sitio.endsWith('/')) {
  nota('NEXT_PUBLIC_SITE_URL termina en "/". Quitala: ensucia las URLs impresas en el QR.');
}
if (!/^https?:\/\//.test(sitio)) {
  mal('NEXT_PUBLIC_SITE_URL debe empezar por http:// o https://');
  errores++;
}
if (sitio.startsWith('https://localhost')) {
  mal('en local es http://localhost:3000, no https:// (el dev server no usa TLS)');
  errores++;
}
if ((process.env.API_KEY ?? '').length < 24) {
  nota('API_KEY es corta. Usa algo largo y aleatorio: openssl rand -hex 32');
}

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/* 2 · esquema y GRANT ---------------------------------------------- */
{
  const { data, error } = await anon.from('ocasiones').select('slug').limit(10);
  if (error) {
    mal('no se puede leer "ocasiones" con la anon key -> ' + error.message);
    if (/permission denied/i.test(error.message)) {
      console.log('        Falta el GRANT. Corre supabase/schema.sql completo otra vez.');
    }
    if (/does not exist|schema cache/i.test(error.message)) {
      console.log('        La tabla no existe. No corriste supabase/schema.sql.');
    }
    errores++;
  } else {
    ok(`esquema aplicado · ${data.length} ocasiones cargadas`);
  }
}

/* 3 · RLS: la anon NO debe ver borradores --------------------------- */
{
  const prueba = {
    ocasion: 'cumpleanos',
    slug: 'zzz-prueba-rls',
    destinatario: 'Prueba',
    frase_principal: 'Prueba',
    mensaje: 'Prueba de RLS.',
    estado: 'borrador',
  };
  const { error: eIns } = await admin.from('pedidos').upsert(prueba, { onConflict: 'ocasion,slug' });
  if (eIns) {
    mal('la service_role no puede escribir -> ' + eIns.message);
    errores++;
  } else {
    const { data } = await anon.from('pedidos').select('slug').eq('slug', 'zzz-prueba-rls');
    if (data && data.length) {
      mal('RLS mal configurado: la anon key ve pedidos en borrador');
      errores++;
    } else {
      ok('RLS correcto · los borradores no son visibles publicamente');
    }
    await admin.from('pedidos').delete().eq('slug', 'zzz-prueba-rls');
  }
}

/* 4 · Storage ------------------------------------------------------- */
{
  const { data, error } = await admin.storage.getBucket('media');
  if (error) {
    mal('no existe el bucket "media" -> ' + error.message);
    errores++;
  } else if (data.public) {
    mal('el bucket "media" es PUBLICO: la caducidad de fotos no va a funcionar');
    errores++;
  } else {
    ok('bucket "media" existe y es privado');
  }
}

/* ------------------------------------------------------------------ */
console.log(
  errores === 0
    ? '\n\x1b[32mTodo listo para desplegar.\x1b[0m\n'
    : `\n\x1b[31m${errores} problema(s) que arreglar antes de desplegar.\x1b[0m\n`
);
process.exit(errores === 0 ? 0 : 1);
