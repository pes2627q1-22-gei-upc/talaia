import type { UsuariAdmin } from '@talaia/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getAdminUsers, patchAdminUser, UsersApiError } from './usersApi';

type Props = {
  accessToken: string;
  currentUserId: string;
  active: boolean;
  onAccessDenied: () => void;
};
type StatusFilter = 'all' | 'active' | 'blocked';

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ca');
}

export function UsersList({ accessToken, currentUserId, active, onAccessDenied }: Props) {
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const [users, setUsers] = useState<UsuariAdmin[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [target, setTarget] = useState<UsuariAdmin | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingRef = useRef(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setUsers(null);
    setError(false);
    void getAdminUsers(tokenRef.current, controller.signal)
      .then(setUsers)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof UsersApiError && (cause.status === 401 || cause.status === 403)) {
          onAccessDenied();
          return;
        }
        setError(true);
      });
    return () => controller.abort();
  }, [attempt, onAccessDenied]);

  useEffect(() => {
    if (!active) setTarget(null);
  }, [active]);

  useEffect(() => {
    if (active && (notice || actionError)) feedbackRef.current?.focus();
  }, [active, notice, actionError]);

  useEffect(() => {
    if (!target || !active) return;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pendingRef.current) {
        event.preventDefault();
        setTarget(null);
        triggerRef.current?.focus();
      } else if (event.key === 'Tab') {
        const buttons =
          dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === buttons[0]) {
          event.preventDefault();
          buttons[buttons.length - 1]?.focus();
        } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
          event.preventDefault();
          buttons[0]?.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [target, active]);

  async function changeBlocked(user: UsuariAdmin, blocked: boolean) {
    if (pendingRef.current || uncertain || (blocked && user.authUserId === currentUserId)) return;
    pendingRef.current = true;
    setPending(true);
    setActionError('');
    setNotice('');
    try {
      const updated = await patchAdminUser(tokenRef.current, user.id, { bloquejat: blocked });
      setUsers(
        (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null,
      );
      setTarget(null);
      setNotice(
        `Compte ${blocked ? 'bloquejat' : 'desbloquejat'} correctament: ${identify(updated)}.`,
      );
    } catch (cause) {
      if (cause instanceof UsersApiError && (cause.status === 401 || cause.status === 403)) {
        onAccessDenied();
        return;
      }
      setTarget(null);
      if (cause instanceof UsersApiError && cause.code === 'cannot_block_self') {
        setActionError('No pots bloquejar el teu propi compte.');
      } else if (cause instanceof UsersApiError && cause.status === 404) {
        setActionError('Aquest usuari ja no existeix. Actualitza la llista.');
        setUncertain(true);
      } else if (cause instanceof UsersApiError && cause.status >= 400 && cause.status < 500) {
        setActionError('No s’ha pogut canviar l’estat del compte. Torna-ho a provar.');
      } else {
        setActionError(
          'No s’ha pogut confirmar el resultat. Actualitza la llista abans de tornar-ho a provar.',
        );
        setUncertain(true);
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function refreshUsers() {
    setActionError('');
    setNotice('');
    setUncertain(false);
    setAttempt((value) => value + 1);
  }

  const visibleUsers = useMemo(() => {
    const search = normalize(query.trim());
    return (users ?? []).filter((user) => {
      const matchesQuery = [user.nom, user.email].some((value) =>
        normalize(value ?? '').includes(search),
      );
      return matchesQuery && (status === 'all' || user.bloquejat === (status === 'blocked'));
    });
  }, [users, query, status]);

  return (
    <section aria-labelledby="users-heading">
      <h2 id="users-heading">Usuaris</h2>
      {notice ? (
        <p ref={feedbackRef} tabIndex={-1} className="admin-message" role="status">
          {notice}
        </p>
      ) : null}
      {actionError ? (
        <div>
          <p ref={feedbackRef} tabIndex={-1} className="admin-message" role="alert">
            {actionError}
          </p>
          {uncertain ? (
            <button type="button" onClick={refreshUsers}>
              Actualitza la llista
            </button>
          ) : null}
        </div>
      ) : null}
      {users === null && !error ? (
        <p className="admin-state" role="status">
          Carregant usuaris…
        </p>
      ) : null}
      {error ? (
        <div>
          <p className="admin-message" role="alert">
            No s’han pogut carregar els usuaris. Torna-ho a provar.
          </p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Torna-ho a provar
          </button>
        </div>
      ) : null}
      {users !== null ? (
        <>
          <div className="punts-controls">
            <label>
              Cerca per nom o correu
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              Filtra per estat
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
              >
                <option value="all">Tots els estats</option>
                <option value="active">Actius</option>
                <option value="blocked">Bloquejats</option>
              </select>
            </label>
          </div>
          {users.length === 0 ? <p className="admin-state">Encara no hi ha usuaris.</p> : null}
          {users.length > 0 && visibleUsers.length === 0 ? (
            <p className="admin-state">No s’han trobat usuaris amb aquests criteris.</p>
          ) : null}
          {visibleUsers.length > 0 ? (
            <div className="punts-table-scroll">
              <table>
                <caption className="visually-hidden">Llista d’usuaris</caption>
                <thead>
                  <tr>
                    <th scope="col">Nom</th>
                    <th scope="col">Correu</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estat</th>
                    <th scope="col">Data de bloqueig</th>
                    <th scope="col">Accions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => (
                    <tr key={user.id}>
                      <th scope="row">
                        {user.nom ?? 'Sense nom'}
                        {user.authUserId === currentUserId ? ' (el teu compte)' : ''}
                      </th>
                      <td>{user.email ?? 'Sense correu'}</td>
                      <td>{user.rol === 'admin' ? 'Administrador' : 'Usuari'}</td>
                      <td>
                        <span
                          className={`punt-status ${user.bloquejat ? 'punt-status--rebutjat' : 'punt-status--publicat'}`}
                        >
                          {user.bloquejat ? 'Bloquejat' : 'Actiu'}
                        </span>
                      </td>
                      <td>
                        {user.authUserId === currentUserId ? (
                          <span>No pots bloquejar el teu compte</span>
                        ) : (
                          <button
                            type="button"
                            className={user.bloquejat ? 'button-secondary' : 'button-danger'}
                            disabled={pending || uncertain}
                            aria-label={`${user.bloquejat ? 'Desbloqueja' : 'Bloqueja'} ${identify(user)}`}
                            onClick={(event) => {
                              if (user.bloquejat) void changeBlocked(user, false);
                              else {
                                triggerRef.current = event.currentTarget;
                                setActionError('');
                                setNotice('');
                                setTarget(user);
                              }
                            }}
                          >
                            {user.bloquejat ? 'Desbloqueja' : 'Bloqueja'}
                          </button>
                        )}
                      </td>
                      <td>
                        {user.dataBloqueig
                          ? new Intl.DateTimeFormat('ca-ES', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(user.dataBloqueig))
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
      {target && active ? (
        <div className="punts-dialog-backdrop">
          <div
            ref={dialogRef}
            className="punts-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="block-title"
            aria-describedby="block-description"
          >
            <h3 id="block-title">Bloquejar compte</h3>
            <p id="block-description">
              Vols bloquejar <strong>{identify(target)}</strong>? El compte no podrà utilitzar les
              funcions protegides de l’API. Podràs desbloquejar-lo més endavant.
            </p>
            <div className="punt-form-actions">
              <button
                ref={cancelRef}
                type="button"
                disabled={pending}
                onClick={() => {
                  setTarget(null);
                  triggerRef.current?.focus();
                }}
              >
                Cancel·la
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void changeBlocked(target, true)}
              >
                {pending ? 'Bloquejant…' : 'Confirma el bloqueig'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function identify(user: UsuariAdmin) {
  return user.email
    ? `${user.nom ?? 'Sense nom'} (${user.email})`
    : `${user.nom ?? 'Sense nom'} (ID: ${user.id})`;
}
