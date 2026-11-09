-- Alertes personalitzades (HU16, TG-145). Cada alerta és d'un sol perfil i només la veu ell.
-- El worker de notificacions (HU17) hi buscarà les actives amb algun punt dins del radi.

create table public.alertes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfils(id) on delete cascade,
  -- Els valors d'`ObjectiuObservacio` (@talaia/shared). Un `check` i no un enum de Postgres:
  -- afegir un objectiu (la Lluna, ADR-0027) és canviar el `check`, sense `alter type`.
  objectiu text not null check (objectiu in (
    'pluja_estels', 'eclipsi', 'via_lactia', 'posta_sol',
    'sortida_sol', 'cel_estrellat', 'constellacions'
  )),
  -- D'on es mesura la distància, com `punts_observacio.ubicacio`.
  origen extensions.geography(Point, 4326) not null,
  distancia_max_km smallint not null check (distancia_max_km between 1 and 200),
  index_minim smallint not null check (index_minim between 0 and 100),
  -- TG-147 (HU19): una alerta desactivada no notifica.
  activa boolean not null default true,
  data_creacio timestamptz not null default now(),
  data_actualitzacio timestamptz not null default now()
);

-- `GET /alertes` sempre filtra per perfil.
create index alertes_perfil_id_idx on public.alertes (perfil_id);

create trigger alertes_set_data_actualitzacio
  before update on public.alertes
  for each row execute function public.set_data_actualitzacio();

-- Com la resta de taules: RLS sense polítiques. L'API hi entra amb DATABASE_URL (ADR-0013) i
-- els permisos d'anon i authenticated ja els treu 20261022150000_revoca_data_api.
alter table public.alertes enable row level security;
