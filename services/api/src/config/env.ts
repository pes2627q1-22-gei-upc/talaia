import { z } from 'zod';
import packageJson from '../../package.json';

const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Env = z.infer<typeof EnvSchema>;

/** Valida les variables d'entorn a l'arrencada: si en falta o n'hi ha una de malament, no arrenca. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variables d'entorn invàlides:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

// tsup l'inclou dins de dist/server.js: no es llegeix cap fitxer en temps d'execució.
export const version = packageJson.version;
