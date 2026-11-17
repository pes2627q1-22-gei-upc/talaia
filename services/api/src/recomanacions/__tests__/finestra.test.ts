import { finestraEsdeveniment, type EsdevenimentPerFinestra } from '../finestra';

const DIA = { inici: 'dia', fi: 'dia', maxim: 'minut' };

// Leònides 2026 (seed de l'IMO): activitat del 6 al 30/11, màxim el 17/11 a les 23:45 UTC.
const LEONIDES: EsdevenimentPerFinestra = {
  inici: new Date('2026-11-06T00:00:00Z'),
  fi: new Date('2026-11-30T23:59:59Z'),
  maxim: new Date('2026-11-17T23:45:00Z'),
  precisio: DIA,
};

// Conjunció Lluna–Júpiter (Astronomy Engine): una hora coneguda.
const CONJUNCIO: EsdevenimentPerFinestra = {
  inici: new Date('2026-11-30T05:30:00Z'),
  fi: new Date('2026-11-30T06:30:00Z'),
  maxim: new Date('2026-11-30T06:00:00Z'),
  precisio: { inici: 'hora', fi: 'hora', maxim: 'hora' },
};

const iso = (f: ReturnType<typeof finestraEsdeveniment>) =>
  f && { data: f.data, desDe: f.desDe.toISOString(), finsA: f.finsA.toISOString() };

