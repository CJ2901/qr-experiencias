-- =====================================================================
--  migracion-007 · catalogo: precio regular, temporadas e historial
--  Pegar completo en DBeaver (sin candado) y ejecutar con Alt+X.
--  Solo AGREGA columnas y tablas: no borra ni renombra nada existente.
-- =====================================================================

begin;

-- Temporadas: ventana anual recurrente (MM-DD). Soporta cruce de ano (12-15 -> 01-06).
create table if not exists public.temporadas (
  slug         text primary key,                 -- navidad, san-valentin, dia-madre
  nombre       text not null,
  inicio_mmdd  text not null check (inicio_mmdd ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'),
  fin_mmdd     text not null check (fin_mmdd    ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'),
  activa       boolean not null default true
);
alter table public.temporadas enable row level security;
revoke all on public.temporadas from anon, authenticated;
grant  all on public.temporadas to service_role;

insert into public.temporadas (slug, nombre, inicio_mmdd, fin_mmdd) values
  ('san-valentin', 'San Valentín',    '01-20', '02-14'),
  ('dia-madre',    'Día de la Madre', '04-20', '05-12'),
  ('navidad',      'Navidad',         '11-15', '12-25')
on conflict (slug) do nothing;

alter table public.plantillas
  add column if not exists descripcion_larga        text,
  add column if not exists incluye                  text[]  not null default '{}',
  add column if not exists precio_regular_centavos  integer,
  add column if not exists tipo                     text    not null default 'permanente',
  add column if not exists temporada                text    references public.temporadas(slug),
  add column if not exists publico                  text    not null default 'pareja',
  add column if not exists con_voz                  boolean not null default false,
  add column if not exists con_cancion              boolean not null default false,
  add column if not exists portada                  text,
  add column if not exists creado_en                timestamptz not null default now(),
  add column if not exists actualizado_en           timestamptz not null default now();

-- Precios del piloto: S/ 39.00 oferta · S/ 44.90 regular (+15%, redondeado a 0.10)
update public.plantillas set precio_centavos = 3900, precio_regular_centavos = 4490;

alter table public.plantillas alter column precio_regular_centavos set not null;

alter table public.plantillas drop constraint if exists plantillas_tipo_valido;
alter table public.plantillas drop constraint if exists plantillas_publico_valido;
alter table public.plantillas drop constraint if exists plantillas_estacional_ok;
alter table public.plantillas drop constraint if exists plantillas_precio_coherente;
alter table public.plantillas
  add constraint plantillas_tipo_valido      check (tipo in ('permanente', 'estacional')),
  add constraint plantillas_publico_valido   check (publico in ('pareja', 'familia', 'amistad', 'general')),
  add constraint plantillas_estacional_ok    check ((tipo = 'estacional') = (temporada is not null)),
  add constraint plantillas_precio_coherente check (precio_regular_centavos >= precio_centavos);

drop trigger if exists plantillas_tocar on public.plantillas;
create trigger plantillas_tocar before update on public.plantillas
  for each row execute function public.tocar_actualizado();

-- Historial de precios: respaldo de que el "precio regular" fue real
create table if not exists public.precios_historial (
  id                       bigint generated always as identity primary key,
  plantilla                text not null references public.plantillas(slug),
  precio_centavos          integer not null,
  precio_regular_centavos  integer not null,
  vigente_desde            timestamptz not null default now()
);
alter table public.precios_historial enable row level security;
revoke all on public.precios_historial from anon, authenticated;
grant  all on public.precios_historial to service_role;

create or replace function public.registrar_precio() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT'
     or new.precio_centavos         is distinct from old.precio_centavos
     or new.precio_regular_centavos is distinct from old.precio_regular_centavos then
    insert into public.precios_historial (plantilla, precio_centavos, precio_regular_centavos)
    values (new.slug, new.precio_centavos, new.precio_regular_centavos);
  end if;
  return new;
end $$;

drop trigger if exists plantillas_precio_historial on public.plantillas;
create trigger plantillas_precio_historial after insert or update on public.plantillas
  for each row execute function public.registrar_precio();

-- Punto de partida del historial (solo si aun esta vacio)
insert into public.precios_historial (plantilla, precio_centavos, precio_regular_centavos)
select slug, precio_centavos, precio_regular_centavos from public.plantillas
 where not exists (select 1 from public.precios_historial);

-- ¿Esta vigente la temporada hoy (hora Lima)? Maneja el cruce de ano.
create or replace function public.temporada_vigente(p_slug text) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.temporadas t,
           lateral (select to_char(now() at time zone 'America/Lima', 'MM-DD') as hoy) h
     where t.slug = p_slug and t.activa
       and case when t.inicio_mmdd <= t.fin_mmdd
                then h.hoy between t.inicio_mmdd and t.fin_mmdd
                else h.hoy >= t.inicio_mmdd or h.hoy <= t.fin_mmdd end
  )
$$;

-- Lo que muestra el landing (la app la lee con service_role)
create or replace view public.catalogo_vigente with (security_invoker = true) as
  select * from public.plantillas
   where activa
     and (tipo = 'permanente' or public.temporada_vigente(temporada))
   order by orden;
revoke all on public.catalogo_vigente from anon, authenticated;

commit;

-- Comprobacion: 4 filas, oferta 39.00 y regular 44.90
select slug, tipo, publico, precio_centavos/100.0 as oferta, precio_regular_centavos/100.0 as regular
  from public.plantillas order by orden;
