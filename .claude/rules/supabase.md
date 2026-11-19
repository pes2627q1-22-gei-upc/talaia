---
paths:
  - "supabase/**"
---

# Migracions i base de dades

- **Ordre de les migracions.** Una migració nova es crea amb `npx supabase migration new <nom>`. Abans de fusionar, el seu timestamp ha de ser posterior a l'última migració de `snapshot`. Si la PR s'ha allargat i `snapshot` n'ha rebut de més noves, cal reanomenar-la: `supabase db push` rebutja les que queden enrere si no es fa servir `--include-all` (#110, #114).
- **Taula nova.** RLS activat i sense polítiques (ADR-0013). L'API hi entra amb `DATABASE_URL`, i la migració `20261022150000_revoca_data_api` ja treu els permisos a `anon` i a `authenticated`.
- **Un `check` que dona NULL deixa passar la fila.** Cal fer servir `coalesce(…)` o un `is null` explícit. Sobre una llista, `-90 <= all(arr)` amb un element null dona null: el null es busca amb `array_position(arr, null) is null`.
- **Claus foranes.** Decideix l'`on delete` (`cascade`, `set null` o `restrict`) i comprova que els `check` de la taula el permeten. A la #137, el `set null` del creador violava un `check`, i esborrar un compte donava 500.
- **Proves de l'SQL.** Els tests de repositori de l'API fan servir `fakeDb` i no executen l'SQL de veritat. La migració es prova amb `npx supabase db reset` en local, o amb un test pgTAP a `supabase/tests/`.
- **Base de dades compartida.** No s'hi fa `db push` sense avisar l'equip. Abans, `supabase migration list --remote`. La migració entra abans que el codi que la fa servir.
