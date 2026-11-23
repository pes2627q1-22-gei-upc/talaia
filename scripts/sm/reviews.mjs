/**
 * Regles de revisió compartides pel parte de la daily i pel recordatori de revisions.
 * Acord del Sprint 1 (report_1, accions de millora): cada PR es revisa en menys de 24 h.
 */
import { TEAM } from './config.mjs';

export const REVIEW_LIMIT_HOURS = 24;
const HOUR = 3_600_000;

/**
 * Una PR espera revisió si no és un esborrany, no té cap aprovació al darrer commit (el ruleset
 * descarta les aprovacions en pujar-ne de nous), no té canvis demanats sense commits posteriors
 * (llavors li toca a l'autor) i fa més de 24 h de l'última activitat: la creació, el darrer commit,
 * el moment en què va deixar de ser esborrany o la darrera review.
 * Retorna les hores d'espera, o `null` si no n'espera.
 */
export function hoursWaiting(pull, now = new Date()) {
  if (pull.draft) return null;
  const reviews = pull.reviews.filter((review) => review.login !== pull.author && review.submitted);
  if (reviews.some((review) => review.state === 'APPROVED' && review.commit === pull.headSha)) {
    return null;
  }
  const latest = reviews
    .filter((review) => review.commit === pull.headSha && review.state !== 'COMMENTED')
    .sort((a, b) => new Date(a.submitted) - new Date(b.submitted))
    .at(-1);
  if (latest?.state === 'CHANGES_REQUESTED') return null;
  const lastActivity = [
    pull.created,
    pull.lastCommit,
    pull.readyAt,
    ...reviews.map((review) => review.submitted),
  ]
    .filter(Boolean)
    .map((date) => new Date(date).getTime())
    .reduce((latest, time) => Math.max(latest, time), 0);
  const hours = (now.getTime() - lastActivity) / HOUR;
  return hours > REVIEW_LIMIT_HOURS ? Math.floor(hours) : null;
}

/**
 * Persona de l'equip que menys revisions porta al sprint (sense comptar l'autor de la PR), per
 * repartir-les: al Sprint 1, una persona va fer la meitat de les 180 revisions.
 * `counts` = revisions per login principal. Els empats es reparteixen amb el número de la PR, perquè
 * no recaiguin sempre en la mateixa persona.
 */
export function leastLoadedReviewer(author, counts, pullNumber = 0) {
  const candidates = TEAM.filter((member) => !member.github.includes(author)).map((member) => ({
    login: member.github[0],
    reviews: counts[member.github[0]] ?? 0,
  }));
  if (!candidates.length) return null;
  const fewest = Math.min(...candidates.map((candidate) => candidate.reviews));
  const tied = candidates.filter((candidate) => candidate.reviews === fewest);
  return tied[pullNumber % tied.length];
}

/** Revisions (aprovacions, peticions de canvis i comentaris) per login principal des de `since`. */
export function countReviews(reviewsByPull, since) {
  const counts = Object.fromEntries(TEAM.map((member) => [member.github[0], 0]));
  for (const review of reviewsByPull.flat()) {
    if (!review.submitted || review.submitted < since) continue;
    const member = TEAM.find((candidate) => candidate.github.includes(review.login));
    if (member) counts[member.github[0]] += 1;
  }
  return counts;
}
