import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  EsdevenimentsQuerySchema,
  EsdevenimentsResponseSchema,
} from '../routes/esdeveniments.contract';

const query = (des_de: unknown, fins_a: unknown, tipus?: unknown) =>
  EsdevenimentsQuerySchema.safeParse({ des_de, fins_a, tipus });

describe('contracte de consulta dels esdeveniments', () => {
  it('valida l’exemple de resposta documentat per a Aprop', () => {
    const markdown = readFileSync(
      resolve(__dirname, '../../../../docs/serveis-externs.md'),
      'utf8',
    );
    const exemple = markdown.match(/### Resposta acordada[\s\S]*?```json\n([\s\S]*?)\n```/);
    if (!exemple?.[1]) throw new Error('Falta l’exemple JSON de la resposta al contracte');
    expect(EsdevenimentsResponseSchema.safeParse(JSON.parse(exemple[1])).success).toBe(true);
  });

  it('accepta un dia i fins a 366 dies civils inclosos, també en any de traspàs', () => {
    expect(query('2026-10-25', '2026-10-25').success).toBe(true);
    expect(query('2028-01-01', '2028-12-31', 'eclipsi_llunar').success).toBe(true);
  });

  it('rebutja un interval invertit o de més de 366 dies', () => {
    expect(query('2027-08-31', '2027-08-01').success).toBe(false);
    expect(query('2027-01-01', '2028-01-02').success).toBe(false);
  });

  it('rebutja dates impossibles, valors repetits i tipus desconeguts', () => {
    expect(query('2027-02-30', '2027-03-01').success).toBe(false);
    expect(query(['2027-08-01', '2027-08-02'], '2027-08-31').success).toBe(false);
    expect(query('2027-08-01', '2027-08-31', 'lluna_de_sang').success).toBe(false);
  });

  it('explica els errors de data i de rang en català', () => {
    expect(query('2027-02-30', '2027-03-01').error?.issues[0]?.message).toMatch(/data/);
    expect(query('2027-08-31', '2027-08-01').error?.issues[0]?.message).toMatch(/posterior/);
    expect(query('2027-01-01', '2028-01-02').error?.issues[0]?.message).toMatch(/366 dies/);
  });

  it('no afegeix errors de rang falsos a una data impossible i tradueix el tipus', () => {
    const invalid = query('2027-13-01', '2027-12-01');
    expect(invalid.error?.issues).toHaveLength(1);
    expect(invalid.error?.issues[0]?.message).toMatch(/data/);
    expect(query('2027-08-01', '2027-08-31', 'desconegut').error?.issues[0]?.message).toMatch(
      /categoria/,
    );
  });
});
