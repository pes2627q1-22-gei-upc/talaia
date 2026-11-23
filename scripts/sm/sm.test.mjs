import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findSprint, localDate, personFromGithub, personFromTaiga } from './config.mjs';
import { summarize, toCsv } from './foto-sprint.mjs';
import { deviation, hoursBy } from './informe-sprint.mjs';
import { composeReport } from './parte-daily.mjs';
import { parseSprintDoc, plain } from './planning/sprint-doc.mjs';
import { MARKER, composeReminder } from './recordatori-revisions.mjs';
import { countReviews, hoursWaiting, leastLoadedReviewer } from './reviews.mjs';
import { normalizeTask } from './sources.mjs';

const NOW = new Date('2026-11-11T08:00:00Z');
const hoursAgo = (hours) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const pull = (overrides = {}) => ({
  number: 120,
  title: 'feat(api): visibilitat',
  author: 'HugoNienhausen',
  draft: false,
  created: hoursAgo(30),
  headSha: 'abc',
  requested: ['Jsolee'],
  reviews: [],
  ...overrides,
});
const task = (overrides = {}) => ({
  ref: 130,
  subject: 'Endpoint de visibilitat',
  status: 'New',
  notStarted: true,
  closed: false,
  person: 'Hugo',
  start: '2026-11-10',
  due: '2026-11-13',
  estimated: 4,
  real: null,
  ...overrides,
});

describe('config', () => {
  it('troba el sprint per data i per número', () => {
    assert.equal(findSprint({ date: '2026-11-18' }).number, 2);
    assert.equal(findSprint({ number: 3 }).sm, 'martinamaldox');
    assert.equal(findSprint({ date: '2026-11-28' }), undefined);
  });

  it("tradueix els noms de Taiga i de GitHub als de l'equip", () => {
    assert.equal(personFromTaiga('Jsolee'), 'Joan');
    assert.equal(personFromTaiga(null), 'Per assignar');
    assert.equal(personFromGithub('vinyetamoros'), 'Vinyet');
  });

  it("fa servir el dia de Catalunya i no el d'UTC", () => {
    assert.equal(localDate(new Date('2026-11-09T23:30:00Z')), '2026-11-10');
  });
});

describe('normalizeTask', () => {
  it("llegeix les hores i la data d'inici dels atributs de Taiga", () => {
    const normalized = normalizeTask(
      {
        ref: 145,
        subject: 'Alertes',
        status: 9005133,
        status_extra_info: { name: 'New' },
        is_closed: false,
        assigned_to_extra_info: { full_name_display: 'Mohamed' },
        user_story_extra_info: { ref: 37, subject: 'HU16' },
        due_date: '2026-11-11',
        created_date: '2026-10-15T11:54:05Z',
        finished_date: null,
      },
      { 30699: '2026-11-09', 30694: '3', 30695: '' },
    );
    assert.deepEqual(
      [
        normalized.person,
        normalized.start,
        normalized.estimated,
        normalized.real,
        normalized.notStarted,
      ],
      ['Mohamed', '2026-11-09', 3, null, true],
    );
  });
});

