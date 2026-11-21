import type { Pla } from '@talaia/shared';

/** Un pla com el retorna `GET /api/v1/plans`. */
export const plan = (overrides: Partial<Pla> = {}): Pla => ({
  id: 'p1',
  punt: { id: 'montsec', nom: 'Serra del Montsec', municipi: 'Àger', publicat: true },
  esdevenimentId: null,
  // Dimecres 21 d'octubre de 2026 a les 23:15 a Catalunya (CEST, UTC+2).
  dataHoraInici: '2026-10-21T21:15:00.000Z',
  dataHoraFi: null,
  calendariEventId: null,
  notes: null,
  dataCreacio: '2026-10-01T10:00:00.000Z',
  dataActualitzacio: '2026-10-01T10:00:00.000Z',
  ...overrides,
});
