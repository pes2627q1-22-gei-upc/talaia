import { useEffect, useState, type FormEvent } from 'react';
import type { EstatPunt, PuntAdmin } from '@talaia/shared';

import { createAdminPunt, getAdminPunt, patchAdminPunt, PuntsApiError } from './puntsApi';
import {
  createEmptyPuntForm,
  createPuntChanges,
  createPuntPayload,
  DIRECCIONS_HORITZO,
  valuesFromPunt,
  type PuntFormValues,
} from './puntFormModel';

type Props = {
  accessToken: string;
  puntId?: string;
  onCancel: () => void;
  onSaved: (action: 'created' | 'updated') => void;
  onAccessDenied: () => void;
};

const statusLabels: Record<EstatPunt, string> = {
  PENDENT: 'Pendent',
  PUBLICAT: 'Publicat',
  REBUTJAT: 'Rebutjat',
  DESACTIVAT: 'Desactivat',
};

function apiMessage(cause: unknown): string {
  if (!(cause instanceof PuntsApiError)) {
    return 'No s’ha pogut completar la petició. Comprova la connexió i torna-ho a provar.';
  }

  switch (cause.code) {
    case 'validation_error':
      return `Revisa les dades: ${cause.message}`;
    case 'slug_already_exists':
      return 'Ja existeix un punt amb aquest identificador. Tria’n un altre.';
    case 'punt_not_found':
      return 'Aquest punt ja no existeix. Torna a la llista i actualitza-la.';
    default:
      return cause.message;
  }
}

