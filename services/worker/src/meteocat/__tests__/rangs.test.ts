import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RANGS } from '../ingesta';

/** Columna de `lectures_xema` de cada variable (snake_case de `LecturaXema`). */
const COLUMNA = {
  temperatura: 'temperatura',
  humitat: 'humitat',
  precipitacio: 'precipitacio',
  ventVelocitat: 'vent_velocitat',
  ventDireccio: 'vent_direccio',
  irradiancia: 'irradiancia',
} as const;

const MIGRACIONS = join(__dirname, '../../../../../supabase/migrations');
const migracio = readdirSync(MIGRACIONS).find((f) => f.endsWith('_crea_observacions_xema.sql'));

describe('RANGS i els check de lectures_xema', () => {
  const sql = readFileSync(join(MIGRACIONS, migracio ?? ''), 'utf8');

  it.each(Object.entries(COLUMNA))(
    'el rang de %s és el mateix que el check de la columna',
    (variable, columna) => {
      const check = new RegExp(
        `${columna} real check \\(${columna} between (-?[\\d.]+) and (-?[\\d.]+)\\)`,
      );
      const trobat = check.exec(sql);
      expect(trobat).not.toBeNull();
      expect([Number(trobat?.[1]), Number(trobat?.[2])]).toEqual(
        RANGS[variable as keyof typeof RANGS],
      );
    },
  );
});
