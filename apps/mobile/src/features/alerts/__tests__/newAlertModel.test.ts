import { bandOf, kmToTravel, travelToKm } from '../newAlertModel';

describe('newAlertModel', () => {
  it('les franges de l’índex: 0–39 tapat, 40–69 justet, 70–100 cel ras', () => {
    expect([0, 39, 40, 69, 70, 100].map(bandOf)).toEqual([
      'tap',
      'tap',
      'jus',
      'jus',
      'ras',
      'ras',
    ]);
  });

  it('el temps de cotxe es desa en km com a /recomanacions i es torna a llegir igual', () => {
    expect(travelToKm(150)).toBe(115);
    expect(travelToKm(240)).toBe(185);
    for (const minutes of [30, 45, 90, 150, 240]) {
      expect(kmToTravel(travelToKm(minutes))).toBe(minutes);
    }
  });

  it('una distància fora de la barra es mostra al límit més proper', () => {
    expect(kmToTravel(1)).toBe(30);
    expect(kmToTravel(200)).toBe(240);
  });
});
