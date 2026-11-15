/** TG-107: efemèrides calculades per al calendari. No consulta cap servei extern. */
import {
  ApsisKind,
  Body,
  Equator,
  GeoVector,
  Horizon,
  Illumination,
  NextMoonQuarter,
  Observer,
  SearchLunarApsis,
  SearchMoonQuarter,
  NextLunarApsis,
} from 'astronomy-engine';

const DIA = 86_400_000;
const HORA = 3_600_000;
const FORMAT_CATALUNYA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const OBSERVADOR = new Observer(41.77, 2.44, 1700); // Montseny: referència, no ubicació única.
export const METODE_CALCUL = 'Astronomy Engine 2.1.19';
export const SEPARACIO_MAXIMA = 3; // graus aparents, criteri editorial del MVP.
const ALTURA_MINIMA = 10; // graus sobre l'horitzó.
const SOL_MAXIM = -6; // crepuscle civil o nit.
const MAGNITUD_MAXIMA = 2.5; // sense instruments, aproximació conservadora.
const COSOS = [Body.Moon, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn];
const NOMS: Record<string, string> = {
  [Body.Moon]: 'Lluna',
  [Body.Mercury]: 'Mercuri',
  [Body.Venus]: 'Venus',
  [Body.Mars]: 'Mart',
  [Body.Jupiter]: 'Júpiter',
  [Body.Saturn]: 'Saturn',
};
const CODIS: Record<string, string> = {
  [Body.Moon]: 'lluna',
  [Body.Mercury]: 'mercuri',
  [Body.Venus]: 'venus',
  [Body.Mars]: 'mart',
  [Body.Jupiter]: 'jupiter',
  [Body.Saturn]: 'saturn',
};

type Idioma = 'ca' | 'es' | 'en';
type TextosFenomen = Record<Idioma, { nom: string; descripcio: string; consell_general: string }>;
type TextosEsdeveniment = Record<Idioma, { nota_visibilitat: string; consell_observacio: string }>;
const NOMS_TRADUITS: Record<'es' | 'en', Record<string, string>> = {
  es: {
    [Body.Moon]: 'la Luna',
    [Body.Mercury]: 'Mercurio',
    [Body.Venus]: 'Venus',
    [Body.Mars]: 'Marte',
    [Body.Jupiter]: 'Júpiter',
    [Body.Saturn]: 'Saturno',
  },
  en: {
    [Body.Moon]: 'the Moon',
    [Body.Mercury]: 'Mercury',
    [Body.Venus]: 'Venus',
    [Body.Mars]: 'Mars',
    [Body.Jupiter]: 'Jupiter',
    [Body.Saturn]: 'Saturn',
  },
};
export type FenomenCalculat = {
  codi: string;
  tipus_codi: 'fase_llunar' | 'superlluna' | 'conjuncio';
  periodicitat: 'mensual' | 'ocasional';
  publicable_calendari: true;
  textos: TextosFenomen;
};
export type EsdevenimentCalculat = {
  codi: string;
  fenomen_codi: string;
  metode_calcul: string;
  inici: string;
  fi: string;
  maxim: string;
  precisio: { inici: 'dia' | 'hora'; fi: 'dia' | 'hora'; maxim: 'segon' | 'hora' };
  rellevant_catalunya: true;
  rellevancia: 'principal' | 'secundari';
  dificultat_observacio: 'baixa' | 'mitjana';
  textos: TextosEsdeveniment;
  detall_calcul?: {
    separacio_graus?: number;
    distancia_lluna_km?: number;
    llindar_superlluna_km?: number;
  };
};

export type CalendariCalculat = {
  versio_esquema: 1;
  periode: { des_de: string; fins_a: string };
  criteris: {
    lloc_referencia: { lat: number; lon: number; altitud_m: number };
    separacio_maxima_graus: number;
    altura_minima_graus: number;
    altura_sol_maxima_graus: number;
    magnitud_maxima: number;
    llindar_superlluna_fraccio: number;
  };
  fenomens: FenomenCalculat[];
  esdeveniments: EsdevenimentCalculat[];
};

