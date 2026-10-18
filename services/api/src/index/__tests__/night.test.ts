import { NightSchema, defaultNight, nightWindow } from '../night';

const iso = ({ from, to }: { from: Date; to: Date }) => [from.toISOString(), to.toISOString()];

describe('nightWindow', () => {
  it("va de les 12:00 locals del dia a les 12:00 de l'endemà, en UTC", () => {
    // Estiu (UTC+2) i hivern (UTC+1).
    expect(iso(nightWindow('2026-07-10'))).toEqual([
      '2026-07-10T10:00:00.000Z',
      '2026-07-11T10:00:00.000Z',
    ]);
    expect(iso(nightWindow('2026-01-10'))).toEqual([
      '2026-01-10T11:00:00.000Z',
      '2026-01-11T11:00:00.000Z',
    ]);
  });

  it("la nit del canvi d'hora dura 25 h a l'octubre i 23 h al març", () => {
    // 2026: l'hora d'estiu acaba el 25/10 i comença el 29/03, totes dues de matinada.
    expect(iso(nightWindow('2026-10-24'))).toEqual([
      '2026-10-24T10:00:00.000Z',
      '2026-10-25T11:00:00.000Z',
    ]);
    expect(iso(nightWindow('2026-03-28'))).toEqual([
      '2026-03-28T11:00:00.000Z',
      '2026-03-29T10:00:00.000Z',
    ]);
  });

  it("passa de mes i d'any", () => {
    expect(iso(nightWindow('2026-12-31'))).toEqual([
      '2026-12-31T11:00:00.000Z',
      '2027-01-01T11:00:00.000Z',
    ]);
  });
});

describe('defaultNight', () => {
  it("fins al migdia local és la nit que s'està acabant; després, la que ve", () => {
    expect(defaultNight(new Date('2026-10-20T01:00:00Z'))).toBe('2026-10-19'); // 03:00 local
    expect(defaultNight(new Date('2026-10-20T09:59:00Z'))).toBe('2026-10-19'); // 11:59 local
    expect(defaultNight(new Date('2026-10-20T10:00:00Z'))).toBe('2026-10-20'); // 12:00 local
    expect(defaultNight(new Date('2026-10-20T21:30:00Z'))).toBe('2026-10-20'); // 23:30 local
    expect(defaultNight(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31'); // 00:30 local de l'1 de gener: la nit del 31
  });
});

describe('NightSchema', () => {
  it.each(['2026-10-19', '2028-02-29'])('accepta %s', (nit) => {
    expect(NightSchema.safeParse(nit).success).toBe(true);
  });

  it.each(['19/10/2026', '2026-10-9', '2026-13-01', '2026-02-30', '2027-02-29', ''])(
    'rebutja %s',
    (nit) => {
      expect(NightSchema.safeParse(nit).success).toBe(false);
    },
  );
});
