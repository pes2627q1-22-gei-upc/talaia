import { useEffect, useMemo, useRef, useState } from 'react';
import type { EstatPunt, OrigenPunt, PuntAdmin } from '@talaia/shared';

import { getAdminPunts, patchAdminPunt, PuntsApiError } from './puntsApi';
import { ScrollableTable } from './ScrollableTable';

type Props = {
  accessToken: string;
  onAccessDenied: () => void;
  onCreate: () => void;
  onEdit: (puntId: string) => void;
};

type StatusFilter = 'TOTS' | EstatPunt;
type EditableStatus = 'DESACTIVAT' | 'PUBLICAT';

// Mateix slug que SLUG_PUNT_REFERENCIA de l’API (ADR-0026).
const REFERENCE_POINT_SLUG = 'centre-observacio-univers';

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

export function PuntsList({ accessToken, onAccessDenied, onCreate, onEdit }: Props) {
  // El token actualitza les peticions següents sense reiniciar la cerca ni els filtres.
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const [points, setPoints] = useState<PuntAdmin[] | null>(null);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [retireTarget, setRetireTarget] = useState<PuntAdmin | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('TOTS');
  const cancelRetireRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPoints(null);
    setError('');

    void getAdminPunts(accessTokenRef.current, controller.signal)
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
  }, [attempt, onAccessDenied]);

  const visiblePoints = useMemo(() => {
    if (!points) return [];
    const normalizedQuery = normalizeForSearch(query.trim());

    return points.filter((point) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        normalizeForSearch(point.nom).includes(normalizedQuery) ||
        normalizeForSearch(point.municipi).includes(normalizedQuery);
      const matchesStatus = status === 'TOTS' || point.estat === status;
      return matchesQuery && matchesStatus;
    });
  }, [points, query, status]);

  useEffect(() => {
    if (!retireTarget) return;

    const retireTargetId = retireTarget.id;
    cancelRetireRef.current?.focus();

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && pendingId !== retireTargetId) {
        event.preventDefault();
        setRetireTarget(null);
        setStatusError('');
        return;
      }

      if (event.key !== 'Tab') return;
      const buttons =
        dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) {
        event.preventDefault();
        return;
      }

      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => document.removeEventListener('keydown', handleDialogKeyDown);
  }, [pendingId, retireTarget]);

  async function changePointStatus(point: PuntAdmin, nextStatus: EditableStatus) {
    if (pendingId) return;

    setPendingId(point.id);
    setStatusError('');
    setStatusNotice('');

    try {
      const updated = await patchAdminPunt(accessTokenRef.current, point.id, { estat: nextStatus });
      setPoints(
        (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null,
      );
      setStatusNotice(
        nextStatus === 'DESACTIVAT'
          ? `${updated.nom} s’ha retirat i ja no apareix a l’aplicació.`
          : `${updated.nom} s’ha tornat a publicar.`,
      );
      if (nextStatus === 'DESACTIVAT') setRetireTarget(null);
    } catch (cause) {
      if (cause instanceof PuntsApiError && (cause.status === 401 || cause.status === 403)) {
        onAccessDenied();
        return;
      }

      setStatusError(statusChangeError(cause, point, nextStatus));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="punts-list" aria-labelledby="punts-heading">
      <div className="punts-heading-row">
        <h2 id="punts-heading">Punts d’observació</h2>
        <button type="button" onClick={onCreate}>
          Nou punt
        </button>
      </div>

      {points === null && !error ? (
        <p className="admin-state" role="status">
          Carregant punts…
        </p>
      ) : null}
      {error ? (
        <div>
          <p className="admin-message" role="alert">
            {error}
          </p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)}>
            Torna-ho a provar
          </button>
        </div>
      ) : null}

      {statusNotice ? (
        <p className="admin-message" role="status">
          {statusNotice}
        </p>
      ) : null}
      {statusError && !retireTarget ? (
        <p className="admin-message" role="alert">
          {statusError}
        </p>
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

          {points.length === 0 ? (
            <p className="admin-state" role="status">
              Encara no hi ha punts al catàleg.
            </p>
          ) : null}
          {points.length > 0 && visiblePoints.length === 0 ? (
            <p className="admin-state" role="status">
              No s’han trobat punts amb aquests criteris.
            </p>
          ) : null}
          {visiblePoints.length > 0 ? (
            <ScrollableTable label="Llista de punts d’observació">
              <table>
                <caption className="visually-hidden">Llista de punts d’observació</caption>
                <thead>
                  <tr>
                    <th scope="col">Nom</th>
                    <th scope="col">Municipi</th>
                    <th scope="col">Estat</th>
                    <th scope="col">Origen</th>
                    <th scope="col">Accions</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePoints.map((point) => (
                    <tr key={point.id}>
                      <th scope="row">{point.nom}</th>
                      <td>{point.municipi}</td>
                      <td>
                        <span
                          className={`punt-status punt-status--${point.estat.toLocaleLowerCase()}`}
                        >
                          {statusLabels[point.estat]}
                        </span>
                      </td>
                      <td>
                        <span className="punt-origin">{originLabels[point.origen]}</span>
                      </td>
                      <td>
                        <div className="punt-row-actions">
                          <button
                            className="button-secondary"
                            type="button"
                            aria-label={`Edita ${point.nom}`}
                            onClick={() => onEdit(point.id)}
                          >
                            Edita
                          </button>
                          {point.estat === 'PUBLICAT' && point.slug !== REFERENCE_POINT_SLUG ? (
                            <button
                              className="button-danger"
                              type="button"
                              aria-label={`Retira ${point.nom}`}
                              disabled={pendingId !== null}
                              onClick={() => {
                                setStatusError('');
                                setStatusNotice('');
                                setRetireTarget(point);
                              }}
                            >
                              Retira
                            </button>
                          ) : null}
                          {point.estat === 'DESACTIVAT' ? (
                            <button
                              className="button-secondary"
                              type="button"
                              aria-label={`Torna a publicar ${point.nom}`}
                              disabled={pendingId !== null}
                              onClick={() => void changePointStatus(point, 'PUBLICAT')}
                            >
                              Torna a publicar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          ) : null}
        </>
      ) : null}

      {retireTarget ? (
        <div className="punts-dialog-backdrop">
          <div
            ref={dialogRef}
            className="punts-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="retire-dialog-title"
            aria-describedby="retire-dialog-description"
          >
            <h3 id="retire-dialog-title">Retirar punt</h3>
            <p id="retire-dialog-description">
              Vols retirar <strong>{retireTarget.nom}</strong>? Deixarà d’aparèixer a l’aplicació.
            </p>
            {statusError ? (
              <p className="admin-message" role="alert">
                {statusError}
              </p>
            ) : null}
            <div className="punt-form-actions">
              <button
                ref={cancelRetireRef}
                type="button"
                disabled={pendingId !== null}
                onClick={() => {
                  setRetireTarget(null);
                  setStatusError('');
                }}
              >
                Cancel·la
              </button>
              <button
                type="button"
                disabled={pendingId !== null}
                onClick={() => void changePointStatus(retireTarget, 'DESACTIVAT')}
              >
                {pendingId === retireTarget.id ? 'Retirant…' : 'Confirma la retirada'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function statusChangeError(cause: unknown, point: PuntAdmin, nextStatus: EditableStatus) {
  if (cause instanceof PuntsApiError && cause.code === 'moderation_required') {
    return 'Aquest punt és pendent o rebutjat; el seu estat només es pot canviar des de moderació.';
  }

  if (cause instanceof PuntsApiError && cause.code === 'reference_point_required') {
    return 'Aquest és el punt de referència del calendari d’Aprop i no es pot retirar.';
  }

  const action = nextStatus === 'DESACTIVAT' ? 'retirar' : 'tornar a publicar';
  if (cause instanceof PuntsApiError) {
    return `No s’ha pogut ${action} ${point.nom}. ${cause.message} L’estat no s’ha canviat.`;
  }

  return `No s’ha pogut ${action} ${point.nom}; l’estat no s’ha canviat. Torna-ho a provar.`;
}

function normalizeForSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}
