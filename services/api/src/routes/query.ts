import { z } from 'zod';

/**
 * Helpers per validar i documentar una query amb la mateixa definició (ADR-0011). Els fan servir
 * `GET /recomanacions` i `GET /visibilitat`.
 */

export type Numero = (
  missatge: string,
  rang: { min: number; max: number; int?: boolean },
) => z.ZodNumber;

/**
 * Un número amb el missatge en català per a qualsevol error (tipus, enter i rang). Per validar la
 * query es fa servir `z.coerce.number` (arriba com a text); per documentar-la, `z.number`, perquè
 * l'OpenAPI no el doni per opcional (`z.coerce.number` accepta `null`, que passa a 0).
 */
export const numeroAmb =
  (base: (params: { error: string }) => z.ZodNumber): Numero =>
  (missatge, { min, max, int = false }) => {
    const n = base({ error: missatge });
    return (int ? n.int({ error: missatge }) : n)
      .min(min, { error: missatge })
      .max(max, { error: missatge });
  };

/** Un paràmetre buit (`?lat=`) és un que falta, no un 0 (`Number('')`). */
export const senseBuits = (query: unknown) =>
  typeof query === 'object' && query !== null
    ? Object.fromEntries(
        Object.entries(query).filter(([, v]) => !(typeof v === 'string' && v.trim() === '')),
      )
    : query;
