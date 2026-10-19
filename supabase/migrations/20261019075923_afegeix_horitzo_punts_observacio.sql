-- Perfil d'horitzó de cada punt (TG-116, ADR-0022): 360 alçades aparents de l'horitzó en graus, una
-- per grau d'azimut geogràfic (posició 1 = 0° N, posició 91 = 90° E), calculades amb el model
-- d'elevacions de 5 m de l'ICGC. Negatives quan el terreny baixa (un cim, un cingle sobre el mar).
-- null = no calculat. real[] i no numeric[]: el client de Postgres el torna com a number[].
-- Els punts oficials l'omplen des del seed (data/scripts/fill-horitzo.ts).
--
-- El check ha de rebutjar un perfil parcial. `-90 <= all (…)` amb un element null dona null, no
-- false, i un check només rebutja false: per això es busca el null a part. Una sola dimensió que
-- comenci a 1, perquè la posició sigui l'azimut (una malla de 18 × 20 també té 360 elements).
alter table public.punts_observacio
  add column horitzo real[] check (
    cardinality(horitzo) = 360
    and array_ndims(horitzo) = 1
    and array_lower(horitzo, 1) = 1
    and array_position(horitzo, null) is null
    and -90 <= all (horitzo)
    and 90 >= all (horitzo)
  );
