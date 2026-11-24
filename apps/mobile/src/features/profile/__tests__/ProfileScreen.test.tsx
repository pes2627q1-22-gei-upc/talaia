import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { usePreventRemove, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Perfil } from '@talaia/shared';

import { apiDelete, apiGet, apiPatch } from '@/core/api/httpClient';
import i18n, { LANGUAGE_KEY } from '@/core/i18n';
import { ThemeProvider, type ThemeName } from '@/core/theme/theme';
import { useAuthViewModel } from '@/features/auth/useAuthViewModel';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { ProfileScreen } from '../ProfileScreen';
import { MyProfileScreen } from '../MyProfileScreen';

jest.mock('@/features/auth/useAuthViewModel', () => ({ useAuthViewModel: jest.fn() }));
jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
}));
// La targeta de l'estat de l'API té la seva pròpia prova i necessita TanStack Query.
jest.mock('@/features/apiStatus/ApiStatusCard', () => ({ ApiStatusCard: () => null }));
jest.mock('expo-router', () => ({ useRouter: jest.fn(), usePreventRemove: jest.fn() }));

const push = jest.fn();
const back = jest.fn();
const replace = jest.fn();
jest
  .mocked(useRouter)
  .mockReturnValue({ push, back, replace } as unknown as ReturnType<typeof useRouter>);

type Auth = ReturnType<typeof useAuthViewModel>;

const signOut = jest.fn(async () => {});
const restore = jest.fn(async () => {});
const get = jest.mocked(apiGet);
const patch = jest.mocked(apiPatch);
const remove = jest.mocked(apiDelete);
const profile: Perfil = {
  id: 'p1',
  rol: 'usuari',
  authUserId: 'one',
  email: 'laia@example.cat',
  nom: 'Laia Puig',
  avatarUrl: null,
  dataCreacio: '2026-11-01T00:00:00Z',
  dataActualitzacio: '2026-11-01T00:00:00Z',
};

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

async function renderProfile(state: Auth, detail = false, theme: ThemeName = 'normal') {
  jest.mocked(useAuthViewModel).mockReturnValue(state);
  const QueryWrapper = createQueryWrapper();
  return await render(
    <QueryWrapper>
      <ThemeProvider name={theme}>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 393, height: 852 },
            insets: { top: 59, left: 0, right: 0, bottom: 34 },
          }}
        >
          {detail ? <MyProfileScreen /> : <ProfileScreen />}
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryWrapper>,
  );
}

