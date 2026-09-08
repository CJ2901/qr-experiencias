-- =====================================================================
--  MIGRACION 002 · Tienda: pago primero, datos despues
--  Pegar completo en Supabase > SQL Editor > New query > Run.
--  Idempotente: se puede correr varias veces.
--
--  NOTA: las comparaciones de estado van con ::text a proposito. Postgres
--  no permite usar un valor de enum recien anadido dentro de la misma
--  transaccion; comparando como texto el script corre de una sola pasada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Estados nuevos
--     pendiente_pago  -> creado al iniciar el checkout, aun sin cobrar
--     pendiente_datos -> pagado, esperando que el cliente llene el form
--     listo           -> publicado e INMUTABLE para el cliente
-- ---------------------------------------------------------------------
alter type estado_pedido add value if not exists 'pendiente_pago';
alter type estado_pedido add value if not exists 'pendiente_datos';

-- ---------------------------------------------------------------------
-- 2 · Columnas de compra
-- ---------------------------------------------------------------------
alter table pedidos
  add column if not exists comprador_id    uuid references auth.users(id) on delete set null,
  add column if not exists precio_centavos integer,
  add column if not exists moneda          text default 'PEN',
  add column if not exists mp_payment_id   text,
  add column if not exists mp_status       text,
  add column if not exists pagado_en       timestamptz,
  add column if not exists completado_en   timestamptz;

-- Un pago de Mercado Pago no puede generar dos pedidos.
-- Esto es lo que hace idempotente el webhook, que MP reintenta siempre.
create unique index if not exists pedidos_mp_payment_id_key
  on pedidos (mp_payment_id) where mp_payment_id is not null;

create index if not exists pedidos_comprador_idx
  on pedidos (comprador_id, creado_en desc) where comprador_id is not null;

-- ---------------------------------------------------------------------
-- 3 · El contenido ahora llega DESPUES del pago.
--     Con NOT NULL no se puede crear el pedido al cobrar.
-- ---------------------------------------------------------------------
alter table pedidos
  alter column destinatario    drop not null,
  alter column frase_principal drop not null,
  alter column mensaje         drop not null;

-- ---------------------------------------------------------------------
-- 4 · Inmutabilidad, en la base y no solo en la UI.
--     Un pedido 'listo' solo lo puede tocar la service_role (el admin).
-- ---------------------------------------------------------------------
create or replace function proteger_pedido_listo() returns trigger
language plpgsql security definer as $$
begin
  -- la service_role (admin) pasa siempre
  if current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' then
    return new;
  end if;
  if old.estado in ('listo', 'archivado') then
    raise exception 'El pedido ya fue publicado y no se puede editar.'
      using errcode = 'check_violation';
  end if;
  -- el cliente no se puede regalar un cambio de precio ni de dueno
  if new.comprador_id    is distinct from old.comprador_id
  or new.precio_centavos is distinct from old.precio_centavos
  or new.mp_payment_id   is distinct from old.mp_payment_id then
    raise exception 'Campos de compra no editables.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists pedidos_proteger on pedidos;
create trigger pedidos_proteger before update on pedidos
  for each row execute function proteger_pedido_listo();

-- ---------------------------------------------------------------------
-- 5 · RLS para el cliente autenticado
-- ---------------------------------------------------------------------

-- Ve sus propios pedidos en cualquier estado (para "Mis pedidos")
drop policy if exists "cliente ve sus pedidos" on pedidos;
create policy "cliente ve sus pedidos" on pedidos
  for select to authenticated
  using (comprador_id = auth.uid());

-- Solo puede editar mientras esta esperando datos.
-- Al pasar a 'listo' la fila deja de cumplir el USING: nunca mas la toca.
drop policy if exists "cliente completa su pedido" on pedidos;
create policy "cliente completa su pedido" on pedidos
  for update to authenticated
  using (comprador_id = auth.uid() and estado::text = 'pendiente_datos')
  with check (comprador_id = auth.uid() and estado::text in ('pendiente_datos', 'listo'));

-- El cliente NUNCA inserta: los pedidos nacen en el servidor, al cobrar.
grant update on public.pedidos to authenticated;

-- ---------------------------------------------------------------------
-- 6 · Storage: el cliente sube a la carpeta de SU pedido y a ninguna otra
-- ---------------------------------------------------------------------
drop policy if exists "cliente sube a su pedido" on storage.objects;
create policy "cliente sube a su pedido" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'pedidos'
    and exists (
      select 1 from pedidos p
       where p.id::text = (storage.foldername(name))[2]
         and p.comprador_id = auth.uid()
         and p.estado::text = 'pendiente_datos'
    )
  );

drop policy if exists "cliente lee lo suyo" on storage.objects;
create policy "cliente lee lo suyo" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'pedidos'
    and exists (
      select 1 from pedidos p
       where p.id::text = (storage.foldername(name))[2]
         and p.comprador_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 7 · Catalogo: el precio vive en la base, NUNCA lo manda el navegador
-- ---------------------------------------------------------------------
create table if not exists plantillas (
  slug            text primary key,          -- correspondencia, luz-de-vela, ...
  nombre          text not null,
  descripcion     text not null,
  tema            tema_visual not null,
  precio_centavos integer not null,          -- 8900 = S/ 89.00
  moneda          text not null default 'PEN',
  max_fotos       integer not null default 4,
  destacada       boolean not null default false,
  orden           integer not null default 0,
  activa          boolean not null default true
);

insert into plantillas (slug, nombre, descripcion, tema, precio_centavos, max_fotos, destacada, orden) values
  ('correspondencia', 'Correspondencia',
   'Papel de carta, lacre y matasellos. La mas calida de las cuatro.',
   'correspondencia', 6900, 4, false, 1),
  ('luz-de-vela', 'Luz de vela',
   'Fondo de noche con una sola luz calida. Para fotos de fiesta.',
   'luz-de-vela', 8900, 4, true, 2),
  ('herbario', 'Herbario',
   'Salvia, rosa seca y papel de lino. Las fotos se abren como un abanico.',
   'herbario', 8900, 4, false, 3),
  ('editorial', 'Editorial',
   'Blanco, negro y coral. Sin cursivas, sin adornos: solo tus fotos.',
   'editorial', 9900, 4, false, 4)
on conflict (slug) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  precio_centavos = excluded.precio_centavos,
  max_fotos = excluded.max_fotos;

alter table plantillas enable row level security;

drop policy if exists "catalogo publico" on plantillas;
create policy "catalogo publico" on plantillas
  for select to anon, authenticated using (activa);

grant select on public.plantillas to anon, authenticated;
grant all    on public.plantillas to service_role;

-- ---------------------------------------------------------------------
-- 8 · Comprobacion
-- ---------------------------------------------------------------------
select slug, nombre, precio_centavos / 100.0 as precio_soles from plantillas order by orden;
