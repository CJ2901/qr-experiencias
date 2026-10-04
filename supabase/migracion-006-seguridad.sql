-- =====================================================================
--  migracion-006 · seguridad + retencion unica de 5 anos
--  Pegar completo en Supabase > SQL Editor > New query > Run.
--
--  ORDEN: correr DESPUES de desplegar el codigo que lee la pagina del
--  regalo con supabaseAdmin. Si se corre antes, /[ocasion]/[slug] da 404.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- A · Cerrar la lectura publica de pedidos
-- ---------------------------------------------------------------------

-- Con la anon key (publica) cualquiera podia listar todos los pedidos
-- publicados: email, telefono, carta y rutas de fotos.
drop policy if exists "leer pedidos listos" on public.pedidos;
revoke select on public.pedidos from anon;
-- authenticated conserva SELECT/UPDATE: "cliente ve sus pedidos" y
-- "cliente completa su pedido" lo limitan a lo suyo.

-- Vista con email/telefono, obsoleta sin planes que vencer.
drop view if exists public.por_vencer;

-- Toda tabla nueva nace cerrada; se abre a proposito.
alter default privileges in schema public revoke select on tables from anon, authenticated;

-- ---------------------------------------------------------------------
-- B · Retencion unica de 5 anos y borrado definitivo
-- ---------------------------------------------------------------------

alter table public.pedidos add column if not exists purgado_en timestamptz;

-- Backfill. proteger_pedido_listo bloquea updates sobre pedidos 'listo'
-- fuera de la service_role: se apaga SOLO dentro de esta transaccion.
alter table public.pedidos disable trigger pedidos_proteger;

update public.pedidos set retencion = '60m';
update public.pedidos
   set media_expira_en = creado_en + interval '5 years'
 where estado::text in ('listo', 'archivado');

alter table public.pedidos enable trigger pedidos_proteger;

alter table public.pedidos alter column retencion set default '60m';
alter table public.pedidos drop constraint if exists retencion_unica;
alter table public.pedidos add constraint retencion_unica check (retencion = '60m');

-- El vencimiento lo fija la base, no la app. Una sola vez, al publicar.
create or replace function public.fijar_vencimiento() returns trigger
language plpgsql as $$
begin
  if new.estado::text = 'listo' and new.media_expira_en is null then
    new.media_expira_en := now() + interval '5 years';
  end if;
  return new;
end $$;

drop trigger if exists pedidos_vencimiento on public.pedidos;
create trigger pedidos_vencimiento before insert or update on public.pedidos
  for each row execute function public.fijar_vencimiento();

-- Auditoria de borrados: prueba de cumplimiento, sin contenido del cliente.
create table if not exists public.eliminaciones (
  id           bigint generated always as identity primary key,
  pedido_id    uuid not null,
  archivos     int  not null,
  eliminado_en timestamptz not null default now()
);
alter table public.eliminaciones enable row level security;
revoke all on public.eliminaciones from anon, authenticated;
grant  all on public.eliminaciones to service_role;

-- Se llama DESPUES de borrar los archivos por la API de Storage
-- (app/api/cron/purgar). Borra el contenido personal; conserva precio,
-- pago y email como respaldo contable.
create or replace function public.cerrar_purga(p_pedido uuid, p_archivos int) returns void
language plpgsql security definer set search_path = public as $$
begin
  update pedidos set
    estado = 'archivado', fotos = '[]'::jsonb, foto_final = null,
    voz_url = null, cancion_url = null,
    destinatario = null, pareja = null, frase_principal = null, mensaje = null,
    frase_capitulo = null, frase_brindis = null, frase_final = null, fecha_texto = null,
    comprador_tel = null, purgado_en = now()
  where id = p_pedido and purgado_en is null;

  insert into eliminaciones (pedido_id, archivos) values (p_pedido, p_archivos);
end $$;
revoke all on function public.cerrar_purga(uuid, int) from public, anon, authenticated;
grant execute on function public.cerrar_purga(uuid, int) to service_role;

drop function if exists public.marcar_vencidos();

commit;

-- ---------------------------------------------------------------------
-- Comprobacion. Esperado:
--   anon          -> ocasiones, plantillas (SELECT)
--   authenticated -> ocasiones, plantillas (SELECT) · pedidos (SELECT, UPDATE)
-- ---------------------------------------------------------------------
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as permisos
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon', 'authenticated')
 group by 1, 2 order by 1, 2;
