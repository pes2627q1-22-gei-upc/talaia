/**
 * Perfil de l'usuari autenticat (taula `perfils`, TG-84). `POST /api/v1/perfil` el crea en el primer
 * accés; `GET` i `PATCH /api/v1/perfil` el llegeixen i l'editen (HU36, TG-165). Dates en ISO 8601.
 */
export type Perfil = {
  id: string;
  /** L'usuari de Supabase Auth (`sub` del JWT). */
  authUserId: string;
  email: string | null;
  nom: string | null;
  avatarUrl: string | null;
  dataCreacio: string;
  dataActualitzacio: string;
};

/** Cos de `PATCH /api/v1/perfil`: de moment, només el nom (1–100 caràcters, sense espais als extrems). */
export type PerfilCanvis = {
  nom: string;
};
