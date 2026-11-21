/** Regressions del catàleg inicial: GeoJSON versionat -> seed SQL (TG-87, TG-175). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { generarSql } from './build-seed-punts.ts';
import { llegirPunts } from './punts.ts';

const punts = llegirPunts(fileURLToPath(new URL('../punts_observacio.geojson', import.meta.url)));
const sqlVersionat = readFileSync(
  new URL('../../supabase/seeds/01_punts_observacio.sql', import.meta.url),
  'utf8',
);

describe('seed dels punts d’observació', () => {
  it('reprodueix el seed versionat a partir del catàleg i les traduccions', () => {
    assert.equal(generarSql(punts.features), sqlVersionat);
  });

  it('insereix només slugs absents i deixa intactes les files que ja existeixen', () => {
    const sql = generarSql(punts.features);

    assert.match(sql, /on conflict \(slug\) do nothing;/);
    assert.doesNotMatch(sql, /on conflict \(slug\) do update/);
    assert.doesNotMatch(sql, /where punts_observacio\.origen/);
  });
});
