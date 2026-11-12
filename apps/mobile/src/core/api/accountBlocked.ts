/**
 * Codi d'error de l'API per a un compte bloquejat (TG-177, ADR-0029): 403 a qualsevol ruta
 * autenticada. El mateix literal que l'API; `@talaia/shared` només el documenta a `ApiErrorBody`.
 */
export const ACCOUNT_BLOCKED = 'account_blocked';

type Listener = () => void;

let blocked = false;
const listeners = new Set<Listener>();

function set(next: boolean) {
  if (blocked === next) return;
  blocked = next;
  for (const listener of listeners) listener();
}

/**
 * Estat global «el compte està bloquejat». El client HTTP l'activa en rebre `account_blocked`, així
 * cap Repository no se n'ha d'ocupar; la sessió el llegeix (`useSessionGate`) i el neteja en tancar-la.
 */
export const accountBlocked = {
  get: () => blocked,
  report: () => set(true),
  clear: () => set(false),
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
