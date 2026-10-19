-- Execucions del worker horari (TG-99, ADR-0024). Cada recàlcul de l'índex hi deixa una fila en
-- acabar. L'API fa servir l'última execució correcta com a versió del document del mapa
-- (ADR-0012): quan canvia, regenera el GeoJSON de GET /api/v1/punts i se'n renova l'ETag.

create table public.execucions_worker (
  id bigint generated always as identity primary key,
  iniciada_el timestamptz not null,
  acabada_el timestamptz not null default now(),
  estat text not null check (estat in ('ok', 'error')),
  -- Punts amb l'índex desat i hores desades en total.
  punts integer not null default 0 check (punts >= 0),
  hores integer not null default 0 check (hores >= 0),
  -- Missatge de l'error, si l'execució ha fallat.
  error text,
  check (acabada_el >= iniciada_el)
);

-- L'API només llegeix l'última execució correcta.
create index execucions_worker_ok_idx on public.execucions_worker (acabada_el desc)
  where estat = 'ok';

-- RLS activat i sense polítiques: PostgREST no hi pot llegir ni escriure (ADR-0013).
alter table public.execucions_worker enable row level security;
