/** Plataforma d'un dispositiu que rep notificacions push (ADR-0028). */
export type PlataformaPush = 'ios' | 'android';

/**
 * Cos de `PUT /api/v1/perfil/dispositius` (TG-152): l'Expo push token del dispositiu
 * (`ExponentPushToken[…]`) i la plataforma. És un upsert idempotent per `token`.
 */
export type DispositiuPush = {
  token: string;
  plataforma: PlataformaPush;
};
