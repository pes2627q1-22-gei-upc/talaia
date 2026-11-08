/**
 * Lectura de Taiga i GitHub per a les eines del sprint master. Taiga és públic i el repositori
 * també: no cal cap credencial. Amb `GITHUB_TOKEN` (o `GH_TOKEN`) el límit de GitHub passa de 60
 * a 5.000 peticions per hora, i és obligatori per escriure (comentaris).
 */
import { GITHUB, TAIGA, personFromTaiga } from './config.mjs';

const TAIGA_HEADERS = { 'x-disable-pagination': 'True' };

async function taiga(path) {
  const response = await fetch(`${TAIGA.api}${path}`, { headers: TAIGA_HEADERS });
  if (!response.ok) throw new Error(`Taiga ${path}: HTTP ${response.status}`);
  return response.json();
}

/** Executa `task` sobre cada element amb `limit` peticions alhora. */
async function mapLimited(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const toNumber = (value) =>
  value === null || value === undefined || value === '' ? null : Number(value);

/** Tasques d'un sprint de Taiga amb les hores i la data d'inici (atributs personalitzats). */
export async function fetchSprintTasks(milestoneId) {
  const tasks = await taiga(`/tasks?project=${TAIGA.projectId}&milestone=${milestoneId}`);
  const attributes = await mapLimited(tasks, 8, (task) =>
    taiga(`/tasks/custom-attributes-values/${task.id}`).then(
      (data) => data.attributes_values ?? {},
    ),
  );
  return tasks.map((task, index) => normalizeTask(task, attributes[index]));
}

export function normalizeTask(task, attributes = {}) {
  return {
    ref: task.ref,
    subject: task.subject,
    status: task.status_extra_info?.name ?? '',
    notStarted: task.status === TAIGA.newStatusId,
    closed: Boolean(task.is_closed),
    person: personFromTaiga(task.assigned_to_extra_info?.full_name_display),
    storyRef: task.user_story_extra_info?.ref ?? null,
    storySubject: task.user_story_extra_info?.subject ?? null,
    start: attributes[TAIGA.attributes.startDate] || null,
    due: task.due_date ?? null,
    estimated: toNumber(attributes[TAIGA.attributes.estimatedHours]),
    real: toNumber(attributes[TAIGA.attributes.realHours]),
    created: task.created_date?.slice(0, 10) ?? null,
    finished: task.finished_date?.slice(0, 10) ?? null,
  };
}

/** Tasques d'una història pel seu número (p. ex. la de gestió [GES], que no té sprint). */
export async function fetchStoryTasks(storyRef) {
  const story = await taiga(`/userstories/by_ref?ref=${storyRef}&project=${TAIGA.projectId}`);
  const tasks = await taiga(`/tasks?project=${TAIGA.projectId}&user_story=${story.id}`);
  const attributes = await mapLimited(tasks, 8, (task) =>
    taiga(`/tasks/custom-attributes-values/${task.id}`).then(
      (data) => data.attributes_values ?? {},
    ),
  );
  return tasks.map((task, index) => normalizeTask(task, attributes[index]));
}

export async function fetchStories({ milestoneId } = {}) {
  const filter = milestoneId ? `&milestone=${milestoneId}` : '';
  const stories = await taiga(`/userstories?project=${TAIGA.projectId}${filter}`);
  return stories.map((story) => ({
    ref: story.ref,
    subject: story.subject,
    points: Number(story.total_points ?? 0),
    closed: Boolean(story.is_closed),
    milestoneId: story.milestone,
    epic: story.epics?.find((epic) => !epic.subject.startsWith('[DUPLICAT]'))?.subject ?? null,
  }));
}

/** Burndown de Taiga: un element per dia amb `open_points` i `optimal_points`. */
export function fetchMilestoneStats(milestoneId) {
  return taiga(`/milestones/${milestoneId}/stats`);
}

export const taigaTaskUrl = (ref) => `${TAIGA.web}/task/${ref}`;

// ---------- GitHub ----------

function githubToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
}

export async function github(path, { method = 'GET', body } = {}) {
  const token = githubToken();
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

/** Totes les pàgines d'un llistat de GitHub (fins a `maxPages`). */
export async function githubAll(path, maxPages = 10) {
  const separator = path.includes('?') ? '&' : '?';
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await github(`${path}${separator}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

export const repoPath = (suffix = '') => `/repos/${GITHUB.repo}${suffix}`;

/** PR obertes amb les seves revisions, ja llestes per decidir si esperen revisió. */
export async function fetchOpenPulls() {
  const pulls = await githubAll(repoPath('/pulls?state=open'));
  return Promise.all(
    pulls.map(async (pull) => ({
      number: pull.number,
      title: pull.title,
      url: pull.html_url,
      author: pull.user.login,
      draft: pull.draft,
      created: pull.created_at,
      headSha: pull.head.sha,
      requested: pull.requested_reviewers.map((reviewer) => reviewer.login),
      reviews: (await githubAll(repoPath(`/pulls/${pull.number}/reviews`))).map((review) => ({
        login: review.user?.login,
        state: review.state,
        submitted: review.submitted_at,
        commit: review.commit_id,
      })),
    })),
  );
}

/** Darrera execució de la CI a la branca d'integració. */
export async function fetchLatestCiRun() {
  const data = await github(
    repoPath(`/actions/workflows/${GITHUB.ciWorkflow}/runs?branch=${GITHUB.branch}&per_page=1`),
  );
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return {
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    updated: run.updated_at,
  };
}
