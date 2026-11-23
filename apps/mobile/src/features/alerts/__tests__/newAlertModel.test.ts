import type { Alerta, AlertaNova } from '@talaia/shared';

import { alertChanges, bandOf, kmToTravel, notifyTypeOf, travelToKm } from '../newAlertModel';

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

  describe('alertChanges (HU18)', () => {
    const saved: Alerta = {
      id: 'a1',
      objectiu: 'pluja_estels',
      origen: { lat: 41.387, lon: 2.169 },
      // Desada amb una altra estimació: 37 km no cau just en un pas de la barra.
      distanciaMaxKm: 37,
      indexMinim: 70,
      avisaEnArribar: false,
      horaAvis: 18,
      activa: true,
      dataCreacio: '2026-11-12T19:00:00Z',
      dataActualitzacio: '2026-11-12T19:00:00Z',
    };
    const travel = kmToTravel(saved.distanciaMaxKm);
    const form: AlertaNova = {
      objectiu: saved.objectiu,
      origen: saved.origen,
      distanciaMaxKm: travelToKm(travel),
      indexMinim: saved.indexMinim,
      avisaEnArribar: saved.avisaEnArribar,
      horaAvis: saved.horaAvis,
    };

    it('sense tocar res no hi ha canvis, encara que la distància s’arrodoneixi a la barra', () => {
      expect(form.distanciaMaxKm).not.toBe(saved.distanciaMaxKm);
      expect(alertChanges(saved, form, travel)).toEqual({});
    });

    it('només hi van els camps que canvien', () => {
      const changed = {
        ...form,
        objectiu: 'via_lactia' as const,
        origen: { lat: 42.1, lon: 1.84 },
        indexMinim: 85,
        avisaEnArribar: true,
        horaAvis: null,
      };
      expect(alertChanges(saved, changed, travel)).toEqual({
        objectiu: 'via_lactia',
        origen: { lat: 42.1, lon: 1.84 },
        indexMinim: 85,
        avisaEnArribar: true,
        horaAvis: null,
      });
      expect(alertChanges(saved, { ...form, distanciaMaxKm: 185 }, 240)).toEqual({
        distanciaMaxKm: 185,
      });
    });

    it('si el tipus d’avís és el mateix, només hi va l’hora quan canvia', () => {
      expect(alertChanges(saved, { ...form, horaAvis: 21 }, travel)).toEqual({ horaAvis: 21 });
      // Passar a «a una hora» deixa l'alerta només amb un tipus.
      const reach = { ...saved, avisaEnArribar: true, horaAvis: null };
      expect(alertChanges(reach, form, travel)).toEqual({ avisaEnArribar: false, horaAvis: 18 });
    });

    it('una alerta d’abans amb tots dos avisos és «en arribar» i no canvia si no es toca', () => {
      const both = { ...saved, avisaEnArribar: true, horaAvis: 21 };
      expect(notifyTypeOf(both)).toBe('reach');
      expect(alertChanges(both, { ...form, avisaEnArribar: true, horaAvis: null }, travel)).toEqual(
        {},
      );
    });
  });
});
