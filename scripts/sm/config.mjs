/**
 * Dades fixes del projecte per a les eines del sprint master (scripts/sm/README.md).
 * Quan comença un sprint, només cal revisar `SPRINTS` (dates, id de Taiga i sprint master).
 */

export const TAIGA = {
  api: 'https://api.taiga.io/api/v1',
  web: 'https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia',
  projectId: 1806158,
  /** Atributs personalitzats de les tasques (Taiga → Admin → Atributs). */
  attributes: { startDate: '30699', estimatedHours: '30694', realHours: '30695' },
  /** Estat «New» de les tasques: encara no començades. */
  newStatusId: 9005133,
};

export const GITHUB = {
  repo: 'pes2627q1-22-gei-upc/talaia',
  branch: 'snapshot',
  ciWorkflow: 'ci.yml',
};

/**
 * `sm` és el login de GitHub del sprint master (el parte de la daily l'esmenta) i
 * `managementStoryRef`, la història de gestió [GES] del sprint, que queda fora del sprint backlog.
 */
export const SPRINTS = [
  {
    number: 1,
    milestoneId: 534139,
    managementStoryRef: 64,
    start: '2026-10-05',
    end: '2026-10-28',
    sm: 'Jsolee',
  },
  {
    number: 2,
    milestoneId: 536396,
    managementStoryRef: 118,
    start: '2026-11-09',
    end: '2026-11-27',
    sm: 'HugoNienhausen',
  },
  {
    number: 3,
    milestoneId: 536397,
    managementStoryRef: 121,
    start: '2026-11-30',
    end: '2026-12-18',
    sm: 'martinamaldox',
  },
];

/**
 * En l'ordre de la portada dels documents. `taiga` és el nom que mostra Taiga; `github`, els
 * logins (el primer és el principal).
 */
export const TEAM = [
  {
    name: 'Vinyet',
    fullName: 'Amorós Marín, Vinyet',
    taiga: 'Vinyet Amorós Marin',
    github: ['vinyetam', 'vinyetamoros'],
  },
  {
    name: 'Hugo',
    fullName: 'Nienhausen Mesanza, Hugo',
    taiga: 'Hugo Nienhausen',
    github: ['HugoNienhausen'],
  },
  {
    name: 'Mohamed',
    fullName: 'Dari Bachiri, Mohamed',
    taiga: 'Mohamed',
    github: ['mohamed-dari'],
  },
  {
    name: 'Martina',
    fullName: 'Maldonado de las Heras, Martina',
    taiga: 'Martina',
    github: ['martinamaldox', 'martinamaldonado-uni'],
  },
  {
    name: 'Victor',
    fullName: 'Lancastle Vivancos, Victor',
    taiga: 'Victor Lancastle',
    github: ['victorlancastle'],
  },
  { name: 'Joan', fullName: 'Solé Jiménez, Joan', taiga: 'Jsolee', github: ['Jsolee'] },
];

export const UNASSIGNED = 'Per assignar';
export const PROFESSOR = 'Victor Asenjo';

export function personFromTaiga(taigaName) {
  if (!taigaName) return UNASSIGNED;
  return TEAM.find((member) => member.taiga === taigaName)?.name ?? taigaName;
}

export function personFromGithub(login) {
  return TEAM.find((member) => member.github.includes(login))?.name ?? login;
}

/** Sprint d'una data (AAAA-MM-DD) o d'un número; `undefined` fora dels sprints. */
export function findSprint({ date, number } = {}) {
  if (number !== undefined) return SPRINTS.find((sprint) => sprint.number === Number(number));
  return SPRINTS.find((sprint) => sprint.start <= date && date <= sprint.end);
}

/** Data civil de Catalunya (AAAA-MM-DD) d'un instant: la CI va en UTC. */
export function localDate(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(instant);
}