describe('ProfileScreen · sessió (HU35)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    get.mockResolvedValue(profile);
    patch.mockResolvedValue(profile);
    remove.mockResolvedValue(undefined);
    await i18n.changeLanguage('ca');
  });

  it.each(['es', 'en', 'ca'] as const)(
    'canvia a %s amb els botons i tradueix la pantalla',
    async (language) => {
      // Per al català, comencem en un altre idioma per comprovar un canvi real.
      const previous = language === 'ca' ? 'en' : 'ca';
      await i18n.changeLanguage(previous);
      await renderProfile(auth());
      await fireEvent.press(
        screen.getByRole('button', {
          name: `${i18n.t('profile.language')}, ${i18n.t(`profile.languages.${previous}`)}`,
        }),
      );
      const targetLabel = i18n.t(`profile.languages.${language}`);
      expect(
        screen.getByRole('radio', { name: i18n.t(`profile.languages.${previous}`) }),
      ).toBeSelected();
      await fireEvent.press(screen.getByRole('radio', { name: targetLabel }));
      await waitFor(() => expect(i18n.language).toBe(language));
      expect(
        screen.getByRole('header', { name: i18n.t('profile.title', { lng: language }) }),
      ).toBeOnTheScreen();
      expect(
        screen.getAllByText(i18n.t(`profile.languages.${language}`, { lng: language })).length,
      ).toBeGreaterThan(0);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(LANGUAGE_KEY, language);
    },
  );

  it('l’opció del menú obre «El meu perfil»', async () => {
    await renderProfile(auth());
    expect(screen.getByText('Consulta les dades del compte')).toBeOnTheScreen();
    const myProfile = screen.getByRole('button', { name: 'El meu perfil' });
    expect(myProfile).toHaveProp('accessibilityHint', 'Consulta les dades del compte');
    await fireEvent.press(myProfile);
    expect(push).toHaveBeenCalledWith('/el-meu-perfil');
    expect(screen.getByRole('button', { name: 'Tanca la sessió' })).toBeOnTheScreen();
  });

  it('demana confirmació i només tanca la sessió si es confirma', async () => {
    await renderProfile(auth());
    expect(screen.getByRole('header', { name: 'Perfil' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tanca la sessió' }));
    expect(screen.getByRole('header', { name: 'Vols tancar la sessió?' })).toBeOnTheScreen();
    expect(signOut).not.toHaveBeenCalled();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Cancel·la' }).at(-1)!);
    expect(signOut).not.toHaveBeenCalled();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Tanca la sessió' })[0]!);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Tanca la sessió' }).at(-1)!);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('mostra el nom, el correu i les inicials del perfil, sense duplicar Alertes', async () => {
    await renderProfile(auth());
    expect(await screen.findByText('Laia Puig')).toBeOnTheScreen();
    expect(screen.getByText('laia@example.cat')).toBeOnTheScreen();
    expect(screen.getByText('LP', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('profile-avatar', { includeHiddenElements: true })).toHaveProp(
      'accessibilityElementsHidden',
      true,
    );
    expect(screen.getByTestId('profile-avatar', { includeHiddenElements: true })).toHaveProp(
      'importantForAccessibility',
      'no-hide-descendants',
    );
    expect(screen.getByText('Punts favorits')).toBeOnTheScreen();
    const favorites = screen.getByRole('button', { name: 'Punts favorits' });
    expect(favorites).toHaveProp('accessibilityHint', 'Consulta els punts que has desat');
    await fireEvent.press(favorites);
    expect(push).toHaveBeenCalledWith('/favorits');
    expect(screen.queryByRole('button', { name: 'Alertes' })).toBeNull();
    expect(get).toHaveBeenCalledWith('/perfil', undefined, { signal: expect.any(AbortSignal) });
    const language = screen.getByRole('button', { name: 'Idioma, Català' });
    expect(language).toBeOnTheScreen();
    expect(language.props.accessibilityHint).toBeUndefined();
  });

  it('si falla la càrrega, mostra l’error sense suggerir que falta el nom', async () => {
    get.mockRejectedValue(new Error('offline'));
    await renderProfile(auth());
    expect(await screen.findByText("No s'ha pogut carregar el perfil.")).toBeOnTheScreen();
    expect(screen.queryByText('Afegeix el teu nom')).toBeNull();
  });

  it('amaga la foto en mode nit i mostra les inicials', async () => {
    get.mockResolvedValue({ ...profile, avatarUrl: 'https://example.cat/avatar.jpg' });
    await renderProfile(auth(), false, 'vermell');
    expect(await screen.findByText('LP', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-avatar-image')).toBeNull();
  });

  it('mostra la foto en el tema normal', async () => {
    get.mockResolvedValue({ ...profile, avatarUrl: 'https://example.cat/avatar.jpg' });
    await renderProfile(auth());
    expect(
      await screen.findByTestId('profile-avatar-image', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('mostra les inicials en el detall en mode nit', async () => {
    get.mockResolvedValue({ ...profile, avatarUrl: 'https://example.cat/avatar.jpg' });
    await renderProfile(auth(), true, 'vermell');
    expect(await screen.findByText('LP', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-avatar-image')).toBeNull();
    expect(screen.getByTestId('profile-avatar', { includeHiddenElements: true })).toHaveProp(
      'accessibilityElementsHidden',
      true,
    );
  });

  it('porta el seu botó enrere i torna al perfil', async () => {
    await renderProfile(auth(), true);
    await fireEvent.press(screen.getByRole('button', { name: 'Torna al perfil' }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('mostra l’eliminació al detall i requereix una confirmació explícita', async () => {
    await renderProfile(auth(), true);
    const deleteButton = screen.getByRole('button', { name: 'Eliminar el compte' });
    expect(deleteButton).toBeOnTheScreen();
    expect(await screen.findByText('Laia Puig')).toBeOnTheScreen();
    await fireEvent.press(deleteButton);
    expect(
      screen.getByRole('header', { name: 'Segur que vols esborrar el teu compte?' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/No es podran recuperar/)).toBeOnTheScreen();
    expect(remove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Cancel·la' }).at(-1)!);
    expect(remove).not.toHaveBeenCalled();
    await fireEvent.press(deleteButton);
    await act(async () => {
      await fireEvent.press(screen.getAllByRole('button', { name: 'Eliminar el compte' }).at(-1)!);
    });
    expect(remove).toHaveBeenCalledWith('/perfil');
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/benvinguda');
  });

  it('si l’eliminació falla, manté la sessió i deixa reintentar', async () => {
    remove.mockRejectedValueOnce(new Error('offline'));
    await renderProfile(auth(), true);
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar el compte' }));
    await act(async () => {
      await fireEvent.press(screen.getAllByRole('button', { name: 'Eliminar el compte' }).at(-1)!);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      "No s'ha pogut eliminar el compte. Torna-ho a provar.",
    );
    expect(signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    await act(async () => {
      await fireEvent.press(screen.getAllByRole('button', { name: 'Eliminar el compte' }).at(-1)!);
    });
    expect(remove).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('durant l’eliminació, mostra l’estat de progrés i evita una segona petició', async () => {
    let finish!: () => void;
    remove.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    await renderProfile(auth(), true);
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar el compte' }));
    await act(async () => {
      await fireEvent.press(screen.getAllByRole('button', { name: 'Eliminar el compte' }).at(-1)!);
    });
    expect(screen.getByRole('button', { name: 'Eliminant el compte…' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Cancel·la' }).at(-1)).toBeDisabled();
    expect(remove).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('edita el nom i mostra el valor que ha desat l’API', async () => {
    patch.mockResolvedValue({ ...profile, nom: 'Laia Soler' });
    await renderProfile(auth(), true);
    expect(screen.queryByRole('button', { name: 'Desa' })).toBeNull();
    await screen.findByText('Laia Puig');
    await fireEvent.press(screen.getByRole('button', { name: 'Edita el nom, Laia Puig' }));
    await waitFor(() => expect(screen.getByLabelText('Nom')).toHaveProp('value', 'Laia Puig'));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Nom'), '  Laia Soler  '));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Desa' })));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/perfil', { nom: 'Laia Soler' }));
    expect(await screen.findByText('Laia Soler')).toBeOnTheScreen();
    expect(screen.getByText('LS', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('rebutja un nom buit i conserva l’edició si l’API falla', async () => {
    patch.mockRejectedValue(new Error('offline'));
    await renderProfile(auth(), true);
    await screen.findByText('Laia Puig');
    await fireEvent.press(screen.getByRole('button', { name: 'Edita el nom, Laia Puig' }));
    await waitFor(() => expect(screen.getByLabelText('Nom')).toHaveProp('value', 'Laia Puig'));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Nom'), '   '));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Desa' })));
    expect(screen.getByRole('alert')).toHaveTextContent("Escriu un nom d'entre 1 i 100 caràcters.");
    expect(patch).not.toHaveBeenCalled();
    await act(async () => fireEvent.changeText(screen.getByLabelText('Nom'), 'Laia Nova'));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Desa' })));
    expect(
      await screen.findByText("No s'ha pogut desar el nom. Torna-ho a provar."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveProp('value', 'Laia Nova');
  });

  it('cancel·lar l’edició conserva el nom anterior', async () => {
    await renderProfile(auth(), true);
    await screen.findByText('Laia Puig');
    await fireEvent.press(screen.getByRole('button', { name: 'Edita el nom, Laia Puig' }));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Nom'), 'Nom temporal'));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel·la' }));
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText('Laia Puig')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Nom')).toBeNull();
  });

  it('la tecla de retorn no envia un nom igual ni un nom de més de 100 caràcters', async () => {
    await renderProfile(auth(), true);
    await screen.findByText('Laia Puig');
    await fireEvent.press(screen.getByRole('button', { name: 'Edita el nom, Laia Puig' }));
    await act(async () => fireEvent(screen.getByLabelText('Nom'), 'submitEditing'));
    expect(patch).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Edita el nom, Laia Puig' }));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Nom'), 'A'.repeat(101)));
    await act(async () => fireEvent(screen.getByLabelText('Nom'), 'submitEditing'));
    expect(screen.getByRole('alert')).toHaveTextContent("Escriu un nom d'entre 1 i 100 caràcters.");
    expect(patch).not.toHaveBeenCalled();
  });

  it('en tirar enrere amb el nom modificat demana si es volen descartar els canvis', async () => {
    const repeat = jest.fn();
    await renderProfile(auth(), true);
    await screen.findByText('Laia Puig');
    await fireEvent.press(screen.getByRole('button', { name: 'Edita el nom, Laia Puig' }));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Nom'), 'Nom temporal'));
    const guard = jest.mocked(usePreventRemove).mock.calls.at(-1);
    expect(guard?.[0]).toBe(true);
    await act(async () => (guard?.[1] as (event: { repeat: () => void }) => void)({ repeat }));
    expect(screen.getByRole('header', { name: 'Tens canvis sense desar' })).toBeOnTheScreen();
    expect(screen.getByText('Segur que vols marxar?')).toBeOnTheScreen();
    expect(repeat).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Continua editant' }));
    expect(repeat).not.toHaveBeenCalled();
    await act(async () => (guard?.[1] as (event: { repeat: () => void }) => void)({ repeat }));
    await fireEvent.press(screen.getByRole('button', { name: 'Descarta els canvis' }));
    expect(repeat).toHaveBeenCalledTimes(1);
  });

  it('sense sessió no hi ha res a tancar', async () => {
    await renderProfile(auth({ user: null, isAuthenticated: false }));
    expect(screen.queryByRole('button', { name: 'Tanca la sessió' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Els meus plans' })).toBeNull();
  });

  it('sense sessió, el detall no ofereix eliminar el compte', async () => {
    await renderProfile(auth({ user: null, isAuthenticated: false }), true);
    expect(screen.queryByRole('button', { name: 'Eliminar el compte' })).toBeNull();
  });

  it('amb sessió, «Els meus plans» obre la llista de plans (TG-160)', async () => {
    await renderProfile(auth());
    await fireEvent.press(screen.getByRole('button', { name: 'Els meus plans' }));
    expect(push).toHaveBeenCalledWith('/plans');
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
