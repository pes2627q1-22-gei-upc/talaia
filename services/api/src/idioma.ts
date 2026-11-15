/** Idiomes dels textos editorials; el català és sempre la reserva per camp. */
export type Idioma = 'ca' | 'es' | 'en';

export function idiomesPreferits(acceptLanguage?: string): Idioma[] {
  if (!acceptLanguage) return ['ca'];
  const preferencies = acceptLanguage
    .split(',')
    .map((item, index) => {
      const [rawLanguage, ...parameters] = item.trim().toLowerCase().split(';');
      const language = rawLanguage?.split('-')[0];
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
      return { language, quality, index };
    })
    .filter(
      (item): item is { language: string; quality: number; index: number } =>
        Boolean(item.language) &&
        Number.isFinite(item.quality) &&
        item.quality > 0 &&
        item.quality <= 1,
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  const result = preferencies
    .map(({ language }) => language)
    .filter(
      (language): language is Idioma => language === 'ca' || language === 'es' || language === 'en',
    );
  return [...new Set<Idioma>([...result, 'ca'])];
}

export function idiomaPreferit(acceptLanguage?: string): Idioma {
  return idiomesPreferits(acceptLanguage)[0] ?? 'ca';
}

export function localized<T extends object>(
  texts: Partial<Record<Idioma, T>>,
  languages: Idioma[],
): T | undefined {
  const available = [...languages].reverse().flatMap((language) => {
    const value = texts?.[language];
    return value ? [value] : [];
  });
  return available.length ? (Object.assign({}, ...available) as T) : undefined;
}
