import { idiomesPreferits, localized } from '../idioma';
import { puntLocalitzat } from '../punts/localitzacio';

describe('idioma dels textos editorials', () => {
  it('interpreta variants regionals i pesos, i deixa català com a reserva', () => {
    expect(idiomesPreferits('en-US;q=0.6,es-ES;q=0.9,ca;q=0')).toEqual(['es', 'en', 'ca']);
    expect(idiomesPreferits('fr-FR')).toEqual(['ca']);
    expect(idiomesPreferits()).toEqual(['ca']);
  });

  it('completa camps absents des del català', () => {
    expect(
      localized({ ca: { nom: 'Lluna', nota: 'Català' }, es: { nom: 'Luna' } }, ['es', 'ca']),
    ).toEqual({ nom: 'Luna', nota: 'Català' });
  });

  it('no exposa el JSONB i manté els camps catalans si no hi ha traducció', () => {
    expect(
      puntLocalitzat(
        {
          nom: 'Montsec',
          descripcio: 'Cel fosc',
          accessibilitat: null,
          textos: { es: { nom: 'Montsec', descripcio: 'Cielo oscuro' } },
        },
        'es',
      ),
    ).toEqual({
      nom: 'Montsec',
      descripcio: 'Cielo oscuro',
      accessibilitat: null,
    });
  });
});
