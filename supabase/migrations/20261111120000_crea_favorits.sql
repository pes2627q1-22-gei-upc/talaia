-- Punts favorits de cada usuari (TG-169, HU25–HU27). Només els llegeix i els escriu l'API, sempre
-- amb el perfil de l'usuari del JWT: ningú no veu ni toca els favorits d'un altre (RNF06).

create table public.favorits (
  -- Esborrar el compte (TG-167) esborra els seus favorits.
  perfil_id uuid not null references public.perfils(id) on delete cascade,
  -- Retirar un punt (estat diferent de PUBLICAT) no esborra la fila: l'API només llista els
  -- publicats, i si el punt es torna a publicar hi torna a sortir. Només desapareix si s'esborra.
  punt_id uuid not null references public.punts_observacio(id) on delete cascade,
  data_creacio timestamptz not null default now(),
  -- Un punt només hi és un cop per usuari: desar-lo dos cops no en crea cap més.
  primary key (perfil_id, punt_id)
);

-- La clau primària ja cobreix els favorits d'un usuari. Aquest índex és per a l'esborrat en
-- cascada quan s'esborra un punt.
create index favorits_punt_id_idx on public.favorits (punt_id);

-- RLS activat i sense polítiques: PostgREST no hi pot llegir ni escriure (ADR-0013).
alter table public.favorits enable row level security;
