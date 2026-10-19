import type { Request, RequestHandler } from 'express';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from 'jose';

import { ApiError } from './errors';

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
  role: string;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
};

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** D'on surten les claus: el JWKS remot de Supabase o, als tests, `createLocalJWKSet`. */
export type JwksSource = JWTVerifyGetKey;

export type AuthMiddlewareOptions = {
  supabaseUrl?: string;
  jwks?: JwksSource;
};

/** Errors que vénen del token. Qualsevol altre (JWKS caigut, 5xx, xarxa) és 503, no 401. */
const TOKEN_ERRORS = [
  joseErrors.JWTExpired,
  joseErrors.JWTClaimValidationFailed,
  joseErrors.JWSSignatureVerificationFailed,
  joseErrors.JWSInvalid,
  joseErrors.JWTInvalid,
  joseErrors.JWKSNoMatchingKey,
  joseErrors.JOSEAlgNotAllowed,
];

function isTokenError(error: unknown): boolean {
  return TOKEN_ERRORS.some((tokenError) => error instanceof tokenError);
}

export function requireAuth({ supabaseUrl, jwks }: AuthMiddlewareOptions = {}): RequestHandler {
  const issuer = supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1` : '';
  const keys =
    jwks ?? (issuer ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)) : undefined);

  return async (req, _res, next) => {
    if (!supabaseUrl || !issuer || !keys) {
      return next(
        new ApiError(
          500,
          'internal_error',
          'Configuració del servidor incompleta (falta SUPABASE_URL)',
        ),
      );
    }

    const authHeader = req.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new ApiError(401, 'unauthorized', 'Falta el token JWT de Supabase'));
    }

    const token = authHeader.slice('Bearer '.length).trim();

    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256'],
        requiredClaims: ['sub', 'exp'],
      });

      const user: AuthenticatedUser = {
        // `requiredClaims` garanteix que hi és, i jose comprova que és una cadena.
        id: String(payload.sub),
        email: typeof payload.email === 'string' ? payload.email : null,
        role: typeof payload.role === 'string' ? payload.role : 'authenticated',
        appMetadata:
          typeof payload.app_metadata === 'object'
            ? (payload.app_metadata as Record<string, unknown>)
            : undefined,
        userMetadata:
          typeof payload.user_metadata === 'object'
            ? (payload.user_metadata as Record<string, unknown>)
            : undefined,
      };

      (req as AuthenticatedRequest).user = user;
      return next();
    } catch (error) {
      if (isTokenError(error)) {
        return next(new ApiError(401, 'unauthorized', 'JWT invàlid o caducat'));
      }
      return next(
        new ApiError(
          503,
          'service_unavailable',
          'No es pot validar el JWT de Supabase en aquest moment',
        ),
      );
    }
  };
}
