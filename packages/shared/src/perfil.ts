/** Rol d'un compte (`perfils.rol`). Es canvia amb SQL: vegeu ADR-0028. */
export type Rol = 'usuari' | 'admin';

/**
 * Perfil de l'usuari autenticat (taula `perfils`, TG-84). `POST /api/v1/perfil` el crea en el primer
 * accés; `GET` i `PATCH /api/v1/perfil` el llegeixen i l'editen (HU36, TG-165). Dates en ISO 8601.
 */
export type Perfil = {
  id: string;
  /** `admin` pot fer servir les rutes de `/api/v1/admin` i entrar a la web d'administració (ADR-0028). */
  rol: Rol;
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

/**
 * Un compte tal com el veu la web d'administració (`GET`/`PATCH /api/v1/admin/usuaris`, HU41).
 * Un compte bloquejat rep 403 `account_blocked` a totes les rutes autenticades (TG-177).
 */
export type UsuariAdmin = Perfil & {
  bloquejat: boolean;
  /** Quan es va bloquejar; `null` si no està bloquejat. */
  dataBloqueig: string | null;
};

/** Cos de `PATCH /api/v1/admin/usuaris/{id}`. */
export type UsuariAdminCanvis = {
  bloquejat: boolean;
};
