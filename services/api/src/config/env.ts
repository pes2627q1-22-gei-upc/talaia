import { z } from 'zod';
import packageJson from '../../package.json';

const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // Opcional: sense ella l'API arrenca (amb un avís) i /punts respon 503. Buida compta com a absent.
  DATABASE_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .url({ protocol: /^postgres(ql)?$/, error: 'DATABASE_URL ha de ser una URL postgresql://' })
      .optional(),
  ),
  SUPABASE_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().default('http://127.0.0.1:54321'),
  ),
});

export type Env = z.infer<typeof EnvSchema>;

/** Valida les variables d'entorn a l'arrencada: si en falta o n'hi ha una de malament, no arrenca. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variables d'entorn invàlides:
${z.prettifyError(result.error)}`);
  }
  return result.data;
}

// tsup l'inclou dins de dist/server.js: no es llegeix cap fitxer en temps d'execució.
export const version = packageJson.version;
