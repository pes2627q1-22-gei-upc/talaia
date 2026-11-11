import { useEffect, useState, type FormEvent } from 'react';

import { authClient, checkAdmin, completeAuthRedirect } from './auth';

type Access = 'loading' | 'signed-out' | 'checking' | 'allowed' | 'denied' | 'error';

export function App() {
  const [access, setAccess] = useState<Access>('loading');
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
    const check = async (token: string | undefined) => {
      const id = ++checkId;
      if (!token) {
        if (active) {
          setEmail('');
          setCode('');
          setCodeSent(false);
          setMessage('');
          setAccess('signed-out');
        }
        return;
      }
      setAccess('checking');
      try {
        const result = await checkAdmin(token);
        if (active && id === checkId) setAccess(result);
      } catch {
        if (active && id === checkId) setAccess('error');
      }
    };
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (active) void check(session?.access_token);
    });
    const start = async () => {
      try {
        await completeAuthRedirect();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (active) void check(data.session?.access_token);
      } catch {
        if (active) {
          setMessage('No s’ha pogut completar l’inici de sessió. Torna-ho a provar.');
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
    <main>
      <h1>Talaia · Administració</h1>
      {access === 'loading' || access === 'checking' ? <p>Comprovant l’accés…</p> : null}
      {access === 'error' ? (
        <p role="alert">
          No s’ha pogut comprovar l’accés. Revisa la configuració o la connexió i torna a carregar
          la pàgina.
        </p>
      ) : null}
      {access === 'denied' ? (
        <>
          <p role="alert">Aquest compte no té accés a l’administració.</p>
          <button onClick={() => void signOut()}>Tanca la sessió</button>
        </>
      ) : null}
      {access === 'allowed' ? (
        <>
          <p>Accés d’administrador confirmat.</p>
          <p>La gestió de punts s’afegirà en una tasca posterior.</p>
          <button onClick={() => void signOut()}>Tanca la sessió</button>
        </>
      ) : null}
      {access === 'signed-out' ? (
        <section aria-label="Inicia sessió">
          <p>Inicia sessió amb el mateix compte de Talaia que té el rol d’administrador.</p>
          <button onClick={() => void signInGoogle()}>Continua amb Google</button>
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
              <button disabled={busy}>Envia’m un codi</button>
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
              <button disabled={busy}>Verifica el codi</button>
            </form>
          )}
        </section>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
