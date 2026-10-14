import { colors } from '@/core/theme/tokens';

import { windowLight } from '../../WelcomeIllustration';
import { constellationJoins, METEOR, meteorAt, noise } from '../sky';
import { SKY_COLORS, skyEffect } from '../skyShader';
import { beamAngle, beamIntensity, beat, flare, introStart, SHORT_START, TL } from '../timeline';

describe('línia de temps de la intro', () => {
  it('beat va de 0 a 1 dins del seu tram i aplica la corba', () => {
    expect(beat(0, 100, 200)).toBe(0);
    expect(beat(200, 100, 200)).toBe(0.5);
    expect(beat(999, 100, 200)).toBe(1);
    expect(beat(200, 100, 200, (p) => p * p)).toBe(0.25);
  });

  it('cada mode comença en un punt diferent', () => {
    expect(introStart('full')).toBe(0);
    expect(introStart('short')).toBe(SHORT_START);
    expect(introStart('still')).toBe(TL.end);
  });

  it('el feix escombra el cel de dreta a esquerra i només brilla mentre ho fa', () => {
    expect(beamAngle(0)).toBe(-15);
    expect(beamAngle(TL.end)).toBe(-165);
    expect(beamIntensity(TL.beam)).toBe(0);
    expect(beamIntensity(TL.beam + TL.beamFor / 2)).toBe(1);
    expect(beamIntensity(TL.end)).toBe(0);
  });

  it("l'esclat de l'estel de la torre puja de cop i es queda en un resplendor", () => {
    expect(flare(TL.ignite)).toBe(0);
    expect(flare(TL.ignite + 80)).toBeGreaterThan(1);
    expect(flare(TL.end)).toBeCloseTo(0.35, 1);
  });
});

describe('cel de la intro', () => {
  it('el soroll és estable i entre 0 i 1', () => {
    expect(noise(3, 1)).toBe(noise(3, 1));
    expect(noise(3, 1)).not.toBe(noise(4, 1));
    for (let i = 0; i < 50; i++) {
      expect(noise(i, 2)).toBeGreaterThanOrEqual(0);
      expect(noise(i, 2)).toBeLessThan(1);
    }
  });

  it('Cassiopea uneix els seus cinc estels en quatre traços', () => {
    expect(constellationJoins()).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('passa un estel fugaç cada tant, i sempre el mateix en el mateix moment', () => {
    expect(meteorAt(500, 1000)).toBeNull();
    const meteor = meteorAt(1000 + METEOR.duration / 2, 1000);
    expect(meteor?.progress).toBe(0.5);
    expect(meteorAt(1000 + METEOR.duration / 2, 1000)).toEqual(meteor);
    expect(meteorAt(1000 + METEOR.duration + 100, 1000)).toBeNull();
    expect(meteorAt(1000 + METEOR.every, 1000)?.progress).toBe(0);
  });

  it('el shader del cel compila i els seus colors surten dels tokens', () => {
    expect(skyEffect).not.toBeNull();
    expect(skyEffect?.getUniformCount()).toBeGreaterThan(0);
    const pack = ([r, g, b]: readonly [number, number, number]) =>
      (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    expect(pack(SKY_COLORS.cStar)).toBe(Number.parseInt(colors.lluna.slice(1), 16));
    expect(pack(SKY_COLORS.cBeam)).toBe(Number.parseInt(colors.far.slice(1), 16));
  });
});

describe('la finestra de la torre', () => {
  it("s'encén amb un parpelleig i després queda encesa", () => {
    expect(windowLight(TL.window, 0, true)).toBe(0);
    expect(windowLight(TL.window + 90, 0, true)).toBe(1);
    expect(windowLight(TL.window + 180, 0, true)).toBeCloseTo(0.35);
    expect(windowLight(TL.window + 1000, 0, true)).toBe(1);
  });

  it('un cop acabada la intro, respira; amb «reduir moviment», no', () => {
    expect(windowLight(TL.end, 900, false)).toBeLessThan(1);
    expect(windowLight(TL.end, 900, true)).toBe(1);
  });
});