function iso(ms: number): string {
  return new Date(Math.round(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');
}

function partsCatalunya(ms: number): Record<string, string> {
  return Object.fromEntries(
    FORMAT_CATALUNYA.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  );
}

function diaCatalunya(ms: number): string {
  const { year, month, day } = partsCatalunya(ms);
  return `${year}-${month}-${day}`;
}

/** Mitjanit local expressada en UTC; no tots els dies duren 24 h pel canvi d'hora. */
function mitjanitCatalunya(dia: string): number {
  const suposadaUtc = Date.parse(`${dia}T00:00:00Z`);
  const { year, month, day, hour, minute, second } = partsCatalunya(suposadaUtc);
  const diferencia =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ) - suposadaUtc;
  return suposadaUtc - diferencia;
}

function instant(
  codi: string,
  fenomen_codi: string,
  ms: number,
  textos: TextosEsdeveniment,
  rellevancia: 'principal' | 'secundari' = 'principal',
): EsdevenimentCalculat {
  return {
    codi,
    fenomen_codi,
    metode_calcul: METODE_CALCUL,
    inici: iso(ms - HORA / 2),
    fi: iso(ms + HORA / 2),
    maxim: iso(ms),
    precisio: { inici: 'hora', fi: 'hora', maxim: 'segon' },
    rellevant_catalunya: true,
    rellevancia,
    dificultat_observacio: 'baixa',
    textos,
  };
}

/** Una fase és un instant exacte, però ocupa el dia del calendari a Catalunya. */
function faseDelDia(event: EsdevenimentCalculat): EsdevenimentCalculat {
  const dia = diaCatalunya(Date.parse(event.maxim));
  const seguent = new Date(Date.parse(`${dia}T00:00:00Z`) + DIA).toISOString().slice(0, 10);
  event.inici = iso(mitjanitCatalunya(dia));
  event.fi = iso(mitjanitCatalunya(seguent) - 1000);
  event.precisio.inici = 'dia';
  event.precisio.fi = 'dia';
  return event;
}

function apsidesPropers(ms: number): { perigeu: number; apogeu: number } {
  // Dos cicles a banda i banda de la fase; comparem amb els extrems orbitals més propers.
  let apsis = SearchLunarApsis(new Date(ms - 35 * DIA));
  const candidats: (typeof apsis)[] = [];
  while (apsis.time.date.getTime() < ms + 35 * DIA) {
    candidats.push(apsis);
    apsis = NextLunarApsis(apsis);
  }
  const perigeus = candidats.filter((a) => a.kind === ApsisKind.Pericenter);
  const apogeus = candidats.filter((a) => a.kind === ApsisKind.Apocenter);
  const mesProper = (items: typeof candidats) =>
    items.reduce((millor, actual) =>
      Math.abs(actual.time.date.getTime() - ms) < Math.abs(millor.time.date.getTime() - ms)
        ? actual
        : millor,
    );
  return { perigeu: mesProper(perigeus).dist_km, apogeu: mesProper(apogeus).dist_km };
}

function fenomensBase(): FenomenCalculat[] {
  return [
    {
      codi: 'lluna-nova',
      tipus_codi: 'fase_llunar',
      periodicitat: 'mensual',
      publicable_calendari: true,
      textos: {
        ca: {
          nom: 'Lluna nova',
          descripcio:
            'Fase en què la cara il·luminada de la Lluna no mira cap a la Terra. La Lluna no és observable, però el cel és més fosc.',
          consell_general:
            'Aprofiteu la foscor per observar objectes febles; la meteorologia i la contaminació lumínica continuen sent determinants.',
        },
        es: {
          nom: 'Luna nueva',
          descripcio:
            'Fase en la que la cara iluminada de la Luna no mira hacia la Tierra. La Luna no es observable, pero el cielo está más oscuro.',
          consell_general:
            'Aprovecha la oscuridad para observar objetos tenues; el tiempo y la contaminación lumínica siguen siendo determinantes.',
        },
        en: {
          nom: 'New Moon',
          descripcio:
            'The Moon’s illuminated side faces away from Earth. The Moon is not visible, but the sky is darker.',
          consell_general:
            'Use the darkness to observe faint objects; weather and light pollution still matter.',
        },
      },
    },
    {
      codi: 'lluna-plena',
      tipus_codi: 'fase_llunar',
      periodicitat: 'mensual',
      publicable_calendari: true,
      textos: {
        ca: {
          nom: 'Lluna plena',
          descripcio: 'Fase en què veiem gairebé tot el disc lunar il·luminat.',
          consell_general:
            'La Lluna plena és fàcil de veure, però la seva llum dificulta observar objectes febles.',
        },
        es: {
          nom: 'Luna llena',
          descripcio: 'Fase en la que vemos casi todo el disco lunar iluminado.',
          consell_general:
            'La Luna llena es fácil de ver, pero su luz dificulta observar objetos tenues.',
        },
        en: {
          nom: 'Full Moon',
          descripcio: 'A phase when almost the entire lunar disk appears illuminated.',
          consell_general:
            'The Full Moon is easy to see, but its light makes faint objects harder to observe.',
        },
      },
    },
    {
      codi: 'superlluna-plena',
      tipus_codi: 'superlluna',
      periodicitat: 'ocasional',
      publicable_calendari: true,
      textos: {
        ca: {
          nom: 'Superlluna plena',
          descripcio:
            'Lluna plena propera al perigeu segons el criteri del 90 % del recorregut entre apogeu i perigeu; la diferència aparent pot ser subtil.',
          consell_general:
            'Observeu-la a ull nu. No espereu un canvi de mida espectacular sense comparar fotografies preses amb el mateix equip.',
        },
        es: {
          nom: 'Superluna llena',
          descripcio:
            'Luna llena cercana al perigeo según el criterio del 90 % del recorrido entre apogeo y perigeo; la diferencia aparente puede ser sutil.',
          consell_general:
            'Obsérvala a simple vista. No esperes un cambio de tamaño espectacular sin comparar fotografías tomadas con el mismo equipo.',
        },
        en: {
          nom: 'Full Supermoon',
          descripcio:
            'A Full Moon near perigee under the 90% criterion along the apogee-to-perigee range; the apparent difference can be subtle.',
          consell_general:
            'Observe it with the naked eye. Do not expect a dramatic size difference without comparing photos taken with the same equipment.',
        },
      },
    },
  ];
}

function afegeixFases(desDe: number, finsA: number, events: EsdevenimentCalculat[]): void {
  let fase = SearchMoonQuarter(new Date(desDe - 8 * DIA));
  while (fase.time.date.getTime() <= finsA) {
    const ms = fase.time.date.getTime();
    if (ms >= desDe && (fase.quarter === 0 || fase.quarter === 2)) {
      const data = diaCatalunya(Date.parse(iso(ms)));
      if (fase.quarter === 0) {
        events.push(
          faseDelDia(
            instant(`lluna-nova-${data}`, 'lluna-nova', ms, {
              ca: {
                nota_visibilitat:
                  'La Lluna nova no es veu; la seva absència afavoreix un cel fosc a Catalunya.',
                consell_observacio:
                  'Trieu un indret amb poca llum artificial i consulteu la previsió de núvols.',
              },
              es: {
                nota_visibilitat:
                  'La Luna nueva no se ve; su ausencia favorece un cielo oscuro en Cataluña.',
                consell_observacio:
                  'Elige un lugar con poca luz artificial y consulta la previsión de nubosidad.',
              },
              en: {
                nota_visibilitat:
                  'The New Moon is not visible; its absence makes for a darker sky in Catalonia.',
                consell_observacio:
                  'Choose a place with little artificial light and check the cloud forecast.',
              },
            }),
          ),
        );
      } else {
        const { perigeu, apogeu } = apsidesPropers(ms);
        const llindar = apogeu - 0.9 * (apogeu - perigeu);
        // Distància geocèntrica en km: d'Astronomy Engine, no del lloc de referència.
        const vector = GeoVector(Body.Moon, new Date(ms), true);
        const distancia = Math.hypot(vector.x, vector.y, vector.z) * 149_597_870.7;
        const superlluna = distancia <= llindar;
        const codi = superlluna ? 'superlluna-plena' : 'lluna-plena';
        const event = instant(`${codi}-${data}`, codi, ms, {
          ca: {
            nota_visibilitat: superlluna
              ? 'Lluna plena propera al perigeu i visible des de Catalunya si el cel és clar; la mida aparent només canvia lleugerament.'
              : 'Lluna plena observable des de Catalunya si el cel és clar.',
            consell_observacio: superlluna
              ? 'Observeu-la quan surti; compareu fotografies amb la mateixa escala si voleu apreciar la diferència.'
              : 'Mireu cap a la Lluna al vespre o durant la nit i tingueu en compte que il·lumina el cel.',
          },
          es: {
            nota_visibilitat: superlluna
              ? 'Luna llena cercana al perigeo y visible desde Cataluña si el cielo está despejado; su tamaño aparente solo cambia ligeramente.'
              : 'Luna llena observable desde Cataluña si el cielo está despejado.',
            consell_observacio: superlluna
              ? 'Obsérvala al salir; compara fotografías a la misma escala si quieres apreciar la diferencia.'
              : 'Mira hacia la Luna al anochecer o durante la noche y ten en cuenta que ilumina el cielo.',
          },
          en: {
            nota_visibilitat: superlluna
              ? 'A Full Moon near perigee, visible from Catalonia under clear skies; its apparent size changes only slightly.'
              : 'A Full Moon visible from Catalonia under clear skies.',
            consell_observacio: superlluna
              ? 'Watch it rise; compare photos at the same scale to appreciate the difference.'
              : 'Look for the Moon in the evening or at night and remember that it brightens the sky.',
          },
        });
        if (superlluna)
          event.detall_calcul = {
            distancia_lluna_km: Math.round(distancia),
            llindar_superlluna_km: Math.round(llindar),
          };
        events.push(faseDelDia(event));
      }
    }
    fase = NextMoonQuarter(fase);
  }
}

type Mostra = { ms: number; separacio: number; a: string; b: string };
function separacio(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const r = Math.PI / 180;
  const cos =
    Math.sin(dec1 * r) * Math.sin(dec2 * r) +
    Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.cos((ra1 - ra2) * 15 * r);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / r;
}

function afegeixConjuncions(
  desDe: number,
  finsA: number,
  fenomens: FenomenCalculat[],
  events: EsdevenimentCalculat[],
): void {
  const grups = new Map<string, { millor: Mostra; ultim: number }>();
  const tanca = (clau: string) => {
    const grup = grups.get(clau);
    if (!grup) return;
    const { a, b, ms, separacio: angle } = grup.millor;
    const codi = `conjuncio-${CODIS[a]}-${CODIS[b]}`;
    if (!fenomens.some((f) => f.codi === codi))
      fenomens.push({
        codi,
        tipus_codi: 'conjuncio',
        periodicitat: 'ocasional',
        publicable_calendari: true,
        textos: {
          ca: {
            nom: `Aproximació de ${NOMS[a]} i ${NOMS[b]}`,
            descripcio: `Des de la Terra, ${NOMS[a]} i ${NOMS[b]} semblen propers al cel, tot i que estan molt separats a l'espai.`,
            consell_general:
              "Busqueu un horitzó clar i consulteu l'hora i les condicions locals; la proximitat és aparent.",
          },
          es: {
            nom: `Aproximación de ${NOMS_TRADUITS.es[a]} y ${NOMS_TRADUITS.es[b]}`,
            descripcio: `Desde la Tierra, ${NOMS_TRADUITS.es[a]} y ${NOMS_TRADUITS.es[b]} parecen cercanos en el cielo, aunque están muy separados en el espacio.`,
            consell_general:
              'Busca un horizonte despejado y consulta la hora y las condiciones locales; la cercanía es aparente.',
          },
          en: {
            nom: `Close approach of ${NOMS_TRADUITS.en[a]} and ${NOMS_TRADUITS.en[b]}`,
            descripcio: `From Earth, ${NOMS_TRADUITS.en[a]} and ${NOMS_TRADUITS.en[b]} appear close in the sky, although they are far apart in space.`,
            consell_general:
              'Find a clear horizon and check the time and local conditions; the closeness is only apparent.',
          },
        },
      });
    const event = instant(
      `${codi}-${diaCatalunya(Date.parse(iso(ms)))}`,
      codi,
      ms,
      {
        ca: {
          nota_visibilitat: `Separació aparent aproximada de ${angle.toFixed(1)}° des del Montseny, amb els dos astres a més de 10° d'altura i el Sol sota -6°. La franja inici-fi és orientativa (±30 minuts de la millor mostra horària), no la durada real de l'aproximació. La visibilitat real depèn del lloc i dels núvols.`,
          consell_observacio: `Observeu ${NOMS[a]} i ${NOMS[b]} al voltant de l'hora indicada des d'un lloc amb l'horitzó lliure.`,
        },
        es: {
          nota_visibilitat: `Separación aparente aproximada de ${angle.toFixed(1)}° desde el Montseny, con ambos astros a más de 10° de altura y el Sol por debajo de -6°. La franja de inicio-fin es orientativa (±30 minutos de la mejor muestra horaria), no la duración real de la aproximación. La visibilidad depende del lugar y de las nubes.`,
          consell_observacio: `Observa ${NOMS_TRADUITS.es[a]} y ${NOMS_TRADUITS.es[b]} cerca de la hora indicada desde un lugar con el horizonte despejado.`,
        },
        en: {
          nota_visibilitat: `Approximate apparent separation of ${angle.toFixed(1)}° from Montseny, with both bodies more than 10° above the horizon and the Sun below -6°. The start-end window is indicative (±30 minutes around the best hourly sample), not the actual duration of the approach. Visibility depends on location and cloud cover.`,
          consell_observacio: `Observe ${NOMS_TRADUITS.en[a]} and ${NOMS_TRADUITS.en[b]} around the indicated time from a place with a clear horizon.`,
        },
      },
      'secundari',
    );
    event.precisio.maxim = 'hora';
    event.dificultat_observacio = 'mitjana';
    event.detall_calcul = { separacio_graus: Math.round(angle * 10) / 10 };
    events.push(event);
    grups.delete(clau);
  };

  for (let ms = Math.ceil(desDe / HORA) * HORA; ms <= finsA; ms += HORA) {
    const data = new Date(ms);
    const sol = Equator(Body.Sun, data, OBSERVADOR, true, true);
    if (Horizon(data, OBSERVADOR, sol.ra, sol.dec).altitude > SOL_MAXIM) continue;
    const visibles = COSOS.map((cos) => {
      const eq = Equator(cos, data, OBSERVADOR, true, true);
      return {
        cos,
        eq,
        altura: Horizon(data, OBSERVADOR, eq.ra, eq.dec).altitude,
        magnitud: Illumination(cos, data).mag,
      };
    }).filter(({ altura, magnitud }) => altura >= ALTURA_MINIMA && magnitud <= MAGNITUD_MAXIMA);
    for (let i = 0; i < visibles.length; i++)
      for (let j = i + 1; j < visibles.length; j++) {
        const a = visibles[i]!;
        const b = visibles[j]!;
        const angle = separacio(a.eq.ra, a.eq.dec, b.eq.ra, b.eq.dec);
        if (angle > SEPARACIO_MAXIMA) continue;
        const clau = `${a.cos}-${b.cos}`;
        const grup = grups.get(clau);
        if (grup && ms - grup.ultim > 48 * HORA) tanca(clau);
        const actual = grups.get(clau);
        const mostra = { ms, separacio: angle, a: a.cos, b: b.cos };
        if (!actual) grups.set(clau, { millor: mostra, ultim: ms });
        else {
          if (angle < actual.millor.separacio) actual.millor = mostra;
          actual.ultim = ms;
        }
      }
  }
  for (const clau of grups.keys()) tanca(clau);
}

/** Els límits són dies UTC inclosos; el resultat és estable i ordenat. */
export function calcularCalendari(desDe = '2026-10-01', finsA = '2027-12-31'): CalendariCalculat {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desDe) || !/^\d{4}-\d{2}-\d{2}$/.test(finsA) || desDe > finsA)
    throw new RangeError('Període UTC invàlid');
  const inici = Date.parse(`${desDe}T00:00:00Z`);
  const fi = Date.parse(`${finsA}T23:59:59Z`);
  if (!Number.isFinite(inici) || !Number.isFinite(fi)) throw new RangeError('Dates invàlides');
  const fenomens = fenomensBase();
  const esdeveniments: EsdevenimentCalculat[] = [];
  afegeixFases(inici, fi, esdeveniments);
  afegeixConjuncions(inici, fi, fenomens, esdeveniments);
  fenomens.sort((a, b) => a.codi.localeCompare(b.codi));
  esdeveniments.sort((a, b) => a.maxim.localeCompare(b.maxim) || a.codi.localeCompare(b.codi));
  return {
    versio_esquema: 1,
    periode: { des_de: desDe, fins_a: finsA },
    criteris: {
      lloc_referencia: { lat: 41.77, lon: 2.44, altitud_m: 1700 },
      separacio_maxima_graus: SEPARACIO_MAXIMA,
      altura_minima_graus: ALTURA_MINIMA,
      altura_sol_maxima_graus: SOL_MAXIM,
      magnitud_maxima: MAGNITUD_MAXIMA,
      llindar_superlluna_fraccio: 0.9,
    },
    fenomens,
    esdeveniments,
  };
}
