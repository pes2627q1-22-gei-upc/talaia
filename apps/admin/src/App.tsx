import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';

import { AdminWorkspace } from './AdminWorkspace';
import { authClient, checkAdmin, completeAuthRedirect } from './auth';

type Access = 'loading' | 'signed-out' | 'checking' | 'allowed' | 'denied' | 'error';

export function App() {
  const [access, setAccess] = useState<Access>('loading');
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const accessRef = useRef<Access>('loading');
  const adminTokenRef = useRef<string | null>(null);
  const adminUserIdRef = useRef<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authClient) {
      setAccess('error');
      return;
    }
    const client = authClient;
    let active = true;
    let checkId = 0;
    const check = async (session: Session | null) => {
      const id = ++checkId;
      const token = session?.access_token;
      const userId = session?.user.id;
      if (!token || !userId) {
        if (active) {
          adminTokenRef.current = null;
          setAdminToken(null);
          adminUserIdRef.current = null;
          setAdminUserId(null);
          setEmail('');
          setCode('');
          setCodeSent(false);
          setMessage('');
          accessRef.current = 'signed-out';
          setAccess('signed-out');
        }
        return;
      }
      // Revalidar una sessió renovada en segon pla no ha de desmuntar l'espai ni perdre'n l'estat.
      const wasAllowed = accessRef.current === 'allowed' && adminUserIdRef.current === userId;
      if (wasAllowed) {
        adminTokenRef.current = token;
        setAdminToken(token);
      } else {
        adminTokenRef.current = null;
        setAdminToken(null);
        adminUserIdRef.current = null;
        setAdminUserId(null);
        accessRef.current = 'checking';
        setAccess('checking');
      }
      try {
        const result = await checkAdmin(token);
        if (active && id === checkId) {
          adminTokenRef.current = result === 'allowed' ? token : null;
          setAdminToken(result === 'allowed' ? token : null);
          adminUserIdRef.current = result === 'allowed' ? userId : null;
          setAdminUserId(result === 'allowed' ? userId : null);
          accessRef.current = result;
          setAccess(result);
          setMessage('');
        }
      } catch {
        if (active && id === checkId) {
          if (wasAllowed) {
            setMessage(
              'No s’ha pogut revalidar l’accés. Torna-ho a provar quan recuperis la connexió.',
            );
          } else {
            adminTokenRef.current = null;
            setAdminToken(null);
            accessRef.current = 'error';
            setAccess('error');
          }
        }
      }
    };
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (active) void check(session);
    });
    const start = async () => {
      try {
        await completeAuthRedirect();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (active) void check(data.session);
      } catch {
        if (active) {
          setMessage('No s’ha pogut completar l’inici de sessió. Torna-ho a provar.');
          accessRef.current = 'error';
          setAccess('error');
        }
      }
    };
    void start();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleAdminAccessDenied = useCallback(() => {
    adminTokenRef.current = null;
    setAdminToken(null);
    adminUserIdRef.current = null;
    setAdminUserId(null);
    accessRef.current = 'denied';
    setAccess('denied');
  }, []);

  async function signInGoogle() {
    if (!authClient) return;
    setMessage('');
    try {
      const { error } = await authClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
    } catch {
      setMessage('No s’ha pogut iniciar la sessió amb Google.');
    }
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authClient) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await authClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setCodeSent(true);
      setMessage('T’hem enviat un codi al correu.');
    } catch {
      setMessage('No s’ha pogut enviar el codi. Comprova el correu i torna-ho a provar.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authClient) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await authClient.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw error;
    } catch {
      setMessage('El codi no és vàlid o ha caducat.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!authClient) return;
    try {
      const { error } = await authClient.auth.signOut();
      if (error) throw error;
    } catch {
      setMessage('No s’ha pogut tancar la sessió.');
    }
  }

  return (
    <main className="admin-app">
      <header className="admin-page-header">
        <h1>
          Talaia <span>· Administració</span>
        </h1>
      </header>
      {access === 'loading' || access === 'checking' ? (
        <p className="admin-state">Comprovant l’accés…</p>
      ) : null}
      {access === 'error' ? (
        <p className="admin-message" role="alert">
          No s’ha pogut comprovar l’accés. Revisa la configuració o la connexió i torna a carregar
          la pàgina.
        </p>
      ) : null}
      {access === 'denied' ? (
        <section className="admin-auth-panel" aria-label="Accés denegat">
          <p className="admin-message" role="alert">
            Aquest compte no té accés a l’administració.
          </p>
          <button className="button-secondary" onClick={() => void signOut()}>
            Tanca la sessió
          </button>
        </section>
      ) : null}
      {access === 'allowed' ? (
        <>
          <div className="admin-access-row">
            <p className="admin-access-status">Accés d’administrador confirmat.</p>
            <button className="button-secondary" onClick={() => void signOut()}>
              Tanca la sessió
            </button>
          </div>
          {adminToken && adminUserId ? (
            <AdminWorkspace
              accessToken={adminToken}
              currentUserId={adminUserId}
              onAccessDenied={handleAdminAccessDenied}
            />
          ) : null}
        </>
      ) : null}
      {access === 'signed-out' ? (
        <section className="admin-auth-panel" aria-label="Inicia sessió">
          <p>Inicia sessió amb el mateix compte de Talaia que té el rol d’administrador.</p>
          <button className="button-secondary" onClick={() => void signInGoogle()}>
            Continua amb Google
          </button>
          {!codeSent ? (
            <form onSubmit={(event) => void sendCode(event)}>
              <label>
                Correu electrònic{' '}
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <button type="submit" disabled={busy}>
                Envia’m un codi
              </button>
            </form>
          ) : (
            <form onSubmit={(event) => void verifyCode(event)}>
              <label>
                Codi de sis xifres{' '}
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
              </label>
              <button type="submit" disabled={busy}>
                Verifica el codi
              </button>
            </form>
          )}
        </section>
      ) : null}
      {message ? (
        <p className="admin-message" role="status">
          {message}
        </p>
      ) : null}
    </main>
  );
}
