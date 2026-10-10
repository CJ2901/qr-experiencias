-- =====================================================================
--  migracion-010 · cancion elegible para el regalo
--  Correr ANTES de desplegar el codigo: la pagina del regalo y el editor
--  leen esta columna, y sin ella responden 404.
--  Solo AGREGA una columna: no toca datos existentes.
-- =====================================================================

alter table public.pedidos
  add column if not exists musica text;   -- id de lib/canciones.ts; null = sin musica

-- Que la API de Supabase vea la columna nueva de inmediato
-- (sin esto paso "Could not find the column ... in the schema cache").
notify pgrst, 'reload schema';

select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'pedidos' and column_name = 'musica';
