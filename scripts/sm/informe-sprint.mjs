/**
 * Dades i gràfics del report d'un sprint, sortits de Taiga i GitHub: les taules d'hores per
 * persona i per història, les tasques afegides, les PR i revisions per persona, i els gràfics de
 * burndown, velocitat, burndown del producte i PR per dia (SVG i CSV per refer-los on calgui).
 *
 *   GH_TOKEN=$(gh auth token) node scripts/sm/informe-sprint.mjs --sprint 2
 *   ... [--sortida informe-sprint-2] [--fotos carpeta-amb-les-fotos-baixades]
 *
 * Les fotos diàries (workflow sm-foto-sprint) es baixen amb
 * `gh run download --pattern 'foto-sprint-*' --dir fotos`; si hi són, també surt l'evolució diària
 * de les hores apuntades.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPRINTS, TAIGA, TEAM, findSprint, localDate, personFromGithub } from './config.mjs';
import { toCsv } from './foto-sprint.mjs';
import { COLORS, barChart, lineChart } from './svg.mjs';
import {
  fetchMilestoneStats,
  fetchSprintTasks,
  fetchStories,
  githubAll,
  repoPath,
} from './sources.mjs';

const sum = (values) => values.reduce((total, value) => total + (value ?? 0), 0);
const num = (value) => (Math.round(value * 100) / 100).toLocaleString('ca-ES');
const dayMonth = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
export const deviation = (estimated, real) =>
  estimated > 0
    ? `${real >= estimated ? '+' : '−'}${Math.round((Math.abs(real - estimated) / estimated) * 100)} %`
    : '—';
const table = (header, rows) =>
  [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');

/** Hores per persona o per història. Funció pura. */
export function hoursBy(tasks, key) {
  const groups = new Map();
  for (const task of tasks) {
    const name = key(task);
    const group = groups.get(name) ?? { name, tasks: 0, closed: 0, estimated: 0, real: 0 };
    group.tasks += 1;
    group.closed += task.closed ? 1 : 0;
    group.estimated += task.estimated ?? 0;
    group.real += task.real ?? 0;
    groups.set(name, group);
  }
  return [...groups.values()];
}

const committedPoints = (stats) => sum(Object.values(stats.total_points ?? {}));
const completedPoints = (stats) => sum(stats.completed_points ?? []);

async function mergedPulls(sprint) {
  const pulls = await githubAll(repoPath('/pulls?state=closed&sort=updated&direction=desc'), 5);
  const merged = pulls.filter((pull) => {
    if (!pull.merged_at) return false;
    const day = localDate(new Date(pull.merged_at));
    return sprint.start <= day && day <= sprint.end;
  });
  return Promise.all(
    merged.map(async (pull) => ({
      number: pull.number,
      author: personFromGithub(pull.user.login),
      day: localDate(new Date(pull.merged_at)),
      // Només les de l'equip: els bots (p. ex. Copilot) també deixen revisions.
      reviews: (await githubAll(repoPath(`/pulls/${pull.number}/reviews`)))
        .map((review) => personFromGithub(review.user?.login))
        .filter((person) => TEAM.some((member) => member.name === person)),
    })),
  );
}

