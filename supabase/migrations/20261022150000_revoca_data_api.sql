-- Ningú no fa servir la Data API de Supabase (PostgREST): l'API i el worker hi entren amb
-- DATABASE_URL (ADR-0013). Totes les taules tenen RLS sense polítiques, però els default
-- privileges de Supabase donen SELECT, INSERT, UPDATE i DELETE a anon i authenticated sobre cada
-- taula nova de public. Si algun dia una taula es crea sense RLS, quedaria oberta a qualsevol
-- amb la clau anon, que és pública dins de l'app. Es treuen els permisos del que ja hi ha i del
-- que es creï a partir d'ara (els objectes nous els crea `postgres`, que és qui aplica les
-- migracions).

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