describe('revisions', () => {
  it('una PR sense revisar fa més de 24 h que espera', () => {
    assert.equal(hoursWaiting(pull(), NOW), 30);
  });

  it('no esperen els esborranys, les aprovades ni les revisades fa poc', () => {
    assert.equal(hoursWaiting(pull({ draft: true }), NOW), null);
    const approved = { login: 'Jsolee', state: 'APPROVED', submitted: hoursAgo(28), commit: 'abc' };
    assert.equal(hoursWaiting(pull({ reviews: [approved] }), NOW), null);
    const recent = { login: 'Jsolee', state: 'COMMENTED', submitted: hoursAgo(3), commit: 'abc' };
    assert.equal(hoursWaiting(pull({ reviews: [recent] }), NOW), null);
  });

  it("una aprovació d'un commit anterior no compta", () => {
    const old = { login: 'Jsolee', state: 'APPROVED', submitted: hoursAgo(26), commit: 'old' };
    assert.equal(hoursWaiting(pull({ reviews: [old] }), NOW), 26);
  });

  it("si s'han demanat canvis i no hi ha commits nous, li toca a l'autor", () => {
    const changes = {
      login: 'Jsolee',
      state: 'CHANGES_REQUESTED',
      submitted: hoursAgo(25),
      commit: 'abc',
    };
    assert.equal(hoursWaiting(pull({ reviews: [changes] }), NOW), null);
  });

  it("un esborrany marcat com a llest compta des d'aquell moment", () => {
    assert.equal(hoursWaiting(pull({ created: hoursAgo(72), readyAt: hoursAgo(1) }), NOW), null);
    assert.equal(hoursWaiting(pull({ created: hoursAgo(72), readyAt: hoursAgo(30) }), NOW), 30);
  });

  it('un commit nou reinicia el compte', () => {
    const old = { login: 'Jsolee', state: 'APPROVED', submitted: hoursAgo(48), commit: 'old' };
    assert.equal(hoursWaiting(pull({ reviews: [old], lastCommit: hoursAgo(2) }), NOW), null);
  });

  it("proposa qui menys revisions porta, sense l'autor, i reparteix els empats", () => {
    const counts = {
      Jsolee: 9,
      vinyetam: 4,
      martinamaldox: 1,
      'mohamed-dari': 1,
      HugoNienhausen: 0,
      victorlancastle: 2,
    };
    assert.equal(leastLoadedReviewer('martinamaldox', counts).login, 'HugoNienhausen');
    const tied = new Set(
      [10, 11].map((n) => leastLoadedReviewer('HugoNienhausen', counts, n).login),
    );
    assert.deepEqual(tied, new Set(['martinamaldox', 'mohamed-dari']));
  });

  it("compta les revisions de l'equip des de l'inici del sprint", () => {
    const counts = countReviews(
      [
        [
          { login: 'Jsolee', submitted: '2026-11-10T10:00:00Z' },
          { login: 'copilot-pull-request-reviewer[bot]', submitted: '2026-11-10T10:00:00Z' },
        ],
        [{ login: 'vinyetamoros', submitted: '2026-11-01T10:00:00Z' }],
      ],
      '2026-11-09',
    );
    assert.equal(counts.Jsolee, 1);
    assert.equal(counts.vinyetam, 0);
  });

  it('el recordatori esmenta els revisors i qui menys revisions porta', () => {
    const body = composeReminder({
      hours: 30,
      requested: ['Jsolee'],
      extra: { login: 'HugoNienhausen', reviews: 0 },
    });
    assert.ok(body.startsWith(MARKER));
    assert.match(body, /@Jsolee, @HugoNienhausen/);
    assert.match(body, /menys revisions porta aquest sprint \(0\)/);
  });
});

