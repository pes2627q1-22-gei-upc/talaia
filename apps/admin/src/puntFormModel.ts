import type {
  DireccioHoritzo,
  EstatPuntAdmin,
  PuntAdmin,
  PuntAdminCanvis,
  PuntAdminNou,
} from '@talaia/shared';

export const DIRECCIONS_HORITZO: DireccioHoritzo[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export type PuntFormValues = {
  slug: string;
  nom: string;
  municipi: string;
  descripcio: string;
  lat: string;
  lon: string;
  altitud: string;
  horitzoObert: DireccioHoritzo[];
  accessibilitat: string;
  sqm: string;
  estat: EstatPuntAdmin;
};

type ParsedFields = Omit<PuntAdminNou, 'slug' | 'estat'>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function createEmptyPuntForm(): PuntFormValues {
  return {
    slug: '',
    nom: '',
    municipi: '',
    descripcio: '',
    lat: '',
    lon: '',
    altitud: '',
    horitzoObert: [],
    accessibilitat: '',
    sqm: '',
    estat: 'PUBLICAT',
  };
}

export function valuesFromPunt(punt: PuntAdmin): PuntFormValues {
  return {
    slug: punt.slug,
    nom: punt.nom,
    municipi: punt.municipi,
    descripcio: punt.descripcio,
    lat: String(punt.lat),
    lon: String(punt.lon),
    altitud: punt.altitud === null ? '' : String(punt.altitud),
    horitzoObert: DIRECCIONS_HORITZO.filter((direction) => punt.horitzoObert?.includes(direction)),
    accessibilitat: punt.accessibilitat ?? '',
    sqm: punt.sqm === null ? '' : String(punt.sqm),
    estat: punt.estat === 'DESACTIVAT' ? 'DESACTIVAT' : 'PUBLICAT',
  };
}

function readText(value: string, label: string, maxLength: number): ParseResult<string> {
  const text = value.trim();
  if (text.length === 0) return { ok: false, error: `Indica ${label}.` };
  if (text.length > maxLength) {
    return { ok: false, error: `${label} no pot tenir més de ${maxLength} caràcters.` };
  }
  return { ok: true, value: text };
}

function readNumber(value: string, label: string): ParseResult<number> {
  const parsed = Number(value);
  if (value.trim() === '' || !Number.isFinite(parsed)) {
    return { ok: false, error: `Indica un valor numèric vàlid per a ${label}.` };
  }
  return { ok: true, value: parsed };
}

function readOptionalNumber(value: string, label: string): ParseResult<number | null> {
  if (value.trim() === '') return { ok: true, value: null };
  return readNumber(value, label);
}

function parseFields(values: PuntFormValues): ParseResult<ParsedFields> {
  const nom = readText(values.nom, 'el nom', 100);
  if (!nom.ok) return nom;
  const municipi = readText(values.municipi, 'el municipi', 100);
  if (!municipi.ok) return municipi;
  const descripcio = readText(values.descripcio, 'la descripció', 1000);
  if (!descripcio.ok) return descripcio;
  const lat = readNumber(values.lat, 'la latitud');
  if (!lat.ok) return lat;
  const lon = readNumber(values.lon, 'la longitud');
  if (!lon.ok) return lon;
  if (lat.value < 40.5 || lat.value > 42.9 || lon.value < 0.15 || lon.value > 3.35) {
    return {
      ok: false,
      error: 'La ubicació ha d’estar dins dels límits inicials de Catalunya.',
    };
  }

  const altitud = readOptionalNumber(values.altitud, 'l’altitud');
  if (!altitud.ok) return altitud;
  if (
    altitud.value !== null &&
    (!Number.isInteger(altitud.value) || altitud.value < 0 || altitud.value > 3200)
  ) {
    return { ok: false, error: 'L’altitud ha de ser un enter entre 0 i 3.200 metres.' };
  }

  const sqm = readOptionalNumber(values.sqm, 'la brillantor SQM');
  if (!sqm.ok) return sqm;
  if (sqm.value !== null && (sqm.value < 10 || sqm.value > 23)) {
    return { ok: false, error: 'La brillantor SQM ha d’estar entre 10 i 23.' };
  }

  const accessibilitat = values.accessibilitat.trim();
  if (accessibilitat.length > 300) {
    return { ok: false, error: 'L’accessibilitat no pot tenir més de 300 caràcters.' };
  }

  return {
    ok: true,
    value: {
      nom: nom.value,
      municipi: municipi.value,
      descripcio: descripcio.value,
      lat: lat.value,
      lon: lon.value,
      altitud: altitud.value,
      horitzoObert: values.horitzoObert.length ? values.horitzoObert : null,
      accessibilitat: accessibilitat || null,
      sqm: sqm.value,
    },
  };
}

export function createPuntPayload(values: PuntFormValues): ParseResult<PuntAdminNou> {
  const slug = values.slug.trim();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    return {
      ok: false,
      error: 'L’identificador ha de tenir minúscules, xifres i guions, sense accents.',
    };
  }

  const fields = parseFields(values);
  if (!fields.ok) return fields;
  return { ok: true, value: { slug, ...fields.value, estat: values.estat } };
}

export function createPuntChanges(
  values: PuntFormValues,
  original: PuntAdmin,
): ParseResult<PuntAdminCanvis> {
  const fields = parseFields(values);
  if (!fields.ok) return fields;

  const changes: PuntAdminCanvis = {};
  const next = fields.value;
  if (next.nom !== original.nom) changes.nom = next.nom;
  if (next.municipi !== original.municipi) changes.municipi = next.municipi;
  if (next.descripcio !== original.descripcio) changes.descripcio = next.descripcio;
  if (next.lat !== original.lat || next.lon !== original.lon) {
    changes.lat = next.lat;
    changes.lon = next.lon;
  }
  if (next.altitud !== original.altitud) changes.altitud = next.altitud;
  const originalHorizon = DIRECCIONS_HORITZO.filter((direction) =>
    original.horitzoObert?.includes(direction),
  );
  const nextHorizon = next.horitzoObert ?? [];
  if (nextHorizon.join(',') !== originalHorizon.join(',')) {
    changes.horitzoObert = next.horitzoObert;
  }
  if (next.accessibilitat !== original.accessibilitat) {
    changes.accessibilitat = next.accessibilitat;
  }
  if (next.sqm !== original.sqm) changes.sqm = next.sqm;

  return { ok: true, value: changes };
}
