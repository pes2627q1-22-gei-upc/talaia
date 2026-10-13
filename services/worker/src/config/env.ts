import { z } from 'zod';

// Una variable buida al .env (`OPEN_METEO_BASE_URL=`) compta com a no definida.
const buitComAbsent = (valor: unknown) => (valor === '' ? undefined : valor);

const EnvSchema = z.object({
  OPEN_METEO_BASE_URL: z.preprocess(
    buitComAbsent,
    z.url().default('https://api.open-meteo.com/v1'),
  ),
});

export type Env = z.infer<typeof EnvSchema>;

/** Valida les variables d'entorn a l'arrencada: si n'hi ha una de malament, el worker no arrenca. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variables d'entorn invàlides:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
