import type { Pla } from '@talaia/shared';

/** Pla complet retornat per l’API; només per a proves. */
export const plan: Pla = {
  id: 'plan-1',
  punt: { id: 'montsec', nom: 'Serra del Montsec', municipi: 'Àger', publicat: true },
  esdevenimentId: null,
  dataHoraInici: '2026-10-21T21:15:00.000Z',
  dataHoraFi: '2026-10-22T00:00:00.000Z',
  calendariEventId: null,
  notes: 'Portar el trípode',
  dataCreacio: '2026-10-21T16:00:00.000Z',
  dataActualitzacio: '2026-10-21T16:00:00.000Z',
};
