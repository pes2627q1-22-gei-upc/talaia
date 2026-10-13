-- Punts d'observació del catàleg (TG-86). Accés des del codi: @talaia/db (ADR-0013).

-- Manté data_actualitzacio al dia a cada update. Serveix per a totes les taules que la tinguin.
create function public.set_data_actualitzacio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.data_actualitzacio = now();
  return new;
end;
$$;

-- Supabase dona EXECUTE a anon i authenticated sobre les funcions noves de public. El trigger no el necessita.
revoke execute on function public.set_data_actualitzacio() from public, anon, authenticated;

create table public.punts_observacio (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nom text not null,
  municipi text not null,
  descripcio text not null,
  -- Metres sobre el nivell del mar.
  altitud integer,
  -- Direccions amb l'horitzó obert (aproximat). El perfil real el calcula TG-116.
  -- Si no és clar, null (no una llista buida).
  horitzo_obert text[]
    check (
      horitzo_obert <@ array['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']::text[]
      and cardinality(horitzo_obert) > 0
    ),
  accessibilitat text,
  origen text not null check (origen in ('OFICIAL', 'COMUNITAT')),
  estat text not null default 'PENDENT'
    check (estat in ('PENDENT', 'PUBLICAT', 'REBUTJAT', 'DESACTIVAT')),
  -- FK a la taula de perfils quan TG-84 la creï.
  creador_id uuid,
  ubicacio extensions.geography(Point, 4326) not null,
  data_creacio timestamptz not null default now(),
  data_actualitzacio timestamptz not null default now(),
  constraint punts_observacio_creador_check
    check (origen = 'OFICIAL' or creador_id is not null)
);

create index punts_observacio_ubicacio_idx
  on public.punts_observacio using gist (ubicacio);

create trigger punts_observacio_set_data_actualitzacio
  before update on public.punts_observacio
  for each row execute function public.set_data_actualitzacio();

-- RLS activat i sense polítiques: PostgREST no hi pot llegir ni escriure (ADR-0013).
alter table public.punts_observacio enable row level security;
