import type { Request, RequestHandler } from 'express';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { AccountStatus } from '../services/profileService';
import { ApiError } from './errors';

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
  role: string;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  /** Rol i bloqueig del perfil, quan `requireAuth` té `accountStatus`. */
  account?: AccountStatus | null;
};

/** D'on surten les claus: el JWKS remot de Supabase o, als tests, `createLocalJWKSet`. */
export type JwksSource = JWTVerifyGetKey;

export type AuthMiddlewareOptions = {
  supabaseUrl?: string;
  jwks?: JwksSource;
  /**
   * Amb aquesta funció, `requireAuth` llegeix el perfil després de validar el JWT i rebutja amb 403
   * `account_blocked` els comptes bloquejats (TG-177). La passen totes les rutes d'usuari; només
   * `/esdeveniments`, que és pública per a Aprop, no la fa servir.
   */
  accountStatus?: (authUserId: string) => Promise<AccountStatus | null>;
};

/** Errors que vénen del token. Qualsevol altre (JWKS caigut, 5xx, xarxa) és 503, no 401. */
const TOKEN_ERRORS = [
  joseErrors.JWTExpired,
  joseErrors.JWTClaimValidationFailed,
  joseErrors.JWSSignatureVerificationFailed,
  joseErrors.JWSInvalid,
  joseErrors.JWTInvalid,
  joseErrors.JWKSNoMatchingKey,
  // Token sense `kid` quan el JWKS té més d'una clau (durant una rotació).
  joseErrors.JWKSMultipleMatchingKeys,
  joseErrors.JOSEAlgNotAllowed,
  // Capçalera amb un `crit` que jose no coneix.
  joseErrors.JOSENotSupported,
];

function isTokenError(error: unknown): boolean {
  return TOKEN_ERRORS.some((tokenError) => error instanceof tokenError);
}

export function requireAuth({
  supabaseUrl,
  jwks,
  accountStatus,
}: AuthMiddlewareOptions = {}): RequestHandler {
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

      // `requiredClaims` només garanteix que hi és: amb `sub: 123` la BD fallaria en convertir-lo a uuid.
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        return next(new ApiError(401, 'unauthorized', 'JWT invàlid o caducat'));
      }

      const user: AuthenticatedUser = {
        id: payload.sub,
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

    const userId = (req as AuthenticatedRequest).user?.id;
    if (!accountStatus || !userId) return next();
    try {
      const account = await accountStatus(userId);
      if (account?.bloquejat) return next(accountBlocked());
      (req as AuthenticatedRequest).account = account;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** Codi estable: l'app el reconeix per mostrar l'avís de compte bloquejat (TG-179). */
const accountBlocked = () =>
  new ApiError(
    403,
    'account_blocked',
    "Aquest compte està bloquejat per l'administració de Talaia",
  );

/** Després d'un `requireAuth` amb `accountStatus`: només deixa passar els administradors. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const { account } = req as AuthenticatedRequest;
  if (account?.rol !== 'admin') {
    return next(new ApiError(403, 'forbidden', 'Cal un compte amb rol d’administrador'));
  }
  return next();
};
