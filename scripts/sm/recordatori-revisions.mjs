/**
 * Recordatori de revisions: a cada PR que fa més de 24 h que espera revisió hi deixa un comentari
 * que esmenta els revisors i hi afegeix la persona de l'equip que menys revisions porta al sprint
 * (així no recauen sempre en la mateixa). Com a molt un recordatori per PR i dia.
 *
 *   node scripts/sm/recordatori-revisions.mjs            # només mostra què faria
 *   node scripts/sm/recordatori-revisions.mjs --publica  # comenta i demana la revisió (GITHUB_TOKEN)
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findSprint, localDate } from './config.mjs';
import { countReviews, hoursWaiting, leastLoadedReviewer } from './reviews.mjs';
import { fetchOpenPulls, github, githubAll, repoPath } from './sources.mjs';

export const MARKER = '<!-- sm:recordatori-revisions -->';
const MIN_HOURS_BETWEEN_REMINDERS = 20;

/** Text del comentari. Funció pura. */
export function composeReminder({ hours, requested, extra }) {
  const mentions = [...new Set([...requested, ...(extra ? [extra.login] : [])])].map(
    (login) => `@${login}`,
  );
  const lines = [
    MARKER,
    `⏰ Aquesta PR fa ${hours} h que espera revisió (acord de l'equip: revisions en menys de 24 h).`,
    '',
    `${mentions.join(', ')}: hi podeu fer un cop d'ull avui?`,
  ];
  if (extra && !requested.includes(extra.login)) {
    lines.push(
      '',
      `_@${extra.login} és qui menys revisions porta aquest sprint (${extra.reviews}), per això també li ho demano._`,
    );
  }
  return lines.join('\n');
}

async function recentlyReminded(number, now) {
  const comments = await githubAll(repoPath(`/issues/${number}/comments`));
  return comments.some(
    (comment) =>
      comment.body?.startsWith(MARKER) &&
      (now - new Date(comment.created_at).getTime()) / 3_600_000 < MIN_HOURS_BETWEEN_REMINDERS,
  );
}

/** Revisions de les PR que s'han mogut des de l'inici del sprint. */
async function reviewsSince(since) {
  const pulls = await githubAll(repoPath('/pulls?state=all&sort=updated&direction=desc'), 2);
  const recent = pulls.filter((pull) => pull.updated_at >= since);
  return Promise.all(
    recent.map(async (pull) =>
      (await githubAll(repoPath(`/pulls/${pull.number}/reviews`))).map((review) => ({
        login: review.user?.login,
        submitted: review.submitted_at,
      })),
    ),
  );
}

async function main() {
  const publish = process.argv.includes('--publica');
  const today = localDate();
  const sprint = findSprint({ date: today });
  const since = sprint?.start ?? today;
  const now = new Date();

  const [pulls, reviews] = await Promise.all([fetchOpenPulls(), reviewsSince(since)]);
  const counts = countReviews(reviews, since);
  const waiting = pulls
    .map((pull) => ({ pull, hours: hoursWaiting(pull, now) }))
    .filter(({ hours }) => hours !== null);

  if (!waiting.length) {
    console.log('Cap PR espera revisió des de fa més de 24 h.');
    return;
  }
  for (const { pull, hours } of waiting) {
    if (await recentlyReminded(pull.number, now.getTime())) {
      console.log(
        `#${pull.number}: ja té un recordatori de les darreres ${MIN_HOURS_BETWEEN_REMINDERS} h.`,
      );
      continue;
    }
    // Només s'afegeix un revisor si ningú no n'té demanat, perquè una PR encallada no n'acumuli.
    const extra = pull.requested.length
      ? null
      : leastLoadedReviewer(pull.author, counts, pull.number);
    const body = composeReminder({ hours, requested: pull.requested, extra });
    if (!publish) {
      console.log(`#${pull.number} (${pull.title})\n${body}\n`);
      continue;
    }
    if (extra) {
      await github(repoPath(`/pulls/${pull.number}/requested_reviewers`), {
        method: 'POST',
        body: { reviewers: [extra.login] },
      }).catch((error) =>
        console.warn(`#${pull.number}: no s'ha pogut demanar la revisió (${error.message})`),
      );
    }
    await github(repoPath(`/issues/${pull.number}/comments`), { method: 'POST', body: { body } });
    console.log(`#${pull.number}: recordatori publicat.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  });
}