export function PuntForm({ accessToken, puntId, onCancel, onSaved, onAccessDenied }: Props) {
  const [values, setValues] = useState<PuntFormValues>(createEmptyPuntForm);
  const [original, setOriginal] = useState<PuntAdmin | null>(null);
  const [loading, setLoading] = useState(Boolean(puntId));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!puntId) return;

    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    void getAdminPunt(accessToken, puntId, controller.signal)
      .then((punt) => {
        setOriginal(punt);
        setValues(valuesFromPunt(punt));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof PuntsApiError && (cause.status === 401 || cause.status === 403)) {
          onAccessDenied();
          return;
        }
        setLoadError(apiMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [accessToken, loadAttempt, onAccessDenied, puntId]);

  function updateValue<Key extends keyof PuntFormValues>(key: Key, value: PuntFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError('');
    setFormStatus('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setFormStatus('');

    if (puntId) {
      if (!original) return;
      const parsed = createPuntChanges(values, original);
      if (!parsed.ok) {
        setFormError(parsed.error);
        return;
      }
      if (Object.keys(parsed.value).length === 0) {
        setFormStatus('No hi ha canvis per desar.');
        return;
      }

      setSaving(true);
      try {
        await patchAdminPunt(accessToken, puntId, parsed.value);
        onSaved('updated');
      } catch (cause) {
        if (cause instanceof PuntsApiError && (cause.status === 401 || cause.status === 403)) {
          onAccessDenied();
        } else {
          setFormError(apiMessage(cause));
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    const parsed = createPuntPayload(values);
    if (!parsed.ok) {
      setFormError(parsed.error);
      return;
    }

    setSaving(true);
    try {
      await createAdminPunt(accessToken, parsed.value);
      onSaved('created');
    } catch (cause) {
      if (cause instanceof PuntsApiError && (cause.status === 401 || cause.status === 403)) {
        onAccessDenied();
      } else {
        setFormError(apiMessage(cause));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status">Carregant les dades del punt…</p>;

  if (loadError) {
    return (
      <section aria-labelledby="punt-form-heading">
        <h2 id="punt-form-heading">Edita el punt</h2>
        <p role="alert">{loadError}</p>
        <button type="button" onClick={() => setLoadAttempt((current) => current + 1)}>
          Torna-ho a provar
        </button>{' '}
        <button type="button" onClick={onCancel}>
          Torna a la llista
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="punt-form-heading">
      <h2 id="punt-form-heading">{puntId ? 'Edita el punt' : 'Nou punt'}</h2>
      {original ? (
        <p>
          Estat actual: {statusLabels[original.estat]}. Origen:{' '}
          {original.origen === 'OFICIAL' ? 'Oficial' : 'Comunitari'}.
        </p>
      ) : null}
      <p>Un punt nou o mogut pot quedar sense índex fins al proper càlcul.</p>

      <form className="punt-form" onSubmit={(event) => void submit(event)}>
        <fieldset>
          <legend>Identificació</legend>
          <label>
            Identificador (slug)
            <input
              type="text"
              value={values.slug}
              onChange={(event) => updateValue('slug', event.target.value)}
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              readOnly={Boolean(puntId)}
              required
            />
          </label>
          <label>
            Nom
            <input
              type="text"
              value={values.nom}
              onChange={(event) => updateValue('nom', event.target.value)}
              maxLength={100}
              required
            />
          </label>
          <label>
            Municipi
            <input
              type="text"
              value={values.municipi}
              onChange={(event) => updateValue('municipi', event.target.value)}
              maxLength={100}
              required
            />
          </label>
          <label>
            Descripció
            <textarea
              value={values.descripcio}
              onChange={(event) => updateValue('descripcio', event.target.value)}
              maxLength={1000}
              rows={4}
              required
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Ubicació</legend>
          <div className="punt-form-coordinates">
            <label>
              Latitud
              <input
                type="number"
                value={values.lat}
                onChange={(event) => updateValue('lat', event.target.value)}
                min={40.5}
                max={42.9}
                step="any"
                required
              />
            </label>
            <label>
              Longitud
              <input
                type="number"
                value={values.lon}
                onChange={(event) => updateValue('lon', event.target.value)}
                min={0.15}
                max={3.35}
                step="any"
                required
              />
            </label>
          </div>
          <p className="field-hint">
            L’API comprova que les coordenades estiguin dins del contorn de Catalunya.
          </p>
          <label>
            Altitud (metres, opcional)
            <input
              type="number"
              value={values.altitud}
              onChange={(event) => updateValue('altitud', event.target.value)}
              min={0}
              max={3200}
              step={1}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Dades complementàries</legend>
          <fieldset className="horizon-options">
            <legend>Horitzó obert</legend>
            <p className="field-hint">Si no és clar, deixa totes les direccions sense marcar.</p>
            <div className="direction-options">
              {DIRECCIONS_HORITZO.map((direction) => (
                <label key={direction}>
                  <input
                    type="checkbox"
                    checked={values.horitzoObert.includes(direction)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...values.horitzoObert, direction]
                        : values.horitzoObert.filter((current) => current !== direction);
                      updateValue(
                        'horitzoObert',
                        DIRECCIONS_HORITZO.filter((item) => next.includes(item)),
                      );
                    }}
                  />
                  {direction}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Accessibilitat (opcional)
            <textarea
              value={values.accessibilitat}
              onChange={(event) => updateValue('accessibilitat', event.target.value)}
              maxLength={300}
              rows={3}
            />
          </label>
          <label>
            Foscor del cel SQM (10–23, opcional)
            <input
              type="number"
              value={values.sqm}
              onChange={(event) => updateValue('sqm', event.target.value)}
              min={10}
              max={23}
              step="any"
            />
          </label>
          {!puntId ? (
            <label>
              Estat inicial
              <select
                value={values.estat}
                onChange={(event) =>
                  updateValue('estat', event.target.value as PuntFormValues['estat'])
                }
              >
                <option value="PUBLICAT">Publicat</option>
                <option value="DESACTIVAT">Desactivat</option>
              </select>
            </label>
          ) : original && (original.estat === 'PENDENT' || original.estat === 'REBUTJAT') ? (
            <p>L’estat d’aquest punt només es pot canviar des de la moderació.</p>
          ) : null}
        </fieldset>

        {formError ? <p role="alert">{formError}</p> : null}
        {formStatus ? <p role="status">{formStatus}</p> : null}

        <div className="punt-form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Desant…' : puntId ? 'Desa els canvis' : 'Crea el punt'}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel·la
          </button>
        </div>
      </form>
    </section>
  );
}
