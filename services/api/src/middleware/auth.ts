import type { Request, RequestHandler } from 'express';
import { createLocalJWKSet, createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';

import { ApiError } from './errors';

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
  role: string;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
};

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export type JwksSource = ReturnType<typeof createLocalJWKSet> | ReturnType<typeof createRemoteJWKSet>;

export type AuthMiddlewareOptions = {
  supabaseUrl?: string;
  jwks?: JwksSource;
};

function isJwksUnavailableError(error: unknown): boolean {
  if (error instanceof joseErrors.JOSEError) {
    return error instanceof joseErrors.JWKSTimeout;
  }

  return true;
}

export function requireAuth({ supabaseUrl, jwks }: AuthMiddlewareOptions = {}): RequestHandler {
  const issuer = supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1` : '';
  const keys = jwks ?? (issuer ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)) : undefined);

  return async (req, _res, next) => {
    if (!supabaseUrl || !issuer || !keys) {
      return next(
        new ApiError(500, 'internal_error', 'Configuració del servidor incompleta (falta SUPABASE_URL)'),
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
      });

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new Error("JWT sense identificador d'usuari");
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
      return next();
    } catch (error) {
      const status = isJwksUnavailableError(error) ? 503 : 401;
      const code = status === 503 ? 'service_unavailable' : 'unauthorized';
      const message =
        status === 503
          ? 'No es pot validar el JWT de Supabase en aquest moment'
          : `JWT invàlid o caducat: ${error instanceof Error ? error.message : ''}`.trim();
      return next(new ApiError(status, code, message));
    }
  };
}
