import type { FactorsIndex, IndexHora } from '@talaia/shared';
import { z } from 'zod';

/**
 * Esquemes zod (i OpenAPI) de l'índex d'una hora, compartits per `GET /punts/{id}` (la fitxa) i
 * `GET /punts/{id}/index` (el desglossament): un sol `IndexHora` al document.
 */

const Factor = z.number().min(0).max(1);

// Tipats amb els tipus compartits: si l'esquema i @talaia/shared divergeixen, no compila.
export const FactorsSchema: z.ZodType<FactorsIndex> = z.object({
  nuvols: Factor.meta({ description: '1 amb el cel ras; 0 tapat o si plou.' }),
  sol: Factor.meta({
    description: '1 de nit o en el crepuscle astronòmic, 0,5 en el nàutic, 0 en el civil o de dia.',
  }),
  foscor: Factor.meta({
    description: 'Foscor del cel segons la contaminació lumínica: 1 com més fosc.',
  }),
  lluna: Factor.meta({
    description:
      '1 sense Lluna; baixa com més il·luminada i alta és. Amb la v2 (ADR-0036), la Lluna amagada pel relleu fa la meitat de llum.',
  }),
  humitat: Factor.optional().meta({
    description:
      'Índex v2 (ADR-0036): 1 fins al 85 % d’humitat relativa i 0,7 al 100 %. Absent a la v1.',
  }),
});

export const IndexHoraSchema: z.ZodType<IndexHora> = z
  .object({
    hora: z.iso.datetime().meta({
      description: "Inici de l'hora, ISO 8601 en UTC",
      example: '2026-10-19T21:00:00.000Z',
    }),
    valor: z.number().int().min(0).max(100),
    franja: z.enum(['tap', 'jus', 'ras']),
    factors: FactorsSchema.meta({
      description:
        'Els factors de la fórmula (ADR-0018, v1; ADR-0036, v2), de 0 a 1: `índex = 100 × nuvols × sol × (0,6 · foscor + 0,4 · lluna) × humitat`.',
    }),
    foscorEstimada: z.boolean().meta({
      description: 'La foscor és provisional: el punt no té SQM del mapa de contaminació lumínica.',
    }),
    versio: z.number().int().min(1).optional().meta({
      description: 'Versió de la fórmula: 1 (ADR-0018) o 2 (ADR-0036). Absent = 1.',
    }),
    humitatCorregida: z.boolean().optional().meta({
      description:
        'La humitat s’ha corregit amb el biaix de l’estació de la XEMA (cal citar el Servei Meteorològic de Catalunya).',
    }),
  })
  .meta({ id: 'IndexHora' });
