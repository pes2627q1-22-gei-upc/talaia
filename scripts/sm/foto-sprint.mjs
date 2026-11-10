/**
 * Foto diària del sprint: punts pendents, tasques i hores estimades i reals per persona, tal com
 * són a Taiga avui. El workflow sm-foto-sprint la desa cada nit com a artefacte (90 dies), i
 * informe-sprint.mjs les ajunta per als gràfics del report.
 *
 *   node scripts/sm/foto-sprint.mjs [--sortida foto-sprint] [--data AAAA-MM-DD] [--sprint N]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findSprint, localDate } from './config.mjs';
import { fetchMilestoneStats, fetchSprintTasks } from './sources.mjs';

const sum = (values) => values.reduce((total, value) => total + (value ?? 0), 0);

export function toCsv(rows) {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${rows.map((row) => row.map(escape).join(',')).join('\n')}\n`;
}

/** Files de la foto: una del sprint i una per persona. Funció pura. */
export function summarize({ date, sprint, tasks, stats }) {
  const day = stats?.days?.find((candidate) => candidate.day === date);
  const totalPoints = sum(Object.values(stats?.total_points ?? {}));
  const sprintRow = [
    date,
    sprint.number,
    totalPoints,
    day?.open_points ?? '',
    day?.optimal_points ?? '',
    tasks.length,
    tasks.filter((task) => task.closed).length,
    sum(tasks.map((task) => task.estimated)),
    sum(tasks.map((task) => task.real)),
  ];
  const people = [...new Set(tasks.map((task) => task.person))].sort();
  const personRows = people.map((person) => {
    const own = tasks.filter((task) => task.person === person);
    return [
      date,
      sprint.number,
      person,
      own.length,
      own.filter((task) => task.closed).length,
      sum(own.map((task) => task.estimated)),
      sum(own.map((task) => task.real)),
    ];
  });
  return { sprintRow, personRows };
}

export const SPRINT_HEADER = [
  'data',
  'sprint',
  'punts_totals',
  'punts_pendents',
  'punts_ideals',
  'tasques',
  'tasques_tancades',
  'hores_estimades',
  'hores_reals',
];
export const PERSON_HEADER = [
  'data',
  'sprint',
  'persona',
  'tasques',
  'tancades',
  'hores_estimades',
  'hores_reals',
];

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const date = argument('--data') ?? localDate();
  const sprint = findSprint({ date, number: argument('--sprint') });
  if (!sprint) {
    console.log(`El ${date} no hi ha cap sprint en curs: no hi ha foto.`);
    return;
  }
  const out = argument('--sortida') ?? 'foto-sprint';
  const [tasks, stats] = await Promise.all([
    fetchSprintTasks(sprint.milestoneId),
    fetchMilestoneStats(sprint.milestoneId),
  ]);
  const { sprintRow, personRows } = summarize({ date, sprint, tasks, stats });

  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, `foto-${date}.json`),
    `${JSON.stringify({ date, sprint: sprint.number, tasks }, null, 2)}\n`,
  );
  writeFileSync(join(out, 'sprint.csv'), toCsv([SPRINT_HEADER, sprintRow]));
  writeFileSync(join(out, 'persones.csv'), toCsv([PERSON_HEADER, ...personRows]));
  console.log(toCsv([SPRINT_HEADER, sprintRow]).trim());
  console.log(`\nFoto desada a ${out}/`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  });
}