describe('parte de la daily', () => {
  const sprint = { number: 2 };
  const stats = {
    total_points: { a: 66, b: 66 },
    days: [
      { day: '2026-11-09', open_points: 132, optimal_points: 132 },
      { day: '2026-11-10', open_points: 132, optimal_points: 125 },
      { day: '2026-11-11', open_points: 120, optimal_points: 118 },
    ],
  };

  it('agrupa les tasques vençudes, les no començades i les que comencen avui', () => {
    const report = composeReport({
      today: '2026-11-11',
      sprint,
      stats,
      now: NOW,
      ci: { status: 'completed', conclusion: 'success' },
      pulls: [pull()],
      tasks: [
        task({ ref: 145, due: '2026-11-10', person: 'Mohamed' }),
        task({ ref: 130, start: '2026-11-10' }),
        task({ ref: 146, start: '2026-11-11', person: 'Martina' }),
        task({ ref: 165, closed: true, real: null, person: 'Martina' }),
      ],
    });
    assert.match(report, /dc\. 11\/11/);
    assert.match(report, /dia 3 de 3 · queden 120 de 132 punts \(2 per sobre de l'ideal\)/);
    assert.match(report, /Vençudes sense tancar \(1\)\*\n• TG-145 · Mohamed/);
    assert.match(report, /segueixen a New \(1\)\*\n• TG-130 · Hugo/);
    assert.match(report, /Comencen avui \(1\)\*\n• TG-146 · Martina/);
    assert.match(report, /#120 de Hugo · fa 30 h · revisa: Joan/);
    assert.match(report, /Tancades sense hores reals a Taiga \(1\)\*\n• TG-165 · Martina/);
    assert.match(report, /CI de snapshot:\* ✅ en verd/);
  });

  it('quan tot va bé, ho diu', () => {
    const report = composeReport({
      today: '2026-11-11',
      sprint,
      stats,
      now: NOW,
      ci: null,
      pulls: [],
      tasks: [],
    });
    assert.match(report, /Cap tasca endarrerida/);
  });
});

describe('foto i informe', () => {
  it('resumeix el sprint i cada persona', () => {
    const { sprintRow, personRows } = summarize({
      date: '2026-11-11',
      sprint: { number: 2 },
      stats: {
        total_points: { a: 132 },
        days: [{ day: '2026-11-11', open_points: 120, optimal_points: 118 }],
      },
      tasks: [task(), task({ ref: 131, closed: true, real: 5, person: 'Joan' })],
    });
    assert.deepEqual(sprintRow, ['2026-11-11', 2, 132, 120, 118, 2, 1, 8, 5]);
    assert.deepEqual(
      personRows.map((row) => row[2]),
      ['Hugo', 'Joan'],
    );
  });

  it('escriu CSV amb cometes quan cal', () => {
    assert.equal(
      toCsv([
        ['a', 'b,c'],
        [1, 'd"e'],
      ]),
      'a,"b,c"\n1,"d""e"\n',
    );
  });

  it('calcula les hores per persona i la desviació', () => {
    const [hugo] = hoursBy(
      [task({ real: 5 }), task({ estimated: 2, real: 2, closed: true })],
      (t) => t.person,
    );
    assert.deepEqual(hugo, { name: 'Hugo', tasks: 2, closed: 1, estimated: 6, real: 7 });
    assert.equal(deviation(139, 153.5), '+10 %');
    assert.equal(deviation(48, 45), '−6 %');
    assert.equal(deviation(0, 3), '—');
  });
});

describe('planning', () => {
  it("llegeix l'objectiu, les fites i les històries de docs/sprint-N.md", () => {
    const doc = parseSprintDoc(
      [
        '# Sprint 2',
        '',
        '**Objectiu:** Tancar el **MVP**.',
        '',
        'Fites: planning 09/11 · *no hi ha classe 07/12*',
        '',
        '## HU05 · Consultar la visibilitat · [TG-28](https://tree.taiga.io/x/us/28)',
        "Èpica E01 · Recomanacions d'observació · **9 SP**  ",
        '*Com a usuari, vull tocar el mapa, de manera que pugui avaluar llocs.*',
        '',
        "**Criteris d'acceptació**",
        "- [ ] Es mostra l'índex en `menys de 3 s`.",
      ].join('\n'),
    );
    assert.equal(doc.objective, 'Tancar el MVP.');
    assert.equal(doc.milestones, 'planning 09/11 · no hi ha classe 07/12');
    assert.deepEqual(doc.stories[0], {
      ref: 28,
      title: 'HU05 · Consultar la visibilitat',
      epic: "E01 · Recomanacions d'observació",
      description: 'Com a usuari, vull tocar el mapa, de manera que pugui avaluar llocs.',
      criteria: ["Es mostra l'índex en menys de 3 s."],
    });
    assert.equal(plain('[Taiga](https://x)'), 'Taiga');
  });
});
