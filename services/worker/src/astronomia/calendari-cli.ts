/** Genera el dataset i el seed de TG-107; --check només compara, sense escriure. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calcularCalendari, type CalendariCalculat } from './calendari';

const arrel = resolve(__dirname, '../../../..');
const destiJson = resolve(arrel, 'data/astronomia/calculats-2026-2027.json');
const destiSql = resolve(arrel, 'supabase/seeds/03_fenomens_calculats.sql');
const sqlText = (valor: string): string => `'${valor.replaceAll("'", "''")}'`;
const sqlJson = (valor: unknown): string => `${sqlText(JSON.stringify(valor))}::jsonb`;

export function generarSql(dades: CalendariCalculat): string {
  const fenomens = dades.fenomens
    .map(
      (f) =>
        `  (${[
          sqlText(f.codi),
          sqlText(f.tipus_codi),
          sqlText(f.periodicitat),
          'true',
          sqlJson(f.textos),
        ].join(', ')})`,
    )
    .join(',\n');
  const esdeveniments = dades.esdeveniments
    .map(
      (e) =>
        `  (${[
          sqlText(e.codi),
          sqlText(e.fenomen_codi),
          sqlText(e.metode_calcul),
          sqlText(e.inici),
          sqlText(e.fi),
          sqlText(e.maxim),
          sqlJson(e.precisio),
          'true',
          sqlText(e.rellevancia),
          sqlText(e.dificultat_observacio),
          sqlJson(e.textos),
          e.detall_calcul ? sqlJson(e.detall_calcul) : 'null',
        ].join(', ')})`,
    )
    .join(',\n');
  if (!fenomens || !esdeveniments) throw new Error('El calendari calculat és buit');
  return (
    `-- Generat per @talaia/worker astronomia:calendari. No l'editis a mà.\n` +
    `-- Procedència: Astronomy Engine; el seed 02 conserva les fonts IMO/NASA.\n\nbegin;\n\n` +
    `insert into public.fenomens_astronomics (codi, tipus_codi, periodicitat, publicable_calendari, textos) values\n${fenomens}\n` +
    `on conflict (codi) do update set\n` +
    `  tipus_codi = excluded.tipus_codi, periodicitat = excluded.periodicitat,\n` +
    `  publicable_calendari = excluded.publicable_calendari, textos = excluded.textos\n` +
    `where (fenomens_astronomics.tipus_codi, fenomens_astronomics.periodicitat, fenomens_astronomics.publicable_calendari, fenomens_astronomics.textos)\n` +
    `  is distinct from (excluded.tipus_codi, excluded.periodicitat, excluded.publicable_calendari, excluded.textos);\n\n` +
    `insert into public.esdeveniments_astronomics\n` +
    `  (codi, fenomen_codi, metode_calcul, inici, fi, maxim, precisio, rellevant_catalunya, rellevancia, dificultat_observacio, textos, detall_calcul) values\n${esdeveniments}\n` +
    `on conflict (codi) do update set\n` +
    `  fenomen_codi = excluded.fenomen_codi, font_codi = null, metode_calcul = excluded.metode_calcul,\n` +
    `  inici = excluded.inici, fi = excluded.fi, maxim = excluded.maxim, precisio = excluded.precisio,\n` +
    `  rellevant_catalunya = excluded.rellevant_catalunya, rellevancia = excluded.rellevancia,\n` +
    `  dificultat_observacio = excluded.dificultat_observacio, textos = excluded.textos,\n` +
    `  detall_calcul = excluded.detall_calcul\n` +
    `where (esdeveniments_astronomics.fenomen_codi, esdeveniments_astronomics.font_codi, esdeveniments_astronomics.metode_calcul, esdeveniments_astronomics.inici, esdeveniments_astronomics.fi, esdeveniments_astronomics.maxim, esdeveniments_astronomics.precisio, esdeveniments_astronomics.rellevant_catalunya, esdeveniments_astronomics.rellevancia, esdeveniments_astronomics.dificultat_observacio, esdeveniments_astronomics.textos, esdeveniments_astronomics.detall_calcul)\n` +
    `  is distinct from (excluded.fenomen_codi, null, excluded.metode_calcul, excluded.inici, excluded.fi, excluded.maxim, excluded.precisio, excluded.rellevant_catalunya, excluded.rellevancia, excluded.dificultat_observacio, excluded.textos, excluded.detall_calcul);\n\ncommit;\n`
  );
}

function main(): void {
  const dades = calcularCalendari();
  const codis = new Set(dades.esdeveniments.map((e) => e.codi));
  if (codis.size !== dades.esdeveniments.length) throw new Error('Codis d’esdeveniment duplicats');
  const sortides = [
    [destiJson, `${JSON.stringify(dades, null, 2)}\n`],
    [destiSql, generarSql(dades)],
  ] as const;
  for (const [ruta, contingut] of sortides) {
    if (process.argv.includes('--check')) {
      if (!existsSync(ruta) || readFileSync(ruta, 'utf8') !== contingut)
        throw new Error(`${ruta} no coincideix amb el generador`);
    } else writeFileSync(ruta, contingut);
  }
  console.log(
    `OK: ${dades.fenomens.length} fenòmens, ${dades.esdeveniments.length} esdeveniments calculats.`,
  );
}

if (require.main === module) main();
