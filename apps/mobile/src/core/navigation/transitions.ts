import { colors } from '@/core/theme/tokens';

/**
 * Transicions entre pantalles: el lliscament d'iOS a les dues plataformes i, a iOS, tornar enrere
 * lliscant des de qualsevol punt de la pantalla.
 */
export const stackOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.nit },
  animation: 'ios_from_right',
  fullScreenGestureEnabled: true,
} as const;
