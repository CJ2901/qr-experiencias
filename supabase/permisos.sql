-- =====================================================================
--  ARREGLO DE PERMISOS
--  Pegar completo en Supabase > SQL Editor > New query > Run.
--
--  Necesario cuando el proyecto se creo con "Automatically expose new
--  tables" DESMARCADO: Supabase deja de dar privilegios automaticos a
--  TODOS los roles del Data API, incluida service_role. Por eso el panel
--  y la API no pueden escribir aunque la clave sea correcta.
--
--  Es idempotente: correrlo dos veces no hace dano.
-- =====================================================================

-- 1 · acceso al esquema
grant usage on schema public to anon, authenticated, service_role;

-- 2 · lectura publica (RLS decide DESPUES que filas se ven)
grant select on public.pedidos   to anon, authenticated;
grant select on public.ocasiones to anon, authenticated;

-- 3 · la service_role escribe: es la que usan el panel, la API y Make
grant all on public.pedidos   to service_role;
grant all on public.ocasiones to service_role;
grant all on public.por_vencer to service_role;

-- 4 · lo mismo para las tablas que crees mas adelante,
--     asi no vuelves a toparte con esto
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- 5 · comprobacion: debe listar pedidos y ocasiones con sus privilegios
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as permisos
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated', 'service_role')
 group by table_name, grantee
 order by table_name, grantee;
