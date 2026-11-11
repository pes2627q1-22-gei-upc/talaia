/**
 * Parte de la daily: un missatge per enganxar al grup de WhatsApp abans de la daily (dilluns i
 * dimecres). Llegeix Taiga i GitHub, que són públics.
 *
 *   node scripts/sm/parte-daily.mjs                  # l'escriu a la sortida
 *   node scripts/sm/parte-daily.mjs --copia          # i el copia al porta-retalls (macOS)
 *   node scripts/sm/parte-daily.mjs --data 2026-11-11
 *   node scripts/sm/parte-daily.mjs --issue          # el publica com a comentari a l'issue del
 *                                                    # sprint (workflow sm-parte-daily, GITHUB_TOKEN)
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findSprint, localDate, personFromGithub } from './config.mjs';
import { hoursWaiting } from './reviews.mjs';
import {
  fetchLatestCiRun,
  fetchMilestoneStats,
  fetchOpenPulls,
  fetchSprintTasks,
  github,
  githubAll,
  repoPath,
} from './sources.mjs';

const WEEKDAYS = ['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.'];
const MAX_SUBJECT = 60;

const dayMonth = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const shorten = (text) => (text.length > MAX_SUBJECT ? `${text.slice(0, MAX_SUBJECT - 1)}…` : text);
const points = (value) => (Math.round(value * 10) / 10).toLocaleString('ca-ES');

function section(title, lines) {
  return lines.length ? [`*${title} (${lines.length})*`, ...lines, ''] : [];
}

/** Text del parte. Funció pura: tota la informació li arriba ja llegida (es prova sense xarxa). */
export function composeReport({ today, sprint, tasks, stats, pulls, ci, now }) {
  const weekday = WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const lines = [`*Talaia · Parte de la daily · ${weekday} ${dayMonth(today)}*`];

  const days = stats?.days ?? [];
  const dayIndex = days.findIndex((day) => day.day === today);
  if (dayIndex >= 0) {
    const day = days[dayIndex];
    const total = Object.values(stats.total_points ?? {}).reduce((sum, value) => sum + value, 0);
    const behind = day.open_points - day.optimal_points;
    const trend = behind > 0.5 ? `${points(behind)} per sobre de l'ideal` : "al dia amb l'ideal";
    lines.push(
      `Sprint ${sprint.number} · dia ${dayIndex + 1} de ${days.length} · queden ${points(day.open_points)} de ${points(total)} punts (${trend})`,
    );
  } else {
    lines.push(`Sprint ${sprint.number}`);
  }
  lines.push('');

  const open = tasks.filter((task) => !task.closed);
  const overdue = open
    .filter((task) => task.due && task.due < today)
    .sort((a, b) => a.due.localeCompare(b.due));
  const overdueRefs = new Set(overdue.map((task) => task.ref));
  const notStarted = open
    .filter((task) => task.notStarted && task.start && task.start < today)
    .filter((task) => !overdueRefs.has(task.ref))
    .sort((a, b) => a.start.localeCompare(b.start));
  const startingToday = open.filter((task) => task.start === today && task.notStarted);
  const withoutHours = tasks.filter((task) => task.closed && task.real === null);

  lines.push(
    ...section(
      '⏰ Vençudes sense tancar',
      overdue.map(
        (task) =>
          `• TG-${task.ref} · ${task.person} · ${shorten(task.subject)} (límit ${dayMonth(task.due)})`,
      ),
    ),
    ...section(
      '▶️ Tocava començar-les i segueixen a New',
      notStarted.map(
        (task) =>
          `• TG-${task.ref} · ${task.person} · ${shorten(task.subject)} (inici ${dayMonth(task.start)})`,
      ),
    ),
    ...section(
      '🆕 Comencen avui',
      startingToday.map((task) => `• TG-${task.ref} · ${task.person} · ${shorten(task.subject)}`),
    ),
  );

  const waiting = pulls
    .map((pull) => ({ pull, hours: hoursWaiting(pull, now) }))
    .filter(({ hours }) => hours !== null)
    .sort((a, b) => b.hours - a.hours);
  lines.push(
    ...section(
      '👀 PR esperant revisió més de 24 h',
      waiting.map(({ pull, hours }) => {
        const reviewers =
          pull.requested.map(personFromGithub).join(', ') || 'sense revisor assignat';
        return `• #${pull.number} de ${personFromGithub(pull.author)} · fa ${hours} h · revisa: ${reviewers}`;
      }),
    ),
    ...section(
      '🕒 Tancades sense hores reals a Taiga',
      withoutHours.map((task) => `• TG-${task.ref} · ${task.person}`),
    ),
  );

  if (overdue.length + notStarted.length + waiting.length + withoutHours.length === 0) {
    lines.push('✅ Cap tasca endarrerida, cap PR encallada i totes les hores apuntades.', '');
  }

  if (ci) {
    const state =
      ci.status !== 'completed'
        ? '⏳ en curs'
        : ci.conclusion === 'success'
          ? '✅ en verd'
          : `❌ ${ci.conclusion} → ${ci.url}`;
    lines.push(`*CI de snapshot:* ${state}`);
  }
  return lines.join('\n').trim();
}

async function publishOnIssue(sprint, report) {
  const title = `Parte de la daily · Sprint ${sprint.number}`;
  const issues = await githubAll(repoPath('/issues?state=open&creator=github-actions%5Bbot%5D'));
  let issue = issues.find((candidate) => candidate.title === title);
  if (!issue) {
    // Tanca els parte dels sprints anteriors.
    for (const old of issues.filter((candidate) =>
      candidate.title.startsWith('Parte de la daily · Sprint '),
    )) {
      await github(repoPath(`/issues/${old.number}`), {
        method: 'PATCH',
        body: { state: 'closed', state_reason: 'completed' },
      });
    }
    issue = await github(repoPath('/issues'), {
      method: 'POST',
      body: {
        title,
        body: `Parte automàtic de cada daily (dilluns i dimecres a les 8:00) per enganxar al grup. El genera \`scripts/sm/parte-daily.mjs\` (workflow \`sm-parte-daily\`). Es tanca en acabar el sprint.`,
      },
    });
  }
  const body = `@${sprint.sm}, el parte d'avui per enganxar al grup:\n\n\`\`\`text\n${report}\n\`\`\``;
  await github(repoPath(`/issues/${issue.number}/comments`), { method: 'POST', body: { body } });
  return issue.html_url;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const today = argument('--data') ?? localDate();
  const sprint = findSprint({ date: today, number: argument('--sprint') });
  if (!sprint) {
    console.log(`El ${today} no hi ha cap sprint en curs: no hi ha parte.`);
    return;
  }
  const [tasks, stats, pulls, ci] = await Promise.all([
    fetchSprintTasks(sprint.milestoneId),
    fetchMilestoneStats(sprint.milestoneId),
    fetchOpenPulls(),
    fetchLatestCiRun().catch(() => null),
  ]);
  const report = composeReport({ today, sprint, tasks, stats, pulls, ci, now: new Date() });
  console.log(report);

  if (process.argv.includes('--copia')) {
    const copy = spawnSync('pbcopy', { input: report });
    if (copy.error || copy.status !== 0) {
      console.warn("\nNo s'ha pogut copiar al porta-retalls (cal `pbcopy`, només a macOS).");
    } else {
      console.log('\n(copiat al porta-retalls)');
    }
  }
  if (process.argv.includes('--issue')) {
    console.log(`\nPublicat a ${await publishOnIssue(sprint, report)}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  });
}
