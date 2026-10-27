/** Cos de qualsevol resposta d'error de l'API: `{ error: { code, message } }`. */
export type ApiErrorBody = {
  error: {
    /** Codi estable per a la lògica del client (`not_found`, `validation_error`…). */
    code: string;
    /** Text per a desenvolupadors; l'app tradueix a partir de `code`. */
    message: string;
  };
};

/** `GET /api/v1/health` */
export type HealthResponse = {
  status: 'ok';
  /** Versió de l'API (`services/api/package.json`). */
  version: string;
};
