import { useState } from 'react';

import { PuntForm } from './PuntForm';
import { PuntsList } from './PuntsList';

type Screen = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; puntId: string };

type Props = {
  accessToken: string;
  onAccessDenied: () => void;
};

export function AdminWorkspace({ accessToken, onAccessDenied }: Props) {
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const [notice, setNotice] = useState('');

  function openCreate() {
    setNotice('');
    setScreen({ kind: 'create' });
  }

  function openEdit(puntId: string) {
    setNotice('');
    setScreen({ kind: 'edit', puntId });
  }

  function returnToList() {
    setScreen({ kind: 'list' });
  }

  function saved(action: 'created' | 'updated') {
    setNotice(action === 'created' ? 'Punt creat correctament.' : 'Canvis desats correctament.');
    setScreen({ kind: 'list' });
  }

  return (
    <section className="admin-workspace" aria-label="Administració de punts">
      <nav className="admin-sections" aria-label="Seccions d’administració">
        <a href="#admin-punts" aria-current="page">
          Punts
        </a>
      </nav>
      <div id="admin-punts" className="admin-workspace-content">
        {notice ? (
          <p className="admin-message" role="status">
            {notice}
          </p>
        ) : null}
        {screen.kind === 'list' ? (
          <PuntsList
            accessToken={accessToken}
            onAccessDenied={onAccessDenied}
            onCreate={openCreate}
            onEdit={openEdit}
          />
        ) : (
          <PuntForm
            key={screen.kind === 'edit' ? screen.puntId : 'create'}
            accessToken={accessToken}
            puntId={screen.kind === 'edit' ? screen.puntId : undefined}
            onCancel={returnToList}
            onSaved={saved}
            onAccessDenied={onAccessDenied}
          />
        )}
      </div>
    </section>
  );
}
