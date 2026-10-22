/** Regressions de la ingesta IMO/NASA: dataset versionat -> seed SQL (TG-111). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { generarSql, validarCalendari, type Calendari } from './build-seed-astronomia.ts';

const original = JSON.parse(
  readFileSync(new URL('../astronomia/calendaris-2026-2027.json', import.meta.url), 'utf8'),
) as Calendari;
const seedVersionat = readFileSync(
  new URL('../../supabase/seeds/02_calendari_astronomic.sql', import.meta.url),
  'utf8',
);

function copia(): Calendari {
  return structuredClone(original);
}

function primerEsdeveniment(dades: Calendari) {
  const esdeveniment = dades.esdeveniments[0];
  if (!esdeveniment) throw new Error('El dataset de prova no té esdeveniments');
  return esdeveniment;
}

function teError(dades: Calendari, fragment: string): void {
  assert.ok(
    validarCalendari(dades).some((error) => error.includes(fragment)),
    `Falta l'error «${fragment}»`,
  );
  assert.throws(() => generarSql(dades), new RegExp(fragment));
}

describe('ingesta dels calendaris IMO/NASA', () => {
  it('valida el dataset real i reprodueix exactament el seed versionat', () => {
    assert.deepEqual(validarCalendari(original), []);
    assert.equal(generarSql(original), seedVersionat);
    assert.equal(generarSql(original), generarSql(copia()));
  });

  it('genera upserts per codi estable sense actualitzar files idèntiques', () => {
    const sql = generarSql(original);
    assert.equal((sql.match(/on conflict \(codi\) do update set/g) ?? []).length, 3);
    assert.equal((sql.match(/is distinct from/g) ?? []).length, 3);
    assert.ok(
      sql.indexOf('insert into public.fonts_astronomiques') <
        sql.indexOf('insert into public.fenomens_astronomics'),
    );
    assert.ok(
      sql.indexOf('insert into public.fenomens_astronomics') <
        sql.indexOf('insert into public.esdeveniments_astronomics'),
    );
  });

  it('escapa les cometes simples dels textos abans de construir SQL', () => {
    const dades = copia();
    const fenomen = dades.fenomens[0];
    if (!fenomen) throw new Error('El dataset de prova no té fenòmens');
    fenomen.textos.ca.descripcio = "L'estel és visible";
    assert.ok(generarSql(dades).includes("L''estel és visible"));
  });

  it('rebutja codis duplicats i referències a fenòmens o fonts inexistents', () => {
    const duplicat = copia();
    duplicat.esdeveniments.push(structuredClone(primerEsdeveniment(duplicat)));
    teError(duplicat, 'codi duplicat');

    const senseFenomen = copia();
    primerEsdeveniment(senseFenomen).fenomen_codi = 'fenomen-inexistent';
    teError(senseFenomen, 'fenomen desconegut');

    const senseFont = copia();
    primerEsdeveniment(senseFont).font_codi = 'font-inexistent';
    teError(senseFont, 'font desconeguda');
  });

  it('rebutja intervals invertits, màxims fora de rang i ocurrències fora del període', () => {
    const invertit = copia();
    primerEsdeveniment(invertit).fi = primerEsdeveniment(invertit).inici;
    teError(invertit, 'interval o màxim invàlid');

    const maximFora = copia();
    primerEsdeveniment(maximFora).maxim = '2025-01-01T00:00:00Z';
    teError(maximFora, 'interval o màxim invàlid');

    const foraPeriode = copia();
    foraPeriode.periode.des_de = '2028-01-01';
    foraPeriode.periode.fins_a = '2028-12-31';
    teError(foraPeriode, 'fora del període');
  });

  it('rebutja dates inexistents encara que tinguin el format ISO esperat', () => {
    const periode = copia();
    periode.periode.des_de = '2027-02-30';
    teError(periode, 'Període invàlid');

    const instant = copia();
    primerEsdeveniment(instant).inici = '2027-02-30T00:00:00Z';
    teError(instant, 'interval o màxim invàlid');

    const font = copia();
    const primeraFont = font.fonts[0];
    if (!primeraFont) throw new Error('El dataset de prova no té fonts');
    primeraFont.consultat_el = '2027-02-30';
    teError(font, 'font incompleta');
  });

  it('rebutja dades no publicables per a Catalunya, textos absents i precisió contradictòria', () => {
    const noCatala = copia();
    primerEsdeveniment(noCatala).rellevant_catalunya = false;
    teError(noCatala, "dades d'observació incompletes");

    const senseText = copia();
    primerEsdeveniment(senseText).textos.ca.nota_visibilitat = '';
    teError(senseText, "dades d'observació incompletes");

    const precisio = copia();
    primerEsdeveniment(precisio).precisio.maxim = null;
    teError(precisio, 'precisió invàlida');
  });
});
