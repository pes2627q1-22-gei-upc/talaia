/** Converteix el calendari normalitzat en un seed SQL idempotent (TG-106).
 * node data/scripts/build-seed-astronomia.ts [--check]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const arrel = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const entrada = resolve(arrel, 'data/astronomia/calendaris-2026-2027.json');
const sortida = resolve(arrel, 'supabase/seeds/02_calendari_astronomic.sql');
const codiValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const formatDia = /^\d{4}-\d\d-\d\d$/;
const formatInstant = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

const diaValid = (valor: string): boolean => {
  const instant = Date.parse(`${valor}T00:00:00Z`);
  return (
    formatDia.test(valor) &&
    Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === valor
  );
};
const instantValid = (valor: string): boolean => {
  const instant = Date.parse(valor);
  return (
    formatInstant.test(valor) &&
    Number.isFinite(instant) &&
    new Date(instant).toISOString() === valor.replace('Z', '.000Z')
  );
};

type Font = {
  codi: string;
  organitzacio: 'IMO' | 'NASA';
  titol: string;
  url: string;
  any_publicacio?: number;
  consultat_el: string;
};
type Fenomen = {
  codi: string;
  tipus: 'pluja_estels' | 'eclipsi_solar' | 'eclipsi_llunar';
  periodicitat: 'anual' | 'ocasional';
  publicable_calendari: boolean;
  velocitat_km_s?: number;
  textos: { ca: { nom: string; descripcio: string; consell_general: string } };
};
type Esdeveniment = {
  codi: string;
  fenomen_codi: string;
  font_codi: string;
  referencia_font?: string;
  inici: string;
  fi: string;
  maxim: string | null;
  precisio: { inici: string; fi: string; maxim: string | null };
  rellevant_catalunya: boolean;
  rellevancia: 'principal' | 'secundari';
  dificultat_observacio: 'baixa' | 'mitjana' | 'alta';
  zhr?: { valor: number; qualificador: string };
  radiant_maxim?: { ascensio_recta_graus: number; declinacio_graus: number };
  textos: { ca: { nota_visibilitat: string; consell_observacio: string } };
};
export type Calendari = {
  versio_esquema: number;
  periode: { des_de: string; fins_a: string };
  fonts: Font[];
  fenomens: Fenomen[];
  esdeveniments: Esdeveniment[];
};

function codiUnic<T extends { codi: string }>(
  entrades: T[],
  nom: string,
  errors: string[],
): Set<string> {
  const codis = new Set<string>();
  for (const entrada of entrades) {
    if (!codiValid.test(entrada.codi)) errors.push(`${nom}: codi invàlid ${entrada.codi}`);
    if (codis.has(entrada.codi)) errors.push(`${nom}: codi duplicat ${entrada.codi}`);
    codis.add(entrada.codi);
  }
  return codis;
}

export function validarCalendari(dades: Calendari): string[] {
  const errors: string[] = [];
  if (
    dades?.versio_esquema !== 1 ||
    !dades.periode ||
    !Array.isArray(dades.fonts) ||
    !Array.isArray(dades.fenomens) ||
    !Array.isArray(dades.esdeveniments)
  ) {
    return ['Estructura o versió del calendari invàlida'];
  }
  const { des_de, fins_a } = dades.periode;
  if (!diaValid(des_de) || !diaValid(fins_a) || des_de > fins_a) {
    errors.push('Període invàlid');
  }
  const fonts = codiUnic(dades.fonts, 'font', errors);
  const fenomens = codiUnic(dades.fenomens, 'fenomen', errors);
  codiUnic(dades.esdeveniments, 'esdeveniment', errors);

  for (const f of dades.fonts) {
    if (
      !['IMO', 'NASA'].includes(f.organitzacio) ||
      !f.titol?.trim() ||
      !f.url?.startsWith('https://') ||
      !diaValid(f.consultat_el)
    ) {
      errors.push(`${f.codi}: font incompleta`);
    }
  }
  for (const f of dades.fenomens) {
    if (
      !['pluja_estels', 'eclipsi_solar', 'eclipsi_llunar'].includes(f.tipus) ||
      !['anual', 'ocasional'].includes(f.periodicitat) ||
      typeof f.publicable_calendari !== 'boolean' ||
      !f.textos?.ca?.nom?.trim() ||
      !f.textos.ca.descripcio?.trim() ||
      !f.textos.ca.consell_general?.trim()
    )
      errors.push(`${f.codi}: fenomen incomplet`);
    if (
      (f.tipus === 'pluja_estels') !==
      (typeof f.velocitat_km_s === 'number' && f.velocitat_km_s > 0)
    ) {
      errors.push(`${f.codi}: velocitat incompatible amb el tipus`);
    }
  }
  for (const e of dades.esdeveniments) {
    if (!fenomens.has(e.fenomen_codi)) errors.push(`${e.codi}: fenomen desconegut`);
    if (!fonts.has(e.font_codi)) errors.push(`${e.codi}: font desconeguda`);
    if (
      !instantValid(e.inici) ||
      !instantValid(e.fi) ||
      (e.maxim !== null && !instantValid(e.maxim)) ||
      !(e.inici < e.fi) ||
      (e.maxim !== null && (e.maxim < e.inici || e.maxim > e.fi))
    ) {
      errors.push(`${e.codi}: interval o màxim invàlid`);
    }
    if (e.fi.slice(0, 10) < des_de || e.inici.slice(0, 10) > fins_a) {
      errors.push(`${e.codi}: fora del període`);
    }
    if (
      !e.precisio ||
      !['dia', 'hora', 'minut', 'segon'].includes(e.precisio.inici) ||
      !['dia', 'hora', 'minut', 'segon'].includes(e.precisio.fi) ||
      (e.precisio.maxim === null) !== (e.maxim === null) ||
      (e.precisio.maxim !== null && !['dia', 'hora', 'minut', 'segon'].includes(e.precisio.maxim))
    ) {
      errors.push(`${e.codi}: precisió invàlida`);
    }
    if (
      e.rellevant_catalunya !== true ||
      !['principal', 'secundari'].includes(e.rellevancia) ||
      !['baixa', 'mitjana', 'alta'].includes(e.dificultat_observacio) ||
      !e.textos?.ca?.nota_visibilitat?.trim() ||
      !e.textos.ca.consell_observacio?.trim()
    ) {
      errors.push(`${e.codi}: dades d'observació incompletes`);
    }
    if (
      e.zhr &&
      (!Number.isFinite(e.zhr.valor) ||
        e.zhr.valor < 0 ||
        !['estimat', 'aproximat', 'minim', 'variable'].includes(e.zhr.qualificador))
    ) {
      errors.push(`${e.codi}: ZHR invàlida`);
    }
    if (
      e.radiant_maxim &&
      (!(e.radiant_maxim.ascensio_recta_graus >= 0 && e.radiant_maxim.ascensio_recta_graus < 360) ||
        !(e.radiant_maxim.declinacio_graus >= -90 && e.radiant_maxim.declinacio_graus <= 90))
    ) {
      errors.push(`${e.codi}: radiant invàlid`);
    }
  }
  return errors;
}

const literal = (valor: string | number | boolean | null | undefined): string =>
  valor === null || valor === undefined
    ? 'null'
    : typeof valor === 'string'
      ? `'${valor.replaceAll("'", "''")}'`
      : String(valor);
const json = (valor: unknown): string =>
  valor === undefined ? 'null' : `${literal(JSON.stringify(valor))}::jsonb`;

function insercio(taula: string, columnes: string[], files: string[][]): string {
  const actualitzables = columnes.filter((c) => c !== 'codi');
  const updates = actualitzables.map((c) => `  ${c} = excluded.${c}`).join(',\n');
  const abans = actualitzables.map((c) => `${taula}.${c}`).join(', ');
  const despres = actualitzables.map((c) => `excluded.${c}`).join(', ');
  return `insert into public.${taula} (${columnes.join(', ')}) values\n${files.map((f) => `  (${f.join(', ')})`).join(',\n')}\non conflict (codi) do update set\n${updates}\nwhere (${abans}) is distinct from (${despres});\n`;
}

export function generarSql(dades: Calendari): string {
  const errors = validarCalendari(dades);
  if (errors.length) throw new Error(errors.join('\n'));
  const fonts = insercio(
    'fonts_astronomiques',
    ['codi', 'organitzacio', 'titol', 'url', 'any_publicacio', 'consultat_el'],
    dades.fonts.map((f) =>
      [f.codi, f.organitzacio, f.titol, f.url, f.any_publicacio, f.consultat_el].map(literal),
    ),
  );
  const fenomens = insercio(
    'fenomens_astronomics',
    ['codi', 'tipus_codi', 'periodicitat', 'publicable_calendari', 'velocitat_km_s', 'textos'],
    dades.fenomens.map((f) => [
      literal(f.codi),
      literal(f.tipus),
      literal(f.periodicitat),
      literal(f.publicable_calendari),
      literal(f.velocitat_km_s),
      json(f.textos),
    ]),
  );
  const esdeveniments = insercio(
    'esdeveniments_astronomics',
    [
      'codi',
      'fenomen_codi',
      'font_codi',
      'referencia_font',
      'inici',
      'fi',
      'maxim',
      'precisio',
      'rellevant_catalunya',
      'rellevancia',
      'dificultat_observacio',
      'zhr',
      'radiant_maxim',
      'textos',
    ],
    dades.esdeveniments.map((e) => [
      literal(e.codi),
      literal(e.fenomen_codi),
      literal(e.font_codi),
      literal(e.referencia_font),
      literal(e.inici),
      literal(e.fi),
      literal(e.maxim),
      json(e.precisio),
      literal(e.rellevant_catalunya),
      literal(e.rellevancia),
      literal(e.dificultat_observacio),
      json(e.zhr),
      json(e.radiant_maxim),
      json(e.textos),
    ]),
  );
  return (
    `-- Generat per data/scripts/build-seed-astronomia.ts. No l'editis a mà.\n` +
    `-- Codis estables: una segona càrrega actualitza i no duplica files.\n\nbegin;\n\n` +
    `${fonts}\n${fenomens}\n${esdeveniments}\ncommit;\n`
  );
}

function main(): void {
  const dades = JSON.parse(readFileSync(entrada, 'utf8')) as Calendari;
  const sql = generarSql(dades);
  if (process.argv.includes('--check')) {
    if (!existsSync(sortida) || readFileSync(sortida, 'utf8') !== sql) {
      throw new Error('El seed no coincideix amb el calendari. Executa el script sense --check.');
    }
    console.log(
      `OK: ${dades.fenomens.length} fenòmens i ${dades.esdeveniments.length} esdeveniments.`,
    );
  } else {
    writeFileSync(sortida, sql);
    console.log(`Escrit ${sortida}.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
