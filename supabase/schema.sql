-- =====================================================================
--  qr-experiencias · esquema
--  Pegar completo en Supabase > SQL Editor > New query > Run.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type tema_visual as enum ('correspondencia','luz-de-vela','herbario','editorial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pedido as enum ('borrador','listo','archivado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Ocasiones: es el primer segmento de la URL /[ocasion]/[slug].
-- Va en tabla y no en enum para que puedas agregar una sin migrar nada.
-- ---------------------------------------------------------------------
create table if not exists ocasiones (
  slug          text primary key,          -- cumpleanos, aniversario, ...
  nombre        text not null,             -- "Cumpleaños"
  emojis        text not null default '',  -- 🎈🎂🎈
  tema_default  tema_visual not null default 'correspondencia',
  activa        boolean not null default true
);

insert into ocasiones (slug, nombre, emojis, tema_default) values
  ('cumpleanos',  'Cumpleaños',        '🎈🎂🎈', 'correspondencia'),
  ('aniversario', 'Aniversario',       '🥂✨',   'luz-de-vela'),
  ('cumplemes',   'Cumple mes',        '💛',     'herbario'),
  ('propuesta',   '¿Quieres ser mi novia?', '💍', 'editorial'),
  ('porque-si',   'Porque sí',         '❤️',     'herbario')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Pedidos: una fila = una página entregada.
-- ---------------------------------------------------------------------
create table if not exists pedidos (
  id                uuid primary key default gen_random_uuid(),

  -- ruta pública
  ocasion           text not null references ocasiones(slug),
  slug              text not null,
  tema              tema_visual not null default 'correspondencia',
  estado            estado_pedido not null default 'borrador',

  -- contenido (todo lo que cambia por cliente)
  destinatario      text not null,                 -- "Cris"
  pareja            text,                          -- "Greg & Cris"
  frase_principal   text not null,
  fecha_texto       text,                          -- "18 de junio"
  mensaje           text not null,                 -- se corta en renglones al renderizar
  frase_capitulo    text,
  frase_brindis     text,
  frase_final       text,
  emojis            text,
  texto_boton       text not null default 'Guardar este momento',

  -- media
  fotos             jsonb not null default '[]'::jsonb,   -- ["ruta/en/storage.jpg", ...]
  foto_final        text,
  voz_url           text,                                  -- mp3 de ElevenLabs
  cancion_url       text,                                  -- mp3 de Suno

  -- comprador y ciclo de vida
  comprador_email   text,
  comprador_tel     text,
  retencion         text not null default '12m',           -- 6m | 12m | 24m | siempre
  media_expira_en   timestamptz,
  archivada_en      timestamptz,

  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),

  constraint slug_formato check (slug ~ '^[a-z0-9-]{4,40}$'),
  unique (ocasion, slug)
);

create index if not exists pedidos_ruta_idx   on pedidos (ocasion, slug);
create index if not exists pedidos_estado_idx on pedidos (estado, creado_en desc);
create index if not exists pedidos_expira_idx on pedidos (media_expira_en)
  where media_expira_en is not null;

-- actualizado_en automático
create or replace function tocar_actualizado() returns trigger
language plpgsql as $$
begin new.actualizado_en = now(); return new; end $$;

drop trigger if exists pedidos_tocar on pedidos;
create trigger pedidos_tocar before update on pedidos
  for each row execute function tocar_actualizado();

-- ---------------------------------------------------------------------
-- RLS: el público solo puede leer páginas ya entregadas.
-- Todo lo que escribe (API, panel, Make) usa la service_role, que salta RLS.
-- ---------------------------------------------------------------------
alter table pedidos   enable row level security;
alter table ocasiones enable row level security;

drop policy if exists "leer pedidos listos" on pedidos;
create policy "leer pedidos listos" on pedidos
  for select to anon, authenticated
  using (estado = 'listo');

-- Permisos del Data API.
-- Si dejaste DESMARCADO "Automatically expose new tables" al crear el proyecto
-- (recomendado), estos GRANT son obligatorios: sin ellos PostgREST responde
-- que falta el permiso y la pagina no carga. Son solo de lectura: nadie escribe
-- con la anon key, todo lo que escribe usa la service_role.
grant usage  on schema public       to anon, authenticated;
grant select on public.pedidos      to anon, authenticated;
grant select on public.ocasiones    to anon, authenticated;

drop policy if exists "leer ocasiones activas" on ocasiones;
create policy "leer ocasiones activas" on ocasiones
  for select to anon, authenticated
  using (activa);

-- ---------------------------------------------------------------------
-- Storage: un bucket privado. Las fotos se sirven con URL firmada,
-- que es lo que permite que caduquen sin borrar nada.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Caducidad. La página nunca muere: al expirar se pierde el original en
-- alta, no la galería. Este job solo marca; el borrado real lo hace
-- una lifecycle rule o un segundo job, 30 días después (ventana de gracia).
-- ---------------------------------------------------------------------
create or replace function marcar_vencidos() returns integer
language plpgsql as $$
declare n integer;
begin
  update pedidos
     set archivada_en = now()
   where estado = 'listo'
     and archivada_en is null
     and media_expira_en is not null
     and media_expira_en < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Aviso de upsell 30 días antes del vencimiento.
create or replace view por_vencer as
  select id, ocasion, slug, destinatario, comprador_email, comprador_tel, media_expira_en
    from pedidos
   where estado = 'listo'
     and archivada_en is null
     and media_expira_en between now() + interval '30 days'
                             and now() + interval '31 days';

-- Para automatizarlo: Supabase > Database > Cron (pg_cron)
--   select cron.schedule('marcar-vencidos', '0 9 * * *', 'select marcar_vencidos()');
