import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Traduccio = { es: Record<string, unknown>; en: Record<string, unknown> };
type Entrada = { codi: string; textos: Traduccio };

const root = resolve(import.meta.dirname, '../..');
const destination = resolve(
  root,
  'supabase/migrations/20261115104347_afegeix_traduccions_a_dades_existents.sql',
);
const json = <T>(path: string): T => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;
const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const punts = json<Record<string, Traduccio>>('data/traduccions/punts.json');
const importats = json<{
  fenomens: Record<string, Traduccio>;
  esdeveniments: Record<string, Traduccio>;
}>('data/astronomia/traduccions-importades.json');
const calculats = json<{ fenomens: Entrada[]; esdeveniments: Entrada[] }>(
  'data/astronomia/calculats-2026-2027.json',
);

function rows(traduccions: Record<string, Traduccio>): string {
  return Object.entries(traduccions)
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(
      ([key, { es, en }]) =>
        `    (${quote(key)}, ${quote(JSON.stringify(es))}::jsonb, ${quote(JSON.stringify(en))}::jsonb)`,
    )
    .join(',\n');
}

function combined(imported: Record<string, Traduccio>, calculated: Entrada[]) {
  const result = { ...imported };
  for (const { codi, textos } of calculated) {
    if (result[codi] && JSON.stringify(result[codi]) !== JSON.stringify(textos)) {
      throw new Error(`Traduccions contradictòries per a ${codi}`);
    }
    result[codi] = { es: textos.es, en: textos.en };
  }
  return result;
}

function update(table: string, key: string, translations: Record<string, Traduccio>, extra = '') {
  return `update public.${table} as actual
set textos = jsonb_set(
  jsonb_set(actual.textos, '{es}', traduccions.es || case when jsonb_typeof(actual.textos->'es') = 'object' then actual.textos->'es' else '{}'::jsonb end, true),
  '{en}', traduccions.en || case when jsonb_typeof(actual.textos->'en') = 'object' then actual.textos->'en' else '{}'::jsonb end, true
)
from (values
${rows(translations)}
) as traduccions(codi, es, en)
where actual.${key} = traduccions.codi${extra};`;
}

const sql = `-- TG-164: els seeds no s'executen en aplicar migracions a bases ja existents.
-- Només omplim els camps es/en coneguts; preservem el català i les edicions existents.
${update('punts_observacio', 'slug', punts, " and actual.origen = 'OFICIAL'")}

${update('fenomens_astronomics', 'codi', combined(importats.fenomens, calculats.fenomens))}

${update('esdeveniments_astronomics', 'codi', combined(importats.esdeveniments, calculats.esdeveniments))}
`;

if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== sql) {
    throw new Error('La migració de traduccions no coincideix amb les fonts JSON');
  }
} else if (process.argv.includes('--write')) {
  writeFileSync(destination, sql);
} else {
  throw new Error('Indica --write per regenerar la migració o --check per verificar-la');
}
