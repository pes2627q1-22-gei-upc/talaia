/**
 * Genera el planning d'un sprint (lliurable de l'assignatura) en .docx amb el format del
 * planning_1: portada amb el logo de la UPC, índex, objectiu, històries planificades, detall de
 * cada història amb les seves tasques, i càrrega per persona.
 *
 *   npm --prefix scripts/sm ci                       # un cop: instal·la `docx`
 *   node scripts/sm/planning/genera-planning.mjs --sprint 3 [--data 2026-11-30] [--sortida .]
 *
 * Les tasques, responsables, dates i hores surten de Taiga; l'objectiu, les fites i el text i els
 * criteris de cada història, de docs/sprint-<N>.md. Si hi ha LibreOffice (`soffice`) i Poppler
 * (`pdftotext`), fa dues passades per posar els números de pàgina a l'índex i en treu el PDF.
 * Les dependències crítiques no surten de cap dada: s'escriuen a mà al document.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LevelSuffix,
  Packer,
  Paragraph,
  ShadingType,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from 'docx';

import { PROFESSOR, TEAM, findSprint, personFromGithub } from '../config.mjs';
import { fetchSprintTasks, fetchStories, fetchStoryTasks } from '../sources.mjs';
import { parseSprintDoc } from './sprint-doc.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const FONT = 'Arial';
const CONTENT = 9026; // A4 (11906) menys 2 marges d'1 polzada
const HEAD_FILL = 'C9DAF8';
const fmt = (hours) => (Number.isInteger(hours) ? String(hours) : String(hours).replace('.', ','));
const dayMonth = (date) => (date ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : '—');
const civil = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

// ---------- dades ----------

const byStartDate = (a, b) =>
  (a.start ?? a.due ?? '9').localeCompare(b.start ?? b.due ?? '9') || a.ref - b.ref;

async function loadData(sprint) {
  const doc = parseSprintDoc(readFileSync(join(ROOT, `docs/sprint-${sprint.number}.md`), 'utf8'));
  const [tasks, taigaStories, management] = await Promise.all([
    fetchSprintTasks(sprint.milestoneId),
    fetchStories({ milestoneId: sprint.milestoneId }),
    fetchStoryTasks(sprint.managementStoryRef),
  ]);
  const ordered = [
    ...doc.stories.filter((story) => taigaStories.some((candidate) => candidate.ref === story.ref)),
    ...taigaStories
      .filter((story) => !doc.stories.some((candidate) => candidate.ref === story.ref))
      .map((story) => ({
        ref: story.ref,
        title: story.subject,
        epic: story.epic ?? '',
        description: '',
        criteria: [],
      })),
  ].filter((story) => story.ref !== sprint.managementStoryRef);

  const stories = ordered.map((story) => {
    const [code, ...rest] = story.title.startsWith('[TEC]')
      ? ['[TEC]', story.title.replace(/^\[TEC\]\s*/, '')]
      : story.title.split(' · ');
    const own = tasks.filter((task) => task.storyRef === story.ref).sort(byStartDate);
    return {
      ...story,
      code,
      name: rest.join(' · '),
      epic: code === '[TEC]' ? 'Tècnica (sense èpica)' : story.epic,
      points: taigaStories.find((candidate) => candidate.ref === story.ref)?.points ?? 0,
      tasks: own,
    };
  });
  const loose = tasks.filter((task) => task.storyRef === null).sort(byStartDate);
  return { doc, stories, loose, management, tasks };
}

// ---------- maquetació ----------

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: border, bottom: border, left: border, right: border };
const C = AlignmentType.CENTER;
const L = AlignmentType.LEFT;

const body = (children, options = {}) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 360 },
    ...options,
    children: typeof children === 'string' ? [new TextRun(children)] : children,
  });
const bold = (text) => new TextRun({ text, bold: true });
const label = (text, spacing = { before: 60, after: 40, line: 300 }) =>
  new Paragraph({
    spacing,
    keepNext: true,
    children: [new TextRun({ text, underline: { type: UnderlineType.SINGLE } })],
  });
const bullet = (text) =>
  new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 40, line: 320 },
    children: [new TextRun(text)],
  });

function cell(content, width, { head = false, bold: isBold = false, align = L } = {}) {
  const runs = Array.isArray(content)
    ? content
    : [new TextRun({ text: String(content), size: 18, bold: isBold })];
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: head ? { fill: HEAD_FILL, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({ alignment: align, spacing: { after: 0, line: 260 }, children: runs }),
    ],
  });
}

