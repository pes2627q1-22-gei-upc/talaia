-- Observacions de la XEMA de Meteocat (TG-115, ADR-0025): el que es va mesurar de debò, per
-- contrastar-ho amb la previsió d'Open-Meteo. L'ajust de l'índex amb aquestes dades és TG-184.

-- Estacions operatives de la XEMA. Les escriu el worker un cop al mes.
create table public.estacions_xema (
  -- Codi de Meteocat (`CC`, `UG`…).
  codi text primary key,
  nom text not null,
  ubicacio extensions.geography(Point, 4326) not null,
  altitud real,
  actualitzada_el timestamptz not null default now()
);

create index estacions_xema_ubicacio_idx on public.estacions_xema using gist (ubicacio);

-- Lectures semihoràries de les estacions més properes als punts. Unitats de `LecturaXema`
-- (@talaia/shared): °C, %, mm, km/h, graus i W/m². `null` = no es mesura o no hi ha lectura.
create table public.lectures_xema (
  estacio text not null references public.estacions_xema(codi) on delete cascade,
  -- Instant de la lectura tal com el dona la XEMA, en UTC.
  data timestamptz not null,
  temperatura real,
  humitat real check (humitat between 0 and 100),
  precipitacio real check (precipitacio >= 0),
  vent_velocitat real check (vent_velocitat >= 0),
  vent_direccio real check (vent_direccio between 0 and 360),
  irradiancia real,
  -- Totes les lectures de la fila validades per Meteocat (estat «V»).
  validada boolean not null,
  primary key (estacio, data)
);

-- La neteja de les lectures antigues filtra per data.
create index lectures_xema_data_idx on public.lectures_xema (data);

-- L'estació operativa més propera a cada punt: la tria el worker quan actualitza les estacions.
alter table public.punts_observacio
  add column estacio_xema text references public.estacions_xema(codi) on delete set null;

-- RLS activat i sense polítiques: PostgREST no hi pot llegir ni escriure (ADR-0013).
alter table public.estacions_xema enable row level security;
alter table public.lectures_xema enable row level security;
