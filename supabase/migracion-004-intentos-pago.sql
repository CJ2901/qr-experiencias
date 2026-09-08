-- =====================================================================
--  MIGRACION 004 · Bitacora de intentos de pago
--  Pegar completo en Supabase > SQL Editor > New query > Run.
--  Idempotente: se puede correr varias veces.
--
--  QUE PROBLEMA RESUELVE
--  Hoy, si /api/pagar falla, lo unico que queda es una linea en la
--  consola del `next dev`. En Vercel no vas a tener esa consola, y el
--  comprador que dice "ya pague" no tiene nada que dictarte. Con esta
--  tabla cada intento deja rastro ANTES de llamar a Mercado Pago y se
--  cierra despues, tanto si aprueba como si revienta.
--
--  NO toca ninguna tabla existente: solo agrega `intentos_pago`.
-- =====================================================================

create table if not exists intentos_pago (
  id               uuid primary key default gen_random_uuid(),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),

  -- quien y que estaba comprando
  comprador_id     uuid references auth.users(id) on delete set null,
  comprador_email  text,
  plantilla        text,
  ocasion          text,
  metodo           text,                     -- tarjeta | yape
  monto_centavos   integer,

  -- como termino
  resultado        text not null default 'iniciado',
                   -- iniciado | aprobado | pendiente | rechazado | error
  paso             text,                     -- donde murio: pasarela, base_de_datos...
  codigo           text,                     -- codigo interno o de Mercado Pago
  detalle          jsonb not null default '{}'::jsonb,

  -- lo que dice Mercado Pago
  mp_payment_id    text,
  mp_status        text,
  mp_status_detail text,

  pedido_id        uuid references pedidos(id) on delete set null
);

create index if not exists intentos_pago_comprador_idx
  on intentos_pago (comprador_id, creado_en desc);
create index if not exists intentos_pago_resultado_idx
  on intentos_pago (resultado, creado_en desc);
create index if not exists intentos_pago_mp_idx
  on intentos_pago (mp_payment_id) where mp_payment_id is not null;

-- actualizado_en automatico (reusa la funcion del schema base)
drop trigger if exists intentos_pago_tocar on intentos_pago;
create trigger intentos_pago_tocar before update on intentos_pago
  for each row execute function tocar_actualizado();

-- ---------------------------------------------------------------------
--  SEGURIDAD
--  Esta tabla guarda codigos de error de la pasarela y correos: nadie
--  la lee desde el navegador. RLS activo y SIN politicas = solo pasa la
--  service_role, que salta RLS por diseno.
--
--  El REVOKE no sobra: permisos.sql dejo
--    alter default privileges in schema public grant select on tables
--      to anon, authenticated;
--  ...asi que toda tabla nueva nace con SELECT para anon. Aqui lo
--  quitamos a mano.
-- ---------------------------------------------------------------------
alter table intentos_pago enable row level security;

revoke all on public.intentos_pago from anon, authenticated;
grant  all on public.intentos_pago to service_role;

-- ---------------------------------------------------------------------
--  Comprobacion
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'intentos_pago')                        as columnas,
  (select relrowsecurity from pg_class where relname = 'intentos_pago') as rls_activo,
  (select count(*) from information_schema.role_table_grants
    where table_name = 'intentos_pago' and grantee in ('anon','authenticated')) as fugas_de_permiso;
-- fugas_de_permiso debe salir 0.
