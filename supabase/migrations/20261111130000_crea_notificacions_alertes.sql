-- Notificacions de les alertes (HU17, TG-153, ADR-0028 i ADR-0033). Després de cada recàlcul de
-- l'índex, el worker avalua les alertes actives i hi desa, com a molt una vegada per alerta i
-- nit, el millor punt de la zona que arriba a l'índex mínim. La TG-154 n'envia la notificació
-- push (Expo Push) i omple `enviada_el` i `ticket_ids`.

create table public.notificacions_alertes (
  alerta_id uuid not null references public.alertes(id) on delete cascade,
  -- La nit de 12:00 a 12:00 locals (Europe/Madrid) on cau `hora`, com a TG-104
  -- (`nit.ts` de @talaia/shared): el dia del vespre.
  nit date not null,
  -- El punt que obre la notificació en tocar-la (`data: { puntId }`).
  punt_id uuid not null references public.punts_observacio(id) on delete cascade,
  -- La millor hora (inici, en UTC) i el seu índex quan s'ha avaluat.
  hora timestamptz not null,
  index smallint not null check (index between 0 and 100),
  data_creacio timestamptz not null default now(),
  -- TG-154: quan s'ha enviat (null mentre no) i els tickets d'Expo, per llegir-ne els receipts.
  enviada_el timestamptz,
  ticket_ids text[],
  -- Una per alerta i nit: una execució repetida o solapada fa `on conflict do nothing`.
  primary key (alerta_id, nit)
);

-- RLS sense polítiques, com la resta de taules: només hi entra el worker amb DATABASE_URL
-- (ADR-0013). Els permisos d'anon i authenticated ja els treu 20261022150000_revoca_data_api.
alter table public.notificacions_alertes enable row level security;

-- Cada execució del worker diu també què ha passat amb les alertes, sense tocar l'`estat` de
-- l'índex: un error de les alertes no fa fallar el recàlcul (ADR-0033).
alter table public.execucions_worker
  -- Notificacions noves que ha desat l'execució; null si no ha avaluat les alertes.
  add column notificacions integer check (notificacions >= 0),
  -- Missatge de l'error de l'avaluació (o, amb la TG-154, de l'enviament), si n'hi ha hagut.
  add column error_alertes text;
