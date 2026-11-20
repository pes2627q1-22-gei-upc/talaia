-- TG-167 (HU38): esborrar un usuari d'Auth esborra les seves dades i deixa els punts que ha
-- creat sense creador. Amb Supabase local: `npx supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email)
values (
  '11111111-2222-4333-8444-555555555555',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'prova-tg167@example.com'
);
insert into public.perfils (id, auth_user_id, email)
values (
  '66666666-7777-4888-9999-aaaaaaaaaaaa',
  '11111111-2222-4333-8444-555555555555',
  'prova-tg167@example.com'
);
insert into public.punts_observacio (slug, nom, municipi, descripcio, origen, creador_id, ubicacio)
values (
  'prova-tg167', 'Punt de prova', 'Vic', 'Punt comunitari de prova', 'COMUNITAT',
  '66666666-7777-4888-9999-aaaaaaaaaaaa', 'SRID=4326;POINT(2.25 41.93)'
);

select lives_ok(
  $$ delete from auth.users where id = '11111111-2222-4333-8444-555555555555' $$,
  'esborrar un usuari que ha creat un punt comunitari no falla'
);
select is(
  (select count(*)::int from public.perfils where auth_user_id = '11111111-2222-4333-8444-555555555555'),
  0,
  'el perfil cau en cascada'
);
select is(
  (select count(*)::int from public.punts_observacio where slug = 'prova-tg167' and creador_id is null),
  1,
  'el punt es queda al catàleg sense creador'
);
select throws_ok(
  $$ insert into public.punts_observacio (slug, nom, municipi, descripcio, origen, ubicacio)
     values ('prova-tg167-b', 'Sense creador', 'Vic', 'x', 'COMUNITAT', 'SRID=4326;POINT(2.25 41.93)') $$,
  '23514',
  'Un punt de la comunitat necessita creador_id',
  'un punt comunitari nou continua necessitant creador'
);
select lives_ok(
  $$ insert into public.punts_observacio (slug, nom, municipi, descripcio, origen, ubicacio)
     values ('prova-tg167-c', 'Oficial', 'Vic', 'x', 'OFICIAL', 'SRID=4326;POINT(2.25 41.93)') $$,
  'un punt oficial no necessita creador'
);

select * from finish();
rollback;
