-- =====================================================================
--  MIGRACION 003 · Arregla el indice de mp_payment_id
--  Pegar en Supabase > SQL Editor > New query > Run.
-- =====================================================================
--
--  QUE PASABA
--  En la migracion 002 cree el indice unico como PARCIAL:
--
--      create unique index ... on pedidos (mp_payment_id)
--        where mp_payment_id is not null;
--
--  Postgres no puede inferir un indice parcial en un ON CONFLICT salvo
--  que la sentencia repita el mismo WHERE, y PostgREST no lo emite. Por
--  eso el upsert de /api/pagar moria con:
--
--      42P10: there is no unique or exclusion constraint matching
--             the ON CONFLICT specification
--
--  ...ya con el cobro hecho. El WHERE era innecesario ademas: en un
--  indice unico de Postgres los NULL se consideran distintos entre si,
--  asi que los pedidos creados desde el admin (sin pago) conviven sin
--  chocar.
-- =====================================================================

drop index if exists pedidos_mp_payment_id_key;

create unique index if not exists pedidos_mp_payment_id_key
  on pedidos (mp_payment_id);

-- Comprobacion: 'indpred' debe salir vacio. Si trae algo, sigue siendo parcial.
select indexname,
       indexdef,
       (select indpred is not null
          from pg_index i
          join pg_class c on c.oid = i.indexrelid
         where c.relname = 'pedidos_mp_payment_id_key') as sigue_siendo_parcial
  from pg_indexes
 where tablename = 'pedidos'
   and indexname = 'pedidos_mp_payment_id_key';