function readSnapshots(dir) {
  const files = [];
  const walk = (path) => {
    for (const entry of readdirSync(path)) {
      const full = join(path, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/^foto-\d{4}-\d{2}-\d{2}\.json$/.test(entry)) files.push(full);
    }
  };
  walk(dir);
  return files
    .map((file) => JSON.parse(readFileSync(file, 'utf8')))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const today = localDate();
  const sprint =
    findSprint({ number: argument('--sprint') }) ??
    findSprint({ date: today }) ??
    [...SPRINTS].reverse().find((candidate) => candidate.end < today);
  const out = argument('--sortida') ?? `informe-sprint-${sprint.number}`;
  mkdirSync(out, { recursive: true });
  const write = (name, content) => writeFileSync(join(out, name), content);

  const previous = SPRINTS.filter((candidate) => candidate.number <= sprint.number);
  const [tasks, stories, allStories, statsList, pulls] = await Promise.all([
    fetchSprintTasks(sprint.milestoneId),
    fetchStories({ milestoneId: sprint.milestoneId }),
    fetchStories(),
    Promise.all(previous.map((candidate) => fetchMilestoneStats(candidate.milestoneId))),
    mergedPulls(sprint),
  ]);
  const stats = statsList.at(-1);

  // ---------- gràfics ----------
  const days = stats.days ?? [];
  write(
    'burndown.csv',
    toCsv([
      ['dia', 'punts_pendents', 'punts_ideals'],
      ...days.map((d) => [d.day, d.open_points, d.optimal_points]),
    ]),
  );
  write(
    'burndown.svg',
    lineChart({
      title: `Burndown del Sprint ${sprint.number}`,
      subtitle: 'Punts pendents per dia (Taiga), real i ideal',
      xLabels: days.map((d) => dayMonth(d.day)),
      series: [
        {
          name: 'Real',
          values: days.map((d) => (d.day <= today ? Math.max(0, d.open_points) : null)),
          color: COLORS.accent,
        },
        {
          name: 'Ideal',
          values: days.map((d) => Math.max(0, d.optimal_points)),
          color: COLORS.reference,
          dashed: true,
        },
      ],
    }),
  );

  const velocity = previous.map((candidate, index) => ({
    sprint: `Sprint ${candidate.number}`,
    committed: committedPoints(statsList[index]),
    completed: completedPoints(statsList[index]),
  }));
  write(
    'velocitat.csv',
    toCsv([
      ['sprint', 'compromesos', 'completats'],
      ...velocity.map((v) => [v.sprint, v.committed, v.completed]),
    ]),
  );
  write(
    'velocitat.svg',
    barChart({
      title: 'Velocitat',
      subtitle: 'Story points compromesos i completats per sprint',
      xLabels: velocity.map((v) => v.sprint),
      series: [
        { name: 'Compromesos', values: velocity.map((v) => v.committed), color: COLORS.reference },
        { name: 'Completats', values: velocity.map((v) => v.completed), color: COLORS.accent },
      ],
    }),
  );

  // Tots els sprints a l'eix: els que encara no han acabat queden sense punt.
  const backlog = sum(allStories.map((story) => story.points));
  let pending = backlog;
  const productRows = [['Inici', backlog]];
  SPRINTS.forEach((candidate) => {
    const done = velocity.find((v) => v.sprint === `Sprint ${candidate.number}`);
    if (done && candidate.end <= today) pending -= done.completed;
    productRows.push([
      `Sprint ${candidate.number}`,
      done && candidate.end <= today ? pending : null,
    ]);
  });
  const ideal = productRows.map((_, index) =>
    Math.max(0, backlog - (backlog / SPRINTS.length) * index),
  );
  write(
    'burndown-producte.csv',
    toCsv([
      ['moment', 'punts_pendents', 'ideal'],
      ...productRows.map((row, i) => [...row, ideal[i]]),
    ]),
  );
  write(
    'burndown-producte.svg',
    lineChart({
      title: 'Burndown del producte',
      subtitle: `Punts pendents del backlog (${num(backlog)} en total) després de cada sprint`,
      xLabels: productRows.map((row) => row[0]),
      series: [
        { name: 'Pendents', values: productRows.map((row) => row[1]), color: COLORS.accent },
        { name: 'Ideal', values: ideal, color: COLORS.reference, dashed: true },
      ],
    }),
  );

  const sprintDays = days.map((d) => d.day);
  const perDay = sprintDays.map((day) => pulls.filter((pull) => pull.day === day).length);
  write(
    'prs-per-dia.csv',
    toCsv([['dia', 'pr_fusionades'], ...sprintDays.map((day, i) => [day, perDay[i]])]),
  );
  write(
    'prs-per-dia.svg',
    barChart({
      title: 'Pull requests fusionades per dia',
      subtitle: `${pulls.length} PR fusionades al Sprint ${sprint.number}`,
      xLabels: sprintDays.map(dayMonth),
      series: [{ name: 'PR fusionades', values: perDay, color: COLORS.accent }],
    }),
  );

  // ---------- taules ----------
  const estimated = sum(tasks.map((task) => task.estimated));
  const real = sum(tasks.map((task) => task.real));
  const added = tasks.filter((task) => task.created && task.created > sprint.start);
  const people = hoursBy(tasks, (task) => task.person).sort(
    (a, b) => b.real - a.real || a.name.localeCompare(b.name),
  );
  const byStory = hoursBy(tasks, (task) => task.storySubject ?? 'Tasques sense història');
  const storyPoints = new Map(stories.map((story) => [story.subject, story.points]));
  const reviewsBy = new Map();
  for (const pull of pulls) {
    for (const reviewer of pull.reviews) {
      if (reviewer === pull.author) continue;
      const entry = reviewsBy.get(reviewer) ?? { reviews: 0, pulls: new Set() };
      entry.reviews += 1;
      entry.pulls.add(pull.number);
      reviewsBy.set(reviewer, entry);
    }
  }
  const githubPeople = [
    ...new Set([...pulls.map((pull) => pull.author), ...reviewsBy.keys()]),
  ].sort();

  const markdown = [
    `# Dades del report del Sprint ${sprint.number}`,
    '',
    `Generat el ${today} amb \`scripts/sm/informe-sprint.mjs\` a partir de [Taiga](${TAIGA.web}) i GitHub. Gràfics: \`burndown.svg\`, \`velocitat.svg\`, \`burndown-producte.svg\` i \`prs-per-dia.svg\` (amb els seus CSV).`,
    '',
    '## Indicadors',
    '',
    table(
      ['Indicador', 'Valor'],
      [
        [
          'Story points completats',
          `${num(completedPoints(stats))} de ${num(committedPoints(stats))}`,
        ],
        [
          'Històries completades',
          `${stories.filter((story) => story.closed).length} de ${stories.length}`,
        ],
        ['Tasques tancades', `${tasks.filter((task) => task.closed).length} de ${tasks.length}`],
        [
          'Hores estimades i reals',
          `${num(estimated)} i ${num(real)} (${deviation(estimated, real)})`,
        ],
        [
          'Tasques afegides durant el sprint',
          `${added.length} (${num(sum(added.map((t) => t.estimated)))} h estimades, ${num(sum(added.map((t) => t.real)))} h reals)`,
        ],
        [
          'PR fusionades i revisions',
          `${pulls.length} PR · ${sum([...reviewsBy.values()].map((entry) => entry.reviews))} revisions`,
        ],
      ],
    ),
    '',
    '## Hores per persona',
    '',
    table(
      ['Persona', 'Tasques (tancades)', 'Hores estimades', 'Hores reals', 'Desviació'],
      [
        ...people.map((p) => [
          p.name,
          `${p.tasks} (${p.closed})`,
          num(p.estimated),
          num(p.real),
          deviation(p.estimated, p.real),
        ]),
        [
          '**Total**',
          `${tasks.length}`,
          `**${num(estimated)}**`,
          `**${num(real)}**`,
          deviation(estimated, real),
        ],
      ],
    ),
    '',
    '## Hores per història',
    '',
    table(
      ['Història', 'Punts', 'Hores estimades', 'Hores reals', 'Desviació'],
      byStory.map((s) => [
        s.name,
        storyPoints.has(s.name) ? num(storyPoints.get(s.name)) : '—',
        num(s.estimated),
        num(s.real),
        deviation(s.estimated, s.real),
      ]),
    ),
    '',
    '## Tasques afegides durant el sprint',
    '',
    added.length
      ? table(
          ['Tasca', 'Afegida', 'Persona', 'Hores (est. / reals)'],
          added.map((t) => [
            `TG-${t.ref} · ${t.subject}`,
            dayMonth(t.created),
            t.person,
            `${t.estimated ?? '–'} / ${t.real ?? '–'}`,
          ]),
        )
      : 'Cap.',
    '',
    '## Tasques obertes',
    '',
    tasks.some((task) => !task.closed)
      ? table(
          ['Tasca', 'Persona', 'Estat', 'Límit'],
          tasks
            .filter((t) => !t.closed)
            .map((t) => [
              `TG-${t.ref} · ${t.subject}`,
              t.person,
              t.status,
              t.due ? dayMonth(t.due) : '—',
            ]),
        )
      : 'Cap: totes les tasques del sprint són tancades.',
    '',
    '## Tasques tancades sense hores reals',
    '',
    tasks.some((task) => task.closed && task.real === null)
      ? tasks
          .filter((t) => t.closed && t.real === null)
          .map((t) => `- TG-${t.ref} · ${t.person}`)
          .join('\n')
      : 'Cap.',
    '',
    '## Pull requests i revisions per persona',
    '',
    table(
      ['Persona', 'PR fusionades', 'Revisions fetes', 'PR diferents revisades'],
      githubPeople.map((person) => [
        person,
        pulls.filter((pull) => pull.author === person).length,
        reviewsBy.get(person)?.reviews ?? 0,
        reviewsBy.get(person)?.pulls.size ?? 0,
      ]),
    ),
    '',
  ];

  const fotosDir = argument('--fotos');
  if (fotosDir) {
    const snapshots = readSnapshots(fotosDir).filter(
      (snapshot) => snapshot.sprint === sprint.number,
    );
    const rows = snapshots.map((snapshot) => [
      snapshot.date,
      snapshot.tasks.filter((task) => task.closed).length,
      sum(snapshot.tasks.map((task) => task.estimated)),
      sum(snapshot.tasks.map((task) => task.real)),
    ]);
    write(
      'evolucio-hores.csv',
      toCsv([['dia', 'tasques_tancades', 'hores_estimades', 'hores_reals'], ...rows]),
    );
    markdown.push(
      `Evolució diària de les hores apuntades (${rows.length} fotos): \`evolucio-hores.csv\`.`,
      '',
    );
  }

  write('informe.md', markdown.join('\n'));
  console.log(
    `Informe del Sprint ${sprint.number} desat a ${out}/ (informe.md, 4 gràfics SVG i els seus CSV).`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  });
}
