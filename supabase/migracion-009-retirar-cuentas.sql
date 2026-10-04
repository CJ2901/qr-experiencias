-- =====================================================================
--  migracion-009 · retirar el acceso de clientes con sesion
--  Correr DESPUES de desplegar el codigo nuevo (compra sin cuenta).
--  El cliente ya no entra con magic link: edita con un enlace firmado y
--  todo lo escribe el servidor con la service_role.
--  El panel /admin no usa estas politicas (va con service_role).
-- =====================================================================

begin;

drop policy if exists "cliente ve sus pedidos"     on public.pedidos;
drop policy if exists "cliente completa su pedido" on public.pedidos;
revoke select, update on public.pedidos from authenticated;

drop policy if exists "cliente sube a su pedido" on storage.objects;
drop policy if exists "cliente lee lo suyo"      on storage.objects;

commit;

-- Esperado: pedidos ya no aparece para anon ni authenticated
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as permisos
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon', 'authenticated')
   and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
 group by 1, 2 order by 1, 2;
