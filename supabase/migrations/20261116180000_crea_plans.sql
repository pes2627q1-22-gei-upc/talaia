-- Plans d'observació de cada usuari (HU12, TG-156): un punt, opcionalment un esdeveniment del
-- calendari, i una data i hora. Només els llegeix i els escriu l'API, sempre amb el perfil de
-- l'usuari del JWT: ningú no veu els plans d'un altre (RNF06).

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  -- Esborrar el compte (TG-167, RGPD) esborra els seus plans: auth.users → perfils → plans.
  perfil_id uuid not null references public.perfils(id) on delete cascade,
  -- Retirar un punt (estat diferent de PUBLICAT) és una baixa lògica: el pla es conserva i continua
  -- sortint a la llista. Només desapareix si el punt s'esborra de debò (vegeu pendents.md).
  punt_id uuid not null references public.punts_observacio(id) on delete cascade,
  -- El mateix identificador que `GET /esdeveniments/{id}` (el `codi`). Opcional: un pla pot no anar
  -- lligat a cap fenomen concret.
  esdeveniment_id text references public.esdeveniments_astronomics(codi) on delete set null,
  data_hora_inici timestamptz not null,
  -- Opcional; el mode nit automàtic (TG-240) la fa servir com a final de la franja.
  data_hora_fi timestamptz,
  -- Id de l'esdeveniment al calendari del mòbil (TG-158, TG-161, TG-162).
  calendari_event_id text check (length(calendari_event_id) between 1 and 255),
  notes text check (length(notes) <= 1000),
  data_creacio timestamptz not null default now(),
  data_actualitzacio timestamptz not null default now(),
  constraint plans_franja_valida check (data_hora_fi is null or data_hora_fi > data_hora_inici)
);

-- «Els meus plans» (TG-160): sempre els d'un perfil, ordenats per data.
create index plans_perfil_data_idx on public.plans (perfil_id, data_hora_inici);
-- Per a l'esborrat en cascada quan s'esborra un punt.
create index plans_punt_id_idx on public.plans (punt_id);

create trigger plans_set_data_actualitzacio
  before update on public.plans
  for each row execute function public.set_data_actualitzacio();

-- RLS activat i sense polítiques: PostgREST no hi pot llegir ni escriure (ADR-0013). L'API hi entra
-- amb DATABASE_URL.
alter table public.plans enable row level security;
