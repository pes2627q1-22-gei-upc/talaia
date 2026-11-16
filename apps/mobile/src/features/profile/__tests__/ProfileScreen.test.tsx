import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n, { LANGUAGE_KEY } from '@/core/i18n';
import { useAuthViewModel } from '@/features/auth/useAuthViewModel';

import { ProfileScreen } from '../ProfileScreen';

jest.mock('@/features/auth/useAuthViewModel', () => ({ useAuthViewModel: jest.fn() }));
// La targeta de l'estat de l'API té la seva pròpia prova i necessita TanStack Query.
jest.mock('@/features/apiStatus/ApiStatusCard', () => ({ ApiStatusCard: () => null }));

type Auth = ReturnType<typeof useAuthViewModel>;

const signOut = jest.fn(async () => {});
const restore = jest.fn(async () => {});

/** L'estat de la sessió tal com el dona `useAuthViewModel`, amb els textos en català. */
function auth(overrides: Partial<Auth> = {}): Auth {
  const base = {
    user: { id: 'one', email: 'one@example.test' },
    loading: false,
    signingOut: false,
    blocked: false,
    error: null,
    isAuthenticated: true,
    logoutLabel: 'Tanca la sessió',
    errorMessage: null,
    retryLabel: 'Torna-ho a provar',
    signOut,
    restore,
  } satisfies Auth;
  return { ...base, ...overrides };
}

async function renderProfile(state: Auth) {
  jest.mocked(useAuthViewModel).mockReturnValue(state);
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ProfileScreen />
    </SafeAreaProvider>,
  );
}

describe('ProfileScreen · sessió (HU35)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('ca');
  });

  it.each(['es', 'en', 'ca'] as const)(
    'canvia a %s amb els botons i tradueix la pantalla',
    async (language) => {
      // Per al català, comencem en un altre idioma per comprovar un canvi real.
      const previous = language === 'ca' ? 'en' : 'ca';
      await i18n.changeLanguage(previous);
      await renderProfile(auth());
      const targetLabel = i18n.t(`profile.languages.${language}`);
      expect(
        screen.getByRole('button', { name: i18n.t(`profile.languages.${previous}`) }),
      ).toBeSelected();
      await fireEvent.press(screen.getByRole('button', { name: targetLabel }));
      await waitFor(() => expect(i18n.language).toBe(language));
      expect(
        screen.getByRole('header', { name: i18n.t('profile.title', { lng: language }) }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', {
          name: i18n.t(`profile.languages.${language}`, { lng: language }),
        }),
      ).toBeSelected();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(LANGUAGE_KEY, language);
    },
  );

  it('amb sessió, «Tanca la sessió» la tanca', async () => {
    await renderProfile(auth());
    expect(screen.getByRole('header', { name: 'Perfil' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tanca la sessió' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('sense sessió no hi ha res a tancar', async () => {
    await renderProfile(auth({ user: null, isAuthenticated: false }));
    expect(screen.queryByRole('button', { name: 'Tanca la sessió' })).toBeNull();
  });

  it('mentre es tanca, el botó ho diu i no es pot tornar a prémer', async () => {
    await renderProfile(auth({ signingOut: true, logoutLabel: 'Tancant la sessió…' }));
    const button = screen.getByRole('button', { name: 'Tancant la sessió…' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('mentre es restaura la sessió, tampoc', async () => {
    await renderProfile(auth({ loading: true }));
    expect(screen.getByRole('button', { name: 'Tanca la sessió' })).toBeDisabled();
  });

  it('si el logout falla, ho anuncia i la sessió continua oberta', async () => {
    await renderProfile(
      auth({
        error: 'logout',
        errorMessage: "No s'ha pogut tancar la sessió. Torna-ho a provar.",
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "No s'ha pogut tancar la sessió. Torna-ho a provar.",
    );
    expect(screen.getByRole('button', { name: 'Tanca la sessió' })).toBeOnTheScreen();
    // Reintentar és tornar a prémer «Tanca la sessió», no un botó a part.
    expect(screen.queryByRole('button', { name: 'Torna-ho a provar' })).toBeNull();
  });

  it("si no s'ha pogut recuperar la sessió, ofereix tornar-ho a provar", async () => {
    await renderProfile(
      auth({
        user: null,
        isAuthenticated: false,
        error: 'restore',
        errorMessage: "No s'ha pogut recuperar la sessió. Torna-ho a provar.",
      }),
    );
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(restore).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });
});
