import { z } from 'zod';

// Una variable buida al .env (`OPEN_METEO_BASE_URL=`) compta com a no definida.
const buitComAbsent = (valor: unknown) => (valor === '' ? undefined : valor);

const EnvSchema = z.object({
  // Opcional per a les CLI de prova; el procés horari (main.ts) no arrenca sense ella.
  DATABASE_URL: z.preprocess(
    buitComAbsent,
    z
      .url({ protocol: /^postgres(ql)?$/, error: 'DATABASE_URL ha de ser una URL postgresql://' })
      .optional(),
  ),
  // Clau de l'API de Meteocat (TG-115). Opcional: sense ella no s'ingesten les observacions de la XEMA.
  METEOCAT_API_KEY: z.preprocess(buitComAbsent, z.string().optional()),
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
