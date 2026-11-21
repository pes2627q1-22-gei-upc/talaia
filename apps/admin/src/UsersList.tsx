import type { UsuariAdmin } from '@talaia/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getAdminUsers, UsersApiError } from './usersApi';

type Props = {
  accessToken: string;
  currentUserId: string;
  onAccessDenied: () => void;
};
type StatusFilter = 'all' | 'active' | 'blocked';

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ca');
}

export function UsersList({ accessToken, currentUserId, onAccessDenied }: Props) {
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const [users, setUsers] = useState<UsuariAdmin[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

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
    </section>
  );
}