function table(widths, header, rows, aligns, total) {
  const row = (values, options) =>
    new TableRow({
      cantSplit: true,
      tableHeader: Boolean(options.head),
      children: values.map((value, index) =>
        cell(value, widths[index], { ...options, align: aligns[index] }),
      ),
    });
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      row(header, { head: true }),
      ...rows.map((values) => row(values, {})),
      ...(total ? [row(total, { bold: true })] : []),
    ],
  });
}

const hoursOf = (tasks) => tasks.reduce((sum, task) => sum + (task.estimated ?? 0), 0);
const hoursCell = (task) => (task.estimated === null ? '—' : fmt(task.estimated));

function taskTable(tasks) {
  return table(
    [900, 4300, 1300, 850, 850, 826],
    ['Ref.', 'Tasca', 'Responsable', 'Inici', 'Límit', 'h'],
    tasks.map((task) => [
      `TG-${task.ref}`,
      task.subject + (task.closed ? ' (ja tancada)' : ''),
      task.person,
      dayMonth(task.start),
      dayMonth(task.due),
      hoursCell(task),
    ]),
    [L, L, L, C, C, C],
    ['', 'Total', '', '', '', fmt(hoursOf(tasks))],
  );
}

function buildDocument({ sprint, data, pages }) {
  const { doc, stories, loose, management } = data;
  const sm = personFromGithub(sprint.sm);
  const totalPoints = stories.reduce((sum, story) => sum + story.points, 0);
  const totalTasks = stories.reduce((sum, story) => sum + story.tasks.length, 0) + loose.length;
  const totalHours = stories.reduce((sum, story) => sum + hoursOf(story.tasks), 0) + hoursOf(loose);
  const userStories = stories.filter((story) => story.code !== '[TEC]').length;
  const logo = readFileSync(join(HERE, 'logo-upc.png'));

  const cover = [
    new Paragraph({
      alignment: C,
      spacing: { before: 4200, after: 240 },
      children: [new TextRun({ text: 'TALAIA', bold: true, size: 52 })],
    }),
    new Paragraph({
      alignment: C,
      spacing: { after: 160 },
      children: [new TextRun({ text: `Planning · Sprint ${sprint.number}`, size: 36 })],
    }),
    new Paragraph({
      alignment: C,
      spacing: { after: 1400 },
      children: [new TextRun({ text: `${civil(sprint.start)} – ${civil(sprint.end)}`, size: 22 })],
    }),
    ...TEAM.map(
      (member) =>
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: member.fullName, bold: true, size: 20 })],
        }),
    ),
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: `Sprint master: ${sm}`, italics: true, size: 20 })],
    }),
    new Paragraph({
      spacing: { after: 360 },
      children: [new TextRun({ text: `Professor: ${PROFESSOR}`, size: 20 })],
    }),
    new Paragraph({
      children: [
        new ImageRun({
          type: 'png',
          data: logo,
          transformation: { width: 183, height: 47 },
          altText: {
            title: 'UPC',
            description: 'Logo de la Universitat Politècnica de Catalunya',
            name: 'logo-upc',
          },
        }),
      ],
    }),
  ];

  const entries = [
    ['1. Objectiu del sprint', 'h1-1', true],
    ['2. Històries planificades', 'h1-2', true],
    ['3. Detall de les històries i tasques', 'h1-3', true],
    ...stories.map((story, index) => [
      `3.${index + 1}. ${story.code} · ${story.name}`,
      `h2-${index + 1}`,
      false,
    ]),
    ...(loose.length
      ? [[`3.${stories.length + 1}. Tasques sense història`, `h2-${stories.length + 1}`, false]]
      : []),
    ['4. Càrrega per persona i dependències', 'h1-4', true],
  ];
  const index = [
    new Paragraph({
      pageBreakBefore: true,
      spacing: { after: 240 },
      children: [new TextRun({ text: 'Índex', bold: true, size: 40 })],
    }),
    ...entries.map(
      ([text, key, top]) =>
        new Paragraph({
          indent: top ? undefined : { left: 400 },
          spacing: { after: top ? 100 : 60, line: 276 },
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }],
          children: [
            new TextRun({ text, bold: top, size: top ? 19 : 18 }),
            new TextRun({ text: `\t${pages[key] ?? ''}`, bold: top, size: top ? 19 : 18 }),
          ],
        }),
    ),
  ];

  const h1 = (text) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      numbering: { reference: 'heads', level: 0 },
      children: [new TextRun(text)],
    });
  const h2 = (text) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      numbering: { reference: 'heads', level: 1 },
      children: [new TextRun(text)],
    });

  const section1 = [
    h1('Objectiu del sprint'),
    body(doc.objective),
    body([
      bold('Compromís: '),
      new TextRun(
        `${fmt(totalPoints)} story points repartits en ${userStories} històries d'usuari i la història tècnica [TEC], amb ${totalTasks} tasques i ${fmt(totalHours)} hores estimades.`,
      ),
    ]),
    body([
      bold("Criteri d'estimació: 1 story point = 1 hora. "),
      new TextRun(
        'Els story points de cada història són la suma de les hores estimades de les seves tasques.',
      ),
    ]),
    body(
      'La història de gestió del sprint ([GES]: cerimònies, PRT, memòria i informes) no forma part del sprint backlog: les seves hores es registren al Project Record Track (PRT).',
    ),
    body([
      bold('Dates: '),
      new TextRun(
        `el sprint va del ${civil(sprint.start)} al ${civil(sprint.end)}. ${doc.milestones}`,
      ),
    ]),
    body(
      `El sprint backlog es gestiona a Taiga (projecte PES_22_C_TALAIA). Les tasques, responsables, dates i hores d'aquest document són les que hi ha registrades al taulell del Sprint ${sprint.number}.`,
    ),
  ];

  const section2 = [
    h1('Històries planificades'),
    body(
      "Aquestes són les històries que formen el sprint backlog, amb l'èpica a la qual pertanyen, els story points, el nombre de tasques i les hores estimades. Com que 1 story point equival a 1 hora, les columnes SP i Hores coincideixen.",
    ),
    table(
      [3000, 3030, 700, 1146, 1150],
      ['Història', 'Èpica', 'SP', 'Tasques', 'Hores'],
      [
        ...stories.map((story) => [
          [
            new TextRun({ text: story.code, bold: true, size: 18 }),
            new TextRun({ text: ` · ${story.name}`, size: 18 }),
          ],
          story.epic,
          fmt(story.points),
          String(story.tasks.length),
          fmt(hoursOf(story.tasks)),
        ]),
        ...loose.map((task) => [
          [
            new TextRun({ text: 'Sense història', bold: true, size: 18 }),
            new TextRun({ text: ` · TG-${task.ref}`, size: 18 }),
          ],
          '—',
          '—',
          '1',
          hoursCell(task),
        ]),
      ],
      [L, L, C, C, C],
      ['Total', '', fmt(totalPoints), String(totalTasks), fmt(totalHours)],
    ),
  ];

  const section3 = [
    h1('Detall de les històries i tasques'),
    body(
      "Per a cada història s'indica l'èpica, la descripció, els criteris d'acceptació i la llista de tasques identificades al planning, amb el responsable, les dates i l'estimació d'hores.",
    ),
  ];
  for (const story of stories) {
    section3.push(
      h2(`${story.code} · ${story.name}`),
      new Paragraph({
        spacing: { after: 60, line: 300 },
        children: [
          bold('Èpica: '),
          new TextRun(`${story.epic} · `),
          bold('Story points: '),
          new TextRun(`${fmt(story.points)} · `),
          bold('Hores: '),
          new TextRun(`${fmt(hoursOf(story.tasks))} h · `),
          bold('Taiga: '),
          new TextRun(`TG-${story.ref}`),
        ],
      }),
    );
    if (story.description) {
      section3.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 60, line: 300 },
          children: [new TextRun({ text: story.description, italics: true })],
        }),
      );
    }
    if (story.criteria.length)
      section3.push(label("Criteris d'acceptació"), ...story.criteria.map(bullet));
    section3.push(
      label('Tasques'),
      taskTable(story.tasks),
      new Paragraph({ spacing: { after: 120 }, children: [] }),
    );
  }
  if (loose.length) {
    section3.push(
      h2('Tasques sense història'),
      body("Correccions que no pengen de cap història d'usuari."),
      taskTable(loose),
    );
  }

  const load = new Map();
  for (const task of [...stories.flatMap((story) => story.tasks), ...loose]) {
    load.set(task.person, (load.get(task.person) ?? 0) + (task.estimated ?? 0));
  }
  const managementLoad = new Map();
  for (const task of management) {
    managementLoad.set(task.person, (managementLoad.get(task.person) ?? 0) + (task.estimated ?? 0));
  }
  const people = [...new Set([...load.keys(), ...managementLoad.keys()])].sort(
    (a, b) => (load.get(b) ?? 0) - (load.get(a) ?? 0) || a.localeCompare(b),
  );
  const managementTotal = [...managementLoad.values()].reduce((sum, hours) => sum + hours, 0);
  const section4 = [
    h1('Càrrega per persona i dependències'),
    label('Hores del sprint backlog per persona (sense [GES])', { before: 240, after: 120 }),
    table(
      [6000, 3026],
      ['Persona', 'Hores'],
      people.map((person) => [person, fmt(load.get(person) ?? 0)]),
      [L, C],
      ['Total', fmt(totalHours)],
    ),
    label('Hores comptant també la gestió del sprint ([GES], registrada al PRT)', {
      before: 240,
      after: 120,
    }),
    table(
      [3400, 2000, 1626, 2000],
      ['Persona', 'Sprint backlog', '[GES]', 'Total'],
      people.map((person) => [
        person,
        fmt(load.get(person) ?? 0),
        managementLoad.get(person) ? fmt(managementLoad.get(person)) : '—',
        fmt((load.get(person) ?? 0) + (managementLoad.get(person) ?? 0)),
      ]),
      [L, C, C, C],
      ['Total', fmt(totalHours), fmt(managementTotal), fmt(totalHours + managementTotal)],
    ),
    body(
      `Tasques [GES]: ${management
        .sort((a, b) => a.ref - b.ref)
        .map(
          (task) =>
            `TG-${task.ref}, ${task.subject.charAt(0).toLowerCase()}${task.subject.slice(1)} (${task.person})`,
        )
        .join('; ')}.`,
      { spacing: { before: 120, after: 160, line: 300 } },
    ),
    label('Dependències crítiques', { before: 240, after: 120 }),
    bullet(
      "Escriu-les aquí: quines tasques en desbloquegen d'altres i amb quina data (p. ex. «TG-145 → TG-146 i TG-147»).",
    ),
  ];

  return new Document({
    creator: 'Talaia',
    title: `talaia_planning_${sprint.number}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { after: 0 } } },
        heading1: {
          run: { font: FONT, size: 40, bold: false, color: '000000' },
          paragraph: { spacing: { before: 400, after: 360 }, keepNext: true, keepLines: true },
        },
        heading2: {
          run: { font: FONT, size: 30, bold: false, color: '000000' },
          paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, keepLines: true },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '●',
              alignment: L,
              style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { size: 18 } },
            },
          ],
        },
        {
          reference: 'heads',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: L,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: '%1.%2.',
              suffix: LevelSuffix.SPACE,
              alignment: L,
              style: { paragraph: { indent: { left: 0, hanging: 0 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [...cover, ...index, ...section1, ...section2, ...section3, ...section4],
      },
    ],
  });
}

// ---------- números de pàgina de l'índex ----------

function findSoffice() {
  for (const candidate of ['soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // no hi és: provem el següent
    }
  }
  return null;
}

/** Converteix el .docx a PDF i hi busca a quina pàgina cau cada encapçalament. */
function headingPages(soffice, docxPath) {
  const outDir = mkdtempSync(join(tmpdir(), 'planning-'));
  execFileSync(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, docxPath], {
    stdio: 'ignore',
  });
  const pdf = join(outDir, basename(docxPath).replace(/\.docx$/, '.pdf'));
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  const pages = {};
  text.split('\f').forEach((page, index) => {
    if (index < 2) return; // portada i índex
    for (const line of page.split('\n').map((value) => value.trim())) {
      const sub = line.match(/^3\.(\d+)\. /);
      if (sub) pages[`h2-${sub[1]}`] ??= index + 1;
      const top = line.match(/^(\d)\.\s?(Objectiu|Històries|Detall|Càrrega)/);
      if (top) pages[`h1-${top[1]}`] ??= index + 1;
    }
  });
  return { pages, pdf };
}

function argument(name) {
  const position = process.argv.indexOf(name);
  return position >= 0 ? process.argv[position + 1] : undefined;
}

async function main() {
  const sprint = findSprint({ number: argument('--sprint') });
  if (!sprint) throw new Error('Indica el sprint: --sprint <N>.');
  const date = argument('--data') ?? sprint.start;
  const out = resolve(argument('--sortida') ?? '.');
  const docxPath = join(out, `${date.replaceAll('-', '')}_talaia_planning_${sprint.number}.docx`);

  const data = await loadData(sprint);
  const write = async (pages) =>
    writeFileSync(docxPath, await Packer.toBuffer(buildDocument({ sprint, data, pages })));
  await write({});

  const soffice = findSoffice();
  if (soffice) {
    const { pages } = headingPages(soffice, docxPath);
    await write(pages);
    const { pdf } = headingPages(soffice, docxPath);
    writeFileSync(docxPath.replace(/\.docx$/, '.pdf'), readFileSync(pdf));
    console.log(
      `Planning desat a ${docxPath} i ${basename(docxPath).replace(/\.docx$/, '.pdf')} (amb l'índex paginat).`,
    );
  } else {
    console.log(
      `Planning desat a ${docxPath}. Sense LibreOffice, l'índex no té números de pàgina.`,
    );
  }
  console.log('Revisa-hi a mà les dependències crítiques (apartat 4) abans de lliurar-lo.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  });
}
