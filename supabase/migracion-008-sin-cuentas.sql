-- =====================================================================
--  migracion-008 · compra sin cuenta: marcas de correo
--  Correr ANTES de desplegar el codigo nuevo. Solo AGREGA columnas e
--  indices: el sitio actual sigue funcionando igual.
-- =====================================================================

begin;

alter table public.pedidos
  add column if not exists correo_enlace_en  timestamptz,  -- correo 1: enlace para editar
  add column if not exists correo_qr_en      timestamptz,  -- correo 2: QR + enlace del regalo
  add column if not exists correo_reenvio_en timestamptz;  -- ultimo "reenviar mi enlace" (limite)

-- "Reenviar mi enlace" busca por correo; sin cuentas, el correo es la identidad.
-- Los correos nuevos se guardan en minusculas; se normalizan los antiguos.
-- (proteger_pedido_listo bloquea updates sobre pedidos publicados fuera de
--  la service_role: se apaga SOLO dentro de esta transaccion)
alter table public.pedidos disable trigger pedidos_proteger;
update public.pedidos set comprador_email = lower(comprador_email)
 where comprador_email is not null and comprador_email <> lower(comprador_email);
alter table public.pedidos enable trigger pedidos_proteger;

create index if not exists pedidos_comprador_email_idx
  on public.pedidos (comprador_email, creado_en desc)
  where comprador_email is not null;

commit;

select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'pedidos'
   and column_name like 'correo_%' order by 1;
