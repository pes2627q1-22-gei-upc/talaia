-- Expo push tokens dels dispositius de cada perfil (TG-152, ADR-0028). Els escriu l'API
-- (`PUT`/`DELETE /api/v1/perfil/dispositius`) i els llegeix el worker per enviar les alertes.
-- Un perfil pot tenir diversos dispositius; un token només és d'un perfil: si al mateix mòbil hi
-- entra una altra persona, la fila passa al perfil nou (upsert per `token`).

create table public.dispositius_push (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfils(id) on delete cascade,
  token text not null unique,
  plataforma text not null check (plataforma in ('ios', 'android')),
  data_creacio timestamptz not null default now(),
  data_actualitzacio timestamptz not null default now()
);

-- El worker busca els tokens del perfil de cada alerta.
create index dispositius_push_perfil_id_idx on public.dispositius_push (perfil_id);

create trigger dispositius_push_set_data_actualitzacio
  before update on public.dispositius_push
  for each row execute function public.set_data_actualitzacio();

alter table public.dispositius_push enable row level security;
