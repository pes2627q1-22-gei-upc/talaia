/**
 * Transicions entre pantalles: el lliscament d'iOS a les dues plataformes i, a iOS, tornar enrere
 * lliscant des de qualsevol punt de la pantalla. El fons de cada pantalla és el `background` del tema
 * de navegació (`_layout.tsx`), que canvia amb el mode nit.
 */
export const stackOptions = {
  headerShown: false,
  animation: 'ios_from_right',
  fullScreenGestureEnabled: true,
} as const;
