-- Perfils d'usuari per a l'autenticació de Supabase (TG-84).
-- La relació amb punts_observacio es fa amb creador_id -> perfils.id.

create table public.perfils (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  nom text,
  avatar_url text,
  data_creacio timestamptz not null default now(),
  data_actualitzacio timestamptz not null default now()
);


create trigger perfils_set_data_actualitzacio
  before update on public.perfils
  for each row execute function public.set_data_actualitzacio();

alter table public.perfils enable row level security;

-- Els punts existents poden apuntar a un perfil creat en primer accés sense trencar la taula.
alter table public.punts_observacio
  add constraint punts_observacio_creador_fk
  foreign key (creador_id) references public.perfils(id) on delete set null;
