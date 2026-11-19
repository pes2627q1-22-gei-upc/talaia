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
  // Access token d'Expo (TG-154, ADR-0028): cal per enviar les push si el projecte té activada la
  // seguretat reforçada. Opcional: sense ella, s'envia sense capçalera d'autorització.
  EXPO_ACCESS_TOKEN: z.preprocess(buitComAbsent, z.string().optional()),
  // Si el worker envia les push (TG-154). Per defecte no: un worker local contra la BD compartida
  // no ha de notificar usuaris reals. El compose de la VM l'activa (`ENVIA_PUSH=true`).
  ENVIA_PUSH: z.preprocess(
    buitComAbsent,
    z
      .enum(['true', 'false'])
      .default('false')
      .transform((valor) => valor === 'true'),
  ),
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
