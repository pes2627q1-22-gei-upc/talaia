import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { ApiErrorBody } from '@talaia/shared';
import { z } from 'zod';

/**
 * Font única de l'OpenAPI (ADR-0011): cada router hi registra les seves rutes amb els
 * mateixos esquemes zod que fa servir per validar.
 */
export const registry = new OpenAPIRegistry();

export const ErrorSchema: z.ZodType<ApiErrorBody> = z
  .object({ error: z.object({ code: z.string(), message: z.string() }) })
  .meta({ id: 'Error' });

export function buildOpenApiDocument(version: string) {
  return new OpenApiGeneratorV3([
    ...registry.definitions,
    { type: 'schema', schema: ErrorSchema },
  ]).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Talaia API',
      version,
      description: 'On i quan observar el cel a Catalunya. Errors: `{ error: { code, message } }`.',
    },
    servers: [{ url: '/api/v1' }],
  });
}
