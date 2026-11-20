-- Índex v2 (TG-184, ADR-0037): la Lluna amagada pel relleu i la humitat corregida amb la XEMA.

-- Versió de la fórmula de cada hora (1 = ADR-0018, 2 = ADR-0037) i si la humitat s'ha corregit
-- amb el biaix de l'estació. Les files que ja hi ha queden com a v1; el primer recàlcul les
-- substitueix per la v2 (les hores passades s'esborren en 24 h).
alter table public.index_visibilitat
  add column versio smallint not null default 1 check (versio >= 1),
  add column humitat_corregida boolean not null default false;

-- Biaix de la humitat de cada estació (ADR-0037): la mediana de la diferència entre la XEMA i
-- Open-Meteo a les hores de nit dels últims 14 dies, o `null` si no n'hi ha prou mostres. Es
-- substitueix cada dia; `biaix_calculat_el` diu fins quan es pot aplicar (7 dies).
alter table public.estacions_xema
  add column biaix_humitat real check (biaix_humitat between -15 and 15),
  add column biaix_mostres smallint,
  add column biaix_calculat_el timestamptz;
