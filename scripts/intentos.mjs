/**
 * Los ultimos intentos de pago, con el motivo exacto de cada fallo.
 *
 *   node --env-file=.env scripts/intentos.mjs        # ultimos 15
 *   node --env-file=.env scripts/intentos.mjs 40     # ultimos 40
 *   node --env-file=.env scripts/intentos.mjs error  # solo los que fallaron
 *
 * Requiere la migracion 004. Este script reemplaza al "mirame la consola
 * del next dev": en Vercel esa consola no existe, y el comprador que dice
 * "ya pague" te dicta el codigo de referencia que sale aqui.
 */

import { createClient } from '@supabase/supabase-js';

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const ambar = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const negrita = (s) => `\x1b[1m${s}\x1b[0m`;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error(rojo('\nFaltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n'));
  process.exit(1);
}

const arg = process.argv[2] ?? '';
const soloFallos = arg === 'error' || arg === 'fallos';
const limite = Number(arg) > 0 ? Number(arg) : 15;

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

let q = sb.from('intentos_pago').select('*').order('creado_en', { ascending: false }).limit(limite);
if (soloFallos) q = q.in('resultado', ['error', 'rechazado']);

const { data, error } = await q;

if (error) {
  console.error(rojo(`\nNo se pudo leer intentos_pago: ${error.code} ${error.message}`));
  if (error.code === '42P01') {
    console.error('Falta correr supabase/migracion-004-intentos-pago.sql en el SQL Editor.\n');
  }
  process.exit(1);
}

if (!data.length) {
  console.log(ambar('\nNo hay intentos registrados todavia.\n'));
  process.exit(0);
}

const COLOR = {
  aprobado: verde,
  pendiente: ambar,
  rechazado: rojo,
  error: rojo,
  iniciado: gris,
};

console.log(`\n${negrita(`${data.length} intento(s), del mas reciente al mas viejo`)}\n`);

for (const i of data) {
  const pinta = COLOR[i.resultado] ?? gris;
  const fecha = new Date(i.creado_en).toLocaleString('es-PE');
  const monto = i.monto_centavos ? `S/ ${(i.monto_centavos / 100).toFixed(2)}` : '—';

  console.log(`${pinta(i.resultado.toUpperCase().padEnd(10))} ${gris(fecha)}`);
  console.log(`  ref      ${i.id}`);
  console.log(`  compra   ${i.plantilla ?? '—'} · ${i.ocasion ?? '—'} · ${i.metodo ?? '—'} · ${monto}`);
  console.log(`  quien    ${i.comprador_email ?? i.comprador_id ?? '—'}`);

  if (i.paso || i.codigo) {
    console.log(`  fallo en ${negrita(i.paso ?? '—')} · codigo ${negrita(i.codigo ?? '—')}`);
  }
  if (i.mp_payment_id) {
    console.log(`  mp       ${i.mp_payment_id} · ${i.mp_status ?? '—'} / ${i.mp_status_detail ?? '—'}`);
  }
  if (i.pedido_id) console.log(`  pedido   ${i.pedido_id}`);

  const detalle = i.detalle && Object.keys(i.detalle).length ? JSON.stringify(i.detalle) : '';
  if (detalle) console.log(gris(`  detalle  ${detalle.slice(0, 300)}`));

  console.log();
}

/* ---------- resumen ---------- */
const cuenta = data.reduce((a, i) => ({ ...a, [i.resultado]: (a[i.resultado] ?? 0) + 1 }), {});
console.log(negrita('Resumen'));
for (const [k, n] of Object.entries(cuenta)) {
  console.log(`  ${(COLOR[k] ?? gris)(k.padEnd(10))} ${n}`);
}

const roto = data.find((i) => i.resultado === 'error');
if (roto) {
  console.log(`\n${negrita('El fallo mas reciente')}`);
  console.log(`  paso   ${roto.paso}`);
  console.log(`  codigo ${roto.codigo}`);
  console.log(`  causa  ${JSON.stringify(roto.detalle)}`);
  if (roto.paso === 'pasarela') {
    console.log(gris('\n  Es de Mercado Pago. Corre scripts/diagnostico-mp.mjs.'));
  } else if (roto.paso === 'base_de_datos') {
    console.log(rojo('\n  SE COBRO Y NO SE GUARDO. Revisa ese pago a mano en el panel de MP.'));
  } else if (roto.paso === 'configuracion') {
    console.log(gris('\n  Falta una variable de entorno. Corre scripts/verificar.mjs.'));
  }
}
console.log();