describe('finestraEsdeveniment', () => {
  describe('hores conegudes (precisió d’hora o més fina)', () => {
    it('[inici, fi] ampliada a les hores senceres que la toquen', () => {
      expect(iso(finestraEsdeveniment(CONJUNCIO, new Date('2026-11-16T12:00:00Z')))).toEqual({
        data: '2026-11-29',
        desDe: '2026-11-30T05:00:00.000Z',
        finsA: '2026-11-30T06:30:00.000Z',
      });
    });

    it('un eclipsi de diverses hores: totes les hores entre l’inici i la fi', () => {
      const eclipsi: EsdevenimentPerFinestra = {
        inici: new Date('2027-02-20T21:12:00Z'),
        fi: new Date('2027-02-21T01:13:00Z'),
        maxim: new Date('2027-02-20T23:13:00Z'),
        precisio: { inici: 'minut', fi: 'minut', maxim: 'minut' },
      };
      expect(iso(finestraEsdeveniment(eclipsi, new Date('2026-11-16T12:00:00Z')))).toEqual({
        data: '2027-02-20',
        desDe: '2027-02-20T21:00:00.000Z',
        finsA: '2027-02-21T01:13:00.000Z',
      });
    });

    it('en curs: la mateixa finestra (el servei en retalla les hores passades)', () => {
      const f = finestraEsdeveniment(CONJUNCIO, new Date('2026-11-30T06:10:00Z'));
      expect(f?.desDe.toISOString()).toBe('2026-11-30T05:00:00.000Z');
    });

    it('acabada → null', () => {
      expect(finestraEsdeveniment(CONJUNCIO, new Date('2026-11-30T06:31:00Z'))).toBeNull();
    });
  });

  describe('precisió de dia', () => {
    it('abans del màxim: la nit del màxim sencera, de 12:00 a 12:00 locals', () => {
      expect(iso(finestraEsdeveniment(LEONIDES, new Date('2026-11-16T10:00:00Z')))).toEqual({
        data: '2026-11-17',
        desDe: '2026-11-17T11:00:00.000Z',
        finsA: '2026-11-18T11:00:00.000Z',
      });
    });

    it('la mateixa nit del màxim, de matinada: encara aquella nit', () => {
      const f = finestraEsdeveniment(LEONIDES, new Date('2026-11-18T03:00:00Z'));
      expect(f?.data).toBe('2026-11-17');
    });

    it('un màxim de dia és el de la nit que el conté (Gemínides: 14:00 UTC del 14/12)', () => {
      const geminides: EsdevenimentPerFinestra = {
        inici: new Date('2026-12-04T00:00:00Z'),
        fi: new Date('2026-12-20T23:59:59Z'),
        maxim: new Date('2026-12-14T14:00:00Z'),
        precisio: { inici: 'dia', fi: 'dia', maxim: 'hora' },
      };
      expect(finestraEsdeveniment(geminides, new Date('2026-12-01T12:00:00Z'))?.data).toBe(
        '2026-12-14',
      );
    });

    it('un màxim de matinada és de la nit del vespre anterior (Lluna nova: 01:52 locals del 9/12)', () => {
      const llunaNova: EsdevenimentPerFinestra = {
        inici: new Date('2026-12-08T23:00:00Z'),
        fi: new Date('2026-12-09T22:59:59Z'),
        maxim: new Date('2026-12-09T00:52:31Z'),
        precisio: { inici: 'dia', fi: 'dia', maxim: 'segon' },
      };
      expect(iso(finestraEsdeveniment(llunaNova, new Date('2026-12-01T12:00:00Z')))).toEqual({
        data: '2026-12-08',
        desDe: '2026-12-08T11:00:00.000Z',
        finsA: '2026-12-09T11:00:00.000Z',
      });
    });

    it('sense màxim: la nit que comença el vespre del primer dia', () => {
      const f = finestraEsdeveniment(
        { ...LEONIDES, maxim: null },
        new Date('2026-11-01T12:00:00Z'),
      );
      expect(iso(f)).toEqual({
        data: '2026-11-06',
        desDe: '2026-11-06T11:00:00.000Z',
        finsA: '2026-11-07T11:00:00.000Z',
      });
    });

    it('màxim passat però encara activa: la nit que toca ara, no un 400', () => {
      // 20/11 a les 15:00 locals: la nit que toca és la del 20.
      expect(iso(finestraEsdeveniment(LEONIDES, new Date('2026-11-20T14:00:00Z')))).toEqual({
        data: '2026-11-20',
        desDe: '2026-11-20T11:00:00.000Z',
        finsA: '2026-11-21T11:00:00.000Z',
      });
    });

    it('al matí de després del màxim (a partir de les 06:00), ja la nit que ve', () => {
      const f = finestraEsdeveniment(LEONIDES, new Date('2026-11-18T06:00:00Z'));
      expect(f?.data).toBe('2026-11-18');
    });

    it('sense màxim i amb la primera nit passada: la nit que toca ara', () => {
      const f = finestraEsdeveniment(
        { ...LEONIDES, maxim: null },
        new Date('2026-11-10T02:30:00Z'), // 03:30 locals del 10/11: encara la nit del 9
      );
      expect(iso(f)).toEqual({
        data: '2026-11-09',
        desDe: '2026-11-09T11:00:00.000Z',
        finsA: '2026-11-10T11:00:00.000Z',
      });
    });

    it('l’última nit, just abans de fi: retallada a fi', () => {
      // 30/11 a les 23:00 locals; fi = 00:59:59 locals de l'1/12.
      expect(iso(finestraEsdeveniment(LEONIDES, new Date('2026-11-30T22:00:00Z')))).toEqual({
        data: '2026-11-30',
        desDe: '2026-11-30T11:00:00.000Z',
        finsA: '2026-11-30T23:59:59.000Z',
      });
    });

    it('un segon després de fi → null (franja_passada)', () => {
      expect(finestraEsdeveniment(LEONIDES, new Date('2026-12-01T00:00:00Z'))).toBeNull();
    });

    it('una fi al matí, abans que comenci la nit que toca: de l’hora en curs a la fi', () => {
      const f = finestraEsdeveniment(
        { ...LEONIDES, fi: new Date('2026-11-20T09:30:00Z') },
        new Date('2026-11-20T07:15:00Z'), // 08:15 locals: la nit que toca ja és la del 20
      );
      expect(iso(f)).toEqual({
        data: '2026-11-19',
        desDe: '2026-11-20T07:00:00.000Z',
        finsA: '2026-11-20T09:30:00.000Z',
      });
    });

    it('al canvi d’hora (CEST → CET), la nit fa 25 hores', () => {
      const f = finestraEsdeveniment(
        {
          ...LEONIDES,
          inici: new Date('2026-10-20T00:00:00Z'),
          maxim: new Date('2026-10-24T23:00:00Z'),
        },
        new Date('2026-10-01T12:00:00Z'),
      );
      expect(iso(f)).toEqual({
        data: '2026-10-24',
        desDe: '2026-10-24T10:00:00.000Z',
        finsA: '2026-10-25T11:00:00.000Z',
      });
    });
  });
});
