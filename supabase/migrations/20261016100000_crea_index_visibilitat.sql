-- Índex de visibilitat per punt i hora (TG-98, fórmula v1: ADR-0018). L'escriu el worker cada
-- hora (TG-99) i el llegeixen l'API i el desglossament per factors (HU04). Recalcular una hora
-- substitueix la fila (on conflict (punt_id, hora)).

create table public.index_visibilitat (
  punt_id uuid not null references public.punts_observacio(id) on delete cascade,
  -- Inici de l'hora, en UTC.
  hora timestamptz not null,
  valor smallint not null check (valor between 0 and 100),
  franja text not null check (franja in ('tap', 'jus', 'ras')),
  -- Factors de 0 a 1: { nuvols, sol, foscor, lluna }.
  factors jsonb not null check (jsonb_typeof(factors) = 'object'),
  -- La foscor és provisional fins que hi hagi la del mapa de contaminació lumínica (TG-97).
  foscor_estimada boolean not null,
  calculat_el timestamptz not null default now(),
  primary key (punt_id, hora)
);

-- L'índex de totes les hores d'una franja (el mapa, les recomanacions): la clau primària ja
-- cobreix les consultes per punt.
create index index_visibilitat_hora_idx on public.index_visibilitat (hora);

-- RLS activat i sense polítiques: PostgREST no hi pot llegir ni escriure (ADR-0013).
alter table public.index_visibilitat enable row level security;
