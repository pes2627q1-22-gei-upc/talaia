-- Observacions de la XEMA de Meteocat (TG-115, ADR-0025): el que es va mesurar de debò, per
-- contrastar-ho amb la previsió d'Open-Meteo. L'ajust de l'índex amb aquestes dades és TG-184.

-- Estacions de la XEMA. Les escriu el worker un cop al mes. Una estació que deixa de ser
-- operativa no s'esborra: només es marca, i les seves lectures passades es conserven.
create table public.estacions_xema (
  -- Codi de Meteocat (`CC`, `UG`…).
  codi text primary key,
  nom text not null,
  ubicacio extensions.geography(Point, 4326) not null,
  altitud real,
  operativa boolean not null default true,
  actualitzada_el timestamptz not null default now()
);

create index estacions_xema_ubicacio_idx on public.estacions_xema using gist (ubicacio);

-- Lectures semihoràries de les estacions més properes als punts. Unitats de `LecturaXema`
-- (@talaia/shared): °C, %, mm, km/h, graus i W/m². `null` = no es mesura, no hi ha lectura o
-- era fora de rang. Els rangs són els de `RANGS` (services/worker/src/meteocat/ingesta.ts).
create table public.lectures_xema (
  -- Sense cascade: una estació no s'esborra i l'historial no es pot perdre per accident.
  estacio text not null references public.estacions_xema(codi),
  -- Inici de la mitja hora que resumeix la lectura (la XEMA etiqueta per davant), en UTC.
  data timestamptz not null,
  temperatura real check (temperatura between -60 and 60),
  humitat real check (humitat between 0 and 100),
  precipitacio real check (precipitacio between 0 and 500),
  vent_velocitat real check (vent_velocitat between 0 and 500),
  vent_direccio real check (vent_direccio between 0 and 360),
  irradiancia real check (irradiancia between 0 and 2000),
  -- Tots els valors de la fila validats per Meteocat (estat «V»). Les d'ahir encara no ho solen
  -- estar: Meteocat les valida amb dies de retard.
  validada boolean not null,
  primary key (estacio, data)
);

-- La neteja de les lectures antigues filtra per data.
create index lectures_xema_data_idx on public.lectures_xema (data);

-- L'estació operativa més propera a cada punt, només per distància: la tria el worker quan
-- actualitza les estacions. Triar-la també per altitud i per variables mesurades és de TG-184.
alter table public.punts_observacio
  add column estacio_xema text references public.estacions_xema(codi) on delete set null;

-- RLS activat i sense polítiques: PostgREST no hi pot llegir ni escriure (ADR-0013).
alter table public.estacions_xema enable row level security;
alter table public.lectures_xema enable row level security;
