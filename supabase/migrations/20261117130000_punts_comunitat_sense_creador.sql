-- TG-167 (HU38): quan un usuari elimina el compte, els punts comunitaris que va crear es queden
-- al catàleg sense creador (`punts_observacio_creador_fk` fa `on delete set null`). El CHECK
-- `punts_observacio_creador_check` ho impedia per sempre: ara només s'exigeix el creador en
-- crear un punt de la comunitat.

alter table public.punts_observacio drop constraint punts_observacio_creador_check;

create function public.punts_observacio_exigeix_creador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origen <> 'OFICIAL' and new.creador_id is null then
    raise exception 'Un punt de la comunitat necessita creador_id'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger punts_observacio_exigeix_creador
  before insert on public.punts_observacio
  for each row execute function public.punts_observacio_exigeix_creador();

revoke execute on function public.punts_observacio_exigeix_creador() from public, anon, authenticated;
