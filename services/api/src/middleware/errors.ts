import type { ApiErrorBody } from '@talaia/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, z } from 'zod';

/** Error controlat: arriba al client com a `{ error: { code, message } }` amb aquest status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, 'not_found', `No existeix ${req.method} ${req.path}`));
};

/** Únic lloc on es construeixen les respostes d'error de l'API. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, code, message } = toApiError(err);
  // Un ApiError és un error previst (p. ex. 503 sense base de dades): qui el llança ja n'ha deixat rastre.
  if (status >= 500 && !(err instanceof ApiError)) console.error(err);
  res.status(status).json({ error: { code, message } } satisfies ApiErrorBody);
};

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) return new ApiError(400, 'validation_error', z.prettifyError(err));
  if (isClientHttpError(err)) {
    return err.type === 'entity.parse.failed'
      ? new ApiError(400, 'invalid_json', 'El cos de la petició no és JSON vàlid')
      : new ApiError(err.status, 'bad_request', err.message);
  }
  return new ApiError(500, 'internal_error', 'Error intern del servidor');
}

/** Errors 4xx d'Express i body-parser (JSON mal format, cos massa gran…). */
function isClientHttpError(err: unknown): err is Error & { status: number; type?: string } {
  if (!(err instanceof Error) || !('status' in err) || typeof err.status !== 'number') return false;
  return err.status >= 400 && err.status < 500;
}
