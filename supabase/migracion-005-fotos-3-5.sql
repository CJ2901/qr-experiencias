-- =====================================================================
--  MIGRACION 005 · El carrusel pasa a 3–5 fotos
--  Pegar completo en Supabase > SQL Editor > New query > Run.
--  Idempotente.
--
--  ANTES:   max_fotos = 4  en las cuatro plantillas · no habia minimo
--  DESPUES: max_fotos = 5  en las cuatro plantillas · min_fotos = 3
--
--  El minimo vive en la base y no en el codigo para poder aflojarlo por
--  plantilla sin desplegar (p. ej. una plantilla "express" con 1 foto).
-- =====================================================================

alter table plantillas
  add column if not exists min_fotos integer not null default 3;

update plantillas set max_fotos = 5 where max_fotos < 5;

-- Coherencia: nunca un minimo por encima del maximo.
alter table plantillas drop constraint if exists plantillas_fotos_coherentes;
alter table plantillas add constraint plantillas_fotos_coherentes
  check (min_fotos >= 1 and min_fotos <= max_fotos);

-- ---------------------------------------------------------------------
--  Comprobacion
-- ---------------------------------------------------------------------
select slug, min_fotos, max_fotos from plantillas order by orden;
-- Esperado: las cuatro con min_fotos = 3 y max_fotos = 5.
