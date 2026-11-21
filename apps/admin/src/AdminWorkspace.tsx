import { useState } from 'react';

import { PuntForm } from './PuntForm';
import { PuntsList } from './PuntsList';
import { UsersList } from './UsersList';

type Screen = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; puntId: string };

type Props = {
  accessToken: string;
  currentUserId: string;
  onAccessDenied: () => void;
};

export function AdminWorkspace({ accessToken, currentUserId, onAccessDenied }: Props) {
  const [section, setSection] = useState<'points' | 'users'>('points');
  const [usersVisited, setUsersVisited] = useState(false);
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
    <section className="admin-workspace" aria-label="Administració">
      <nav className="admin-sections" aria-label="Seccions d’administració">
        <button
          type="button"
          aria-current={section === 'points' ? 'page' : undefined}
          onClick={() => setSection('points')}
        >
          Punts
        </button>
        <button
          type="button"
          aria-current={section === 'users' ? 'page' : undefined}
          onClick={() => {
            setUsersVisited(true);
            setSection('users');
          }}
        >
          Usuaris
        </button>
      </nav>
      <div id="admin-punts" className="admin-workspace-content" hidden={section !== 'points'}>
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
      <div id="admin-usuaris" className="admin-workspace-content" hidden={section !== 'users'}>
        {usersVisited ? (
          <UsersList
            accessToken={accessToken}
            currentUserId={currentUserId}
            onAccessDenied={onAccessDenied}
          />
        ) : null}
      </div>
    </section>
  );
}
