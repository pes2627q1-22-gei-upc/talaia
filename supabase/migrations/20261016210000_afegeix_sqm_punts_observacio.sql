-- Foscor del cel de cada punt (TG-97, ADR-0020): brillantor del fons del cel al zenit en
-- mag/arcsec² (SQM) segons el mapa de contaminació lumínica de la Generalitat (2024, malla d'1 km).
-- Com més alt, més fosc: 17,5 és cel de ciutat i 21,6 o més, cel fosc natural. null = el punt és
-- fora del mapa (la fórmula de l'índex hi posa la foscor estimada i ho marca, ADR-0018).
-- Els punts oficials l'omplen des del seed (data/scripts/fill-sqm.ts).
alter table public.punts_observacio
  add column sqm numeric(4, 2) check (sqm between 10 and 23);
