import { idiomesPreferits, localized, type Idioma } from '../idioma';

type TextPunt = { nom?: unknown; descripcio?: unknown; accessibilitat?: unknown };

/** Traduccions per camp; les columnes catalanes continuen essent la reserva. */
export function puntLocalitzat<
  T extends { nom: string; descripcio?: string; accessibilitat?: string | null; textos?: unknown },
>(punt: T, acceptLanguage?: string): Omit<T, 'textos'> {
  const { textos, ...base } = punt;
  const traduccio = localized(
    (textos ?? {}) as Partial<Record<Idioma, TextPunt>>,
    idiomesPreferits(acceptLanguage),
  );
  const valor = (v: unknown, reserva: string) =>
    typeof v === 'string' && v.trim() ? v.trim() : reserva;
  return {
    ...base,
    nom: valor(traduccio?.nom, punt.nom),
    ...('descripcio' in punt
      ? { descripcio: valor(traduccio?.descripcio, punt.descripcio ?? '') }
      : {}),
    ...('accessibilitat' in punt
      ? {
          accessibilitat:
            traduccio?.accessibilitat === null
              ? null
              : valor(traduccio?.accessibilitat, punt.accessibilitat ?? '') || null,
        }
      : {}),
  } as Omit<T, 'textos'>;
}
