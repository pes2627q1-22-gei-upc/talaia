import type { Esdeveniment } from '@talaia/shared';
import type { ImageSource } from 'expo-image';

import type { ColorToken } from '@/core/theme/tokens';

import { eventFilter, type CalendarFilter } from './calendarModel';

type IconType =
  'pluja_estels' | 'fase_llunar' | 'eclipsi_solar' | 'eclipsi_llunar' | 'conjuncio' | 'superlluna';

const icons: Record<IconType, ImageSource> = {
  pluja_estels: require('@/assets/images/calendar/pluja-estels.svg'),
  fase_llunar: require('@/assets/images/calendar/fase-llunar.svg'),
  eclipsi_solar: require('@/assets/images/calendar/eclipsi-solar.svg'),
  eclipsi_llunar: require('@/assets/images/calendar/eclipsi-llunar.svg'),
  conjuncio: require('@/assets/images/calendar/conjuncio.svg'),
  superlluna: require('@/assets/images/calendar/superlluna.svg'),
};

export const filterIcons: Record<CalendarFilter, ImageSource> = {
  all: require('@/assets/images/calendar/tots.svg'),
  meteor: icons.pluja_estels,
  moon: icons.fase_llunar,
  sun: icons.eclipsi_solar,
  other: icons.conjuncio,
};

export const filterColors: Record<Exclude<CalendarFilter, 'all'>, ColorToken> = {
  meteor: 'pedra',
  moon: 'ubicacio',
  sun: 'far',
  other: 'tap',
};

export function eventTypeLabelKey(type: string) {
  switch (type) {
    case 'pluja_estels':
    case 'fase_llunar':
    case 'eclipsi_solar':
    case 'eclipsi_llunar':
    case 'conjuncio':
    case 'superlluna':
      return type;
    default:
      return 'other';
  }
}

export function eventAppearance(event: Esdeveniment) {
  const filter = eventFilter(event.tipus);
  return { filter, icon: icons[event.tipus as IconType] ?? icons.conjuncio };
}
