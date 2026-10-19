-- Calendari astronòmic (TG-106). Els codis estables són les claus d'importació.
create table public.tipus_fenomen (
  codi text primary key check (codi ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  nom_ca text not null check (length(trim(nom_ca)) > 0)
);

insert into public.tipus_fenomen (codi, nom_ca) values
  ('pluja_estels', 'Pluja d’estels'),
  ('eclipsi_solar', 'Eclipsi solar'),
  ('eclipsi_llunar', 'Eclipsi lunar'),
  ('fase_llunar', 'Fase lunar'),
  ('conjuncio', 'Conjunció'),
  ('superlluna', 'Superlluna');

create table public.fonts_astronomiques (
  codi text primary key check (codi ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  organitzacio text not null check (organitzacio in ('IMO', 'NASA')),
  titol text not null check (length(trim(titol)) > 0),
  url text not null check (url ~ '^https://'),
  any_publicacio integer check (any_publicacio >= 1900),
  consultat_el date not null
);

create table public.fenomens_astronomics (
  codi text primary key check (codi ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tipus_codi text not null references public.tipus_fenomen(codi),
  periodicitat text not null check (periodicitat in ('anual', 'ocasional')),
  publicable_calendari boolean not null,
  velocitat_km_s numeric check (velocitat_km_s > 0),
  textos jsonb not null check (jsonb_typeof(textos) = 'object' and textos ? 'ca'),
  data_actualitzacio timestamptz not null default now(),
  constraint velocitat_nomes_pluges check (
    (tipus_codi = 'pluja_estels' and velocitat_km_s is not null)
    or (tipus_codi <> 'pluja_estels' and velocitat_km_s is null)
  )
);

create table public.esdeveniments_astronomics (
  codi text primary key check (codi ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  fenomen_codi text not null references public.fenomens_astronomics(codi),
  font_codi text not null references public.fonts_astronomiques(codi),
  referencia_font text,
  inici timestamptz not null,
  fi timestamptz not null,
  maxim timestamptz,
  precisio jsonb not null check (jsonb_typeof(precisio) = 'object'),
  rellevant_catalunya boolean not null check (rellevant_catalunya),
  rellevancia text not null check (rellevancia in ('principal', 'secundari')),
  dificultat_observacio text not null check (dificultat_observacio in ('baixa', 'mitjana', 'alta')),
  zhr jsonb,
  radiant_maxim jsonb,
  textos jsonb not null check (jsonb_typeof(textos) = 'object' and textos ? 'ca'),
  data_actualitzacio timestamptz not null default now(),
  constraint interval_valid check (inici < fi and (maxim is null or maxim between inici and fi)),
  constraint zhr_valida check (zhr is null or
    (jsonb_typeof(zhr) = 'object' and (zhr->>'valor')::numeric >= 0)),
  constraint radiant_valid check (radiant_maxim is null or
    (jsonb_typeof(radiant_maxim) = 'object'
      and (radiant_maxim->>'ascensio_recta_graus')::numeric >= 0
      and (radiant_maxim->>'ascensio_recta_graus')::numeric < 360
      and (radiant_maxim->>'declinacio_graus')::numeric between -90 and 90))
);

create index esdeveniments_astronomics_interval_idx
  on public.esdeveniments_astronomics (inici, fi);
create index esdeveniments_astronomics_fenomen_idx
  on public.esdeveniments_astronomics (fenomen_codi);

create trigger fenomens_astronomics_set_data_actualitzacio
  before update on public.fenomens_astronomics
  for each row execute function public.set_data_actualitzacio();
create trigger esdeveniments_astronomics_set_data_actualitzacio
  before update on public.esdeveniments_astronomics
  for each row execute function public.set_data_actualitzacio();

-- Les consultes passen per l'API amb Kysely, no per PostgREST.
alter table public.tipus_fenomen enable row level security;
alter table public.fonts_astronomiques enable row level security;
alter table public.fenomens_astronomics enable row level security;
alter table public.esdeveniments_astronomics enable row level security;
