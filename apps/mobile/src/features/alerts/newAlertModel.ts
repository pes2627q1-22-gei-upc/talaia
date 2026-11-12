/** Distància màxima des de l'origen, en km. L'API n'accepta d'1 a 200 (TG-145). */
export const DISTANCE = { min: 5, max: 200, step: 5, initial: 50 } as const;

/** Índex mínim per avisar. Per defecte, 70: on comença la franja «cel ras» (ADR-0018). */
export const MIN_INDEX = { min: 0, max: 100, step: 5, initial: 70 } as const;
