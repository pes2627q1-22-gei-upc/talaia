-- TG-107: els esdeveniments calculats no s'atribueixen a un calendari de l'IMO o la NASA.
alter table public.esdeveniments_astronomics
  alter column font_codi drop not null,
  add column metode_calcul text,
  add column detall_calcul jsonb,
  add constraint procedencia_esdeveniment check (
    (font_codi is not null and metode_calcul is null)
    or (font_codi is null and metode_calcul is not null and length(trim(metode_calcul)) > 0)
  );
alter table public.esdeveniments_astronomics
  add constraint detall_calcul_objecte check (detall_calcul is null or jsonb_typeof(detall_calcul) = 'object');

-- Les fases lunars i algunes conjuncions són mensuals; no són ocurrències ocasionals.
alter table public.fenomens_astronomics
  drop constraint fenomens_astronomics_periodicitat_check;
alter table public.fenomens_astronomics
  add constraint fenomens_astronomics_periodicitat_check
  check (periodicitat in ('mensual', 'anual', 'ocasional'));
