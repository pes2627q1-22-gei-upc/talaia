import type { EfemeridesHora, PrevisioMeteoHora } from '@talaia/shared';

import * as paquet from '../index';
import { GRAUS_PERFIL, alcadaAparent, amagatPelRelleu, horitzoA } from '../horitzo';
import { calculaIndex, factorHumitat, factorLluna, humitatAmbBiaix } from '../formula';

const HORA = '2026-10-16T22:00:00.000Z';

const pla = (alcada: number): number[] => Array.from({ length: GRAUS_PERFIL }, () => alcada);

const meteo = (canvis: Partial<PrevisioMeteoHora> = {}): PrevisioMeteoHora => ({
  hora: HORA,
  nuvolsTotal: 0,
  nuvolsBaixos: 0,
  nuvolsMitjans: 0,
  nuvolsAlts: 0,
  humitat: 60,
  visibilitat: 30_000,
  temperatura: 8,
  puntRosada: 2,
  precipitacio: 0,
  probabilitatPrecipitacio: 0,
  ventVelocitat: 5,
  ventRafegues: 10,
  ventDireccio: 0,
  ...canvis,
});

const efemerides = (llunaAlcada: number, illuminada: number): EfemeridesHora => ({
  hora: HORA,
  sol: { alcada: -40, azimut: 0 },
  crepuscle: 'nit',
  lluna: {
    alcada: llunaAlcada,
    azimut: 120,
    fraccioIlluminada: illuminada,
    angleFase: 0,
    fase: 'plena',
  },
});

describe('perfil d’horitzo (ADR-0037)', () => {
  it('l’alçada aparent suma una refracció petita, més gran a prop de l’horitzó', () => {
    expect(alcadaAparent(0)).toBeGreaterThan(0.4);
    expect(alcadaAparent(0)).toBeLessThan(0.6);
    expect(alcadaAparent(45)).toBeGreaterThan(45);
    expect(alcadaAparent(45) - 45).toBeLessThan(0.02);
  });

  it('una alçada fora de [−90, 90] o no numèrica és un error', () => {
    expect(() => alcadaAparent(91)).toThrow(RangeError);
    expect(() => alcadaAparent(Number.NaN)).toThrow(RangeError);
  });

  it('l’horitzó és el valor del grau i interpola linealment entre graus', () => {
    const perfil = pla(0);
    perfil[10] = 4;
    perfil[11] = 8;
    expect(horitzoA(perfil, 10)).toBe(4);
    expect(horitzoA(perfil, 10.5)).toBe(6);
  });

  it('l’azimut dóna la volta: el 359,5° és entre el 359 i el 0, i els negatius es porten a [0, 360)', () => {
    const perfil = pla(0);
    perfil[359] = 10;
    perfil[0] = 0;
    expect(horitzoA(perfil, 359.5)).toBe(5);
    expect(horitzoA(perfil, -0.5)).toBe(5);
    expect(horitzoA(perfil, 360)).toBe(0);
  });

  it('el perfil ha de tenir 360 valors', () => {
    expect(() => horitzoA([1, 2, 3], 0)).toThrow(RangeError);
  });

  it('sense perfil no hi ha relleu; un astre sota l’horitzó astronòmic no és “amagat”', () => {
    expect(amagatPelRelleu({ alcada: 5, azimut: 0 }, null)).toBe(false);
    expect(amagatPelRelleu({ alcada: -3, azimut: 0 }, pla(20))).toBe(false);
  });

  it('el relleu tapa l’astre quan la seva alçada aparent és sota l’horitzó del perfil', () => {
    const perfil = pla(10);
    expect(amagatPelRelleu({ alcada: 5, azimut: 180 }, perfil)).toBe(true);
    expect(amagatPelRelleu({ alcada: 15, azimut: 180 }, perfil)).toBe(false);
  });
});

describe('índex v2 (ADR-0037): la Lluna amagada i la humitat', () => {
  it('la humitat no toca el cel fins al 85 %; al 100 % el fa un 30 % pitjor; sense dada, 1', () => {
    expect(factorHumitat(85)).toBe(1);
    expect(factorHumitat(92.5)).toBeCloseTo(0.85, 10);
    expect(factorHumitat(100)).toBeCloseTo(0.7, 10);
    expect(factorHumitat(null)).toBe(1);
  });

  it('el biaix de la XEMA es suma a la humitat, es talla a [0, 100] i sense humitat no hi ha res', () => {
    expect(humitatAmbBiaix(60, 3)).toBe(63);
    expect(humitatAmbBiaix(98, 5)).toBe(100);
    expect(humitatAmbBiaix(2, -5)).toBe(0);
    expect(humitatAmbBiaix(60, null)).toBe(60);
    expect(humitatAmbBiaix(null, 3)).toBeNull();
  });

  it('calculaIndex amb humitat al 100 % baixa el valor, marca la versió 2 i no diu que la humitat sigui corregida', () => {
    const i = calculaIndex({
      meteo: meteo({ humitat: 100 }),
      efemerides: efemerides(-10, 0),
      sqm: 21.5,
    });
    expect(i).toMatchObject({ valor: 70, versio: 2, humitatCorregida: false });
    expect(i.factors.humitat).toBeCloseTo(0.7, 10);
  });

  it('calculaIndex amb biaix de la XEMA diu que la humitat és corregida', () => {
    const i = calculaIndex({
      meteo: meteo({ humitat: 60 }),
      efemerides: efemerides(-10, 0),
      sqm: 21.5,
      biaixHumitat: 3,
    });
    expect(i).toMatchObject({ valor: 100, humitatCorregida: true });
  });

  it('la Lluna tapada pel relleu compta la meitat de llum; sense perfil, com a la v1', () => {
    const e = efemerides(20, 1);
    // Lluna plena a 20°: llum = 1 × 20/30 = 2/3, i amagada, la meitat: 1/3.
    expect(factorLluna(e)).toBeCloseTo(1 / 3, 2);
    expect(factorLluna(e, pla(40))).toBeCloseTo(2 / 3, 2);
    expect(factorLluna(e, null)).toBeCloseTo(1 / 3, 2);
  });
});

describe('paquet @talaia/index (ADR-0037)', () => {
  it('exporta la v2 i les funcions de l’horitzo des de l’arrel', () => {
    expect(paquet.FORMULA_V2.llunaAmagada).toBe(0.5);
    expect(paquet.VERSIO_INDEX).toBe(2);
    expect(paquet.GRAUS_PERFIL).toBe(360);
    expect(typeof paquet.amagatPelRelleu).toBe('function');
    expect(typeof paquet.horitzoA).toBe('function');
    expect(typeof paquet.alcadaAparent).toBe('function');
    expect(paquet.humitatAmbBiaix(60, null)).toBe(60);
  });
});
