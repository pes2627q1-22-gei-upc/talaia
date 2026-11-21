import { useEffect, useMemo, useState } from 'react';
import type { EstatPunt, OrigenPunt, PuntAdmin } from '@talaia/shared';

import { getAdminPunts, PuntsApiError } from './puntsApi';

type Props = {
  accessToken: string;
  onAccessDenied: () => void;
};

type StatusFilter = 'TOTS' | EstatPunt;

const statusLabels: Record<EstatPunt, string> = {
  PENDENT: 'Pendent',
  PUBLICAT: 'Publicat',
  REBUTJAT: 'Rebutjat',
  DESACTIVAT: 'Desactivat',
};

const originLabels: Record<OrigenPunt, string> = {
  OFICIAL: 'Oficial',
  COMUNITAT: 'Comunitari',
};

export function PuntsList({ accessToken, onAccessDenied }: Props) {
  const [points, setPoints] = useState<PuntAdmin[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('TOTS');

  useEffect(() => {
    const controller = new AbortController();
    setPoints(null);
    setError('');

    void getAdminPunts(accessToken, controller.signal)
      .then(setPoints)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof PuntsApiError && (cause.status === 401 || cause.status === 403)) {
          onAccessDenied();
          return;
        }
        setError('No s’ha pogut carregar la llista de punts. Torna-ho a provar.');
      });

    return () => controller.abort();
  }, [accessToken, attempt, onAccessDenied]);

  const visiblePoints = useMemo(() => {
    if (!points) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return points.filter((point) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        point.nom.toLocaleLowerCase().includes(normalizedQuery) ||
        point.municipi.toLocaleLowerCase().includes(normalizedQuery);
      const matchesStatus = status === 'TOTS' || point.estat === status;
      return matchesQuery && matchesStatus;
    });
  }, [points, query, status]);

  return (
    <section aria-labelledby="punts-heading">
      <h2 id="punts-heading">Punts d’observació</h2>

      {points === null && !error ? <p role="status">Carregant punts…</p> : null}
      {error ? (
        <div>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)}>
            Torna-ho a provar
          </button>
        </div>
      ) : null}

      {points !== null ? (
        <>
          <div className="punts-controls">
            <label>
              Cerca per nom o municipi
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
                <option value="TOTS">Tots els estats</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {points.length === 0 ? <p role="status">Encara no hi ha punts al catàleg.</p> : null}
          {points.length > 0 && visiblePoints.length === 0 ? (
            <p role="status">No s’han trobat punts amb aquests criteris.</p>
          ) : null}
          {visiblePoints.length > 0 ? (
            <div className="punts-table-scroll">
              <table>
                <caption className="visually-hidden">Llista de punts d’observació</caption>
                <thead>
                  <tr>
                    <th scope="col">Nom</th>
                    <th scope="col">Municipi</th>
                    <th scope="col">Estat</th>
                    <th scope="col">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePoints.map((point) => (
                    <tr key={point.id}>
                      <th scope="row">{point.nom}</th>
                      <td>{point.municipi}</td>
                      <td>{statusLabels[point.estat]}</td>
                      <td>{originLabels[point.origen]}</td>
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
