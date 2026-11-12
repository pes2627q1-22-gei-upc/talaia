-- TG-164: els textos traduïts viuen al mateix JSONB que els del calendari astronòmic.
-- Les columnes catalanes es conserven per als escriptors existents (i la futura web admin).
alter table public.punts_observacio add column textos jsonb;

update public.punts_observacio
set textos = jsonb_build_object(
  'ca', jsonb_build_object(
    'nom', nom,
    'descripcio', descripcio,
    'accessibilitat', accessibilitat
  )
);

alter table public.punts_observacio
  alter column textos set not null,
  add constraint punts_observacio_textos_valids
    check (jsonb_typeof(textos) = 'object' and textos ? 'ca');

-- Un alta o edició del text català via les columnes existents manté textos.ca al dia.
create function public.sincronitza_textos_ca_punt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.textos = jsonb_set(
    coalesce(new.textos, '{}'::jsonb),
    '{ca}',
    jsonb_build_object(
      'nom', new.nom,
      'descripcio', new.descripcio,
      'accessibilitat', new.accessibilitat
    ),
    true
  );
  return new;
end;
$$;

revoke execute on function public.sincronitza_textos_ca_punt() from public, anon, authenticated;

create trigger punts_observacio_sincronitza_textos_ca
  before insert or update of nom, descripcio, accessibilitat, textos
  on public.punts_observacio
  for each row execute function public.sincronitza_textos_ca_punt();
