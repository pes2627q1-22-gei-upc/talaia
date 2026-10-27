import ca from '../locales/ca.json';
import en from '../locales/en.json';
import es from '../locales/es.json';

function keys(object: object, prefix = ''): string[] {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('traduccions', () => {
  const reference = keys(ca).sort();

  it.each([
    ['es', es],
    ['en', en],
  ])('%s té exactament les mateixes claus que el català', (_language, locale) => {
    expect(keys(locale).sort()).toEqual(reference);
  });

  it('no hi ha cap text buit', () => {
    for (const locale of [ca, es, en]) {
      const empty = keys(locale).filter((key) => {
        const value = key
          .split('.')
          .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], locale);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(empty).toEqual([]);
    }
  });
});
