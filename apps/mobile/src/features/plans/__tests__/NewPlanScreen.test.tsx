import type { Esdeveniment } from '@talaia/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError, apiGet, apiPost, apiPut } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { asPointResponse } from '@/features/point/__fixtures__/point';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { NewPlanScreen } from '../NewPlanScreen';
import { plan } from '../__fixtures__/plan';
import { CalendarPermissionError, planCalendarRepository } from '../planCalendarRepository';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: jest.fn(),
}));
jest.mock('../planCalendarRepository', () => ({
  ...jest.requireActual('../planCalendarRepository'),
  planCalendarRepository: {
    isSupported: jest.fn(() => false),
    requestCalendars: jest.fn(),
    createEvent: jest.fn(),
  },
}));
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('expo-haptics');

const get = jest.mocked(apiGet);
const post = jest.mocked(apiPost);
const back = jest.fn();
jest.mocked(useRouter).mockReturnValue({ back } as unknown as ReturnType<typeof useRouter>);

const orionides = {
  id: 'orionides-2026',
  tipus: 'pluja_estels',
  nom: 'Oriònides',
  inici: '2026-10-02T00:00:00Z',
  fi: '2026-11-07T00:00:00Z',
  maxim: '2026-10-21T20:00:00Z',
  descripcio: '',
  ubicacio: 'global',
  font: 'IMO',
} as unknown as Esdeveniment;

const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderScreen() {
  const QueryWrapper = createQueryWrapper();
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={METRICS}>
          <QueryWrapper>{children}</QueryWrapper>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }
  return render(<NewPlanScreen puntId="montsec" inici="2026-10-21T21:15:00Z" />, {
    wrapper: Wrapper,
  });
}

// Pantalla sencera: en paral·lel amb la resta, l'entorn de Skia endarrereix el primer render.
jest.setTimeout(15_000);

beforeEach(async () => {
  // Dimecres 21 d'octubre de 2026 a les 18:07; només el rellotge, no els temporitzadors.
  jest.useFakeTimers({
    now: new Date(2026, 9, 21, 18, 7),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'performance',
      'hrtime',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
    ],
  });
  get.mockReset();
  get.mockImplementation((async (path: string) =>
    path === '/esdeveniments' ? { data: [orionides] } : asPointResponse()) as typeof apiGet);
  post.mockReset();
  jest.mocked(apiPut).mockReset();
  jest.mocked(apiPut).mockResolvedValue(undefined);
  jest.mocked(planCalendarRepository.isSupported).mockReturnValue(false);
  jest.mocked(planCalendarRepository.requestCalendars).mockReset();
  jest.mocked(planCalendarRepository.requestCalendars).mockResolvedValue({
    status: 'ready',
    calendars: [
      { id: 'google', title: 'Personal', account: 'Google' },
      { id: 'local', title: 'Local', account: 'Mòbil' },
    ],
  });
  jest.mocked(planCalendarRepository.createEvent).mockReset();
  jest.mocked(planCalendarRepository.createEvent).mockResolvedValue('event-1');
  back.mockReset();
  await i18n.changeLanguage('ca');
});

afterEach(() => {
  jest.useRealTimers();
});

it.each(['ca', 'es', 'en'])(
  'permet triar el calendari i recuperar un error sense perdre el pla (%s)',
  async (language) => {
    await i18n.changeLanguage(language);
    jest.mocked(planCalendarRepository.isSupported).mockReturnValue(true);
    post.mockResolvedValue(plan);
    jest
      .mocked(planCalendarRepository.createEvent)
      .mockRejectedValueOnce(new Error('calendar failure'));
    await renderScreen();
    await fireEvent.press(screen.getByRole('switch', { name: i18n.t('plans.calendar.label') }));
    const target = await screen.findByRole('button', {
      name: `${i18n.t('plans.calendar.target')}: Personal · Google`,
    });
    await fireEvent.press(target);
    expect(
      screen.getByRole('radio', { name: 'Personal, Google', selected: true }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Local, Mòbil' }));
    expect(
      screen.getByRole('button', { name: `${i18n.t('plans.calendar.target')}: Local · Mòbil` }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('plans.new.save') }));
    expect(
      await screen.findByRole('header', { name: i18n.t('plans.calendar.savedTitle') }),
    ).toBeOnTheScreen();
    expect(await screen.findByText(i18n.t('plans.calendar.syncErrors.create'))).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: i18n.t('plans.new.retry') }));
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(post).toHaveBeenCalledTimes(1);
    expect(planCalendarRepository.createEvent).toHaveBeenLastCalledWith(
      'local',
      expect.objectContaining({ location: 'Serra del Montsec, Àger' }),
    );
  },
);

it('Continua surt de la pantalla i conserva el pla si falla el calendari', async () => {
  jest.mocked(planCalendarRepository.isSupported).mockReturnValue(true);
  post.mockResolvedValue(plan);
  jest.mocked(planCalendarRepository.createEvent).mockRejectedValue(new Error('calendar failure'));
  await renderScreen();
  await fireEvent.press(screen.getByRole('switch', { name: i18n.t('plans.calendar.label') }));
  await screen.findByRole('button', { name: /Personal · Google/ });
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('plans.new.save') }));
  await screen.findByText(i18n.t('plans.calendar.syncErrors.create'));
  await fireEvent.press(screen.getByText(i18n.t('plans.calendar.continue')));
  await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledTimes(1);
});

it("l'enrere queda fora del formulari desplaçable i també surt en desar el calendari", async () => {
  jest.mocked(planCalendarRepository.isSupported).mockReturnValue(true);
  post.mockResolvedValue(plan);
  jest.mocked(planCalendarRepository.createEvent).mockRejectedValue(new Error('calendar failure'));
  await renderScreen();
  const backLabel = i18n.t('plans.new.back');
  expect(screen.getByRole('button', { name: backLabel })).toBeOnTheScreen();
  expect(
    within(screen.getByTestId('new-plan-scroll')).queryByRole('button', { name: backLabel }),
  ).toBeNull();

  await fireEvent.press(screen.getByRole('switch', { name: i18n.t('plans.calendar.label') }));
  await screen.findByRole('button', { name: /Personal · Google/ });
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('plans.new.save') }));
  await screen.findByText(i18n.t('plans.calendar.syncErrors.create'));
  await fireEvent.press(screen.getByRole('button', { name: backLabel }));
  expect(back).toHaveBeenCalledTimes(1);
});

it('Obre la configuració després de revocar el permís en desar el pla', async () => {
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  jest.mocked(planCalendarRepository.isSupported).mockReturnValue(true);
  post.mockResolvedValue(plan);
  jest
    .mocked(planCalendarRepository.createEvent)
    .mockRejectedValue(new CalendarPermissionError(false));
  await renderScreen();
  await fireEvent.press(screen.getByRole('switch', { name: i18n.t('plans.calendar.label') }));
  await screen.findByRole('button', { name: /Personal · Google/ });
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('plans.new.save') }));
  await fireEvent.press(
    await screen.findByRole('button', { name: i18n.t('plans.calendar.settings') }),
  );
  expect(openSettings).toHaveBeenCalledTimes(1);
  openSettings.mockRestore();
});

it('sense suport natiu mostra l’avís, desactiva l’opció i permet desar el pla', async () => {
  await renderScreen();
  expect(screen.getByRole('switch', { name: i18n.t('plans.calendar.label') })).toBeDisabled();
  expect(screen.getByText(i18n.t('plans.calendar.unavailable'))).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: i18n.t('plans.new.save') })).toBeEnabled();
  expect(planCalendarRepository.requestCalendars).not.toHaveBeenCalled();
});

it('ensenya els blocs del mockup 06 i un esquelet mentre arriba el punt', async () => {
  let resolvePoint: (value: unknown) => void = () => undefined;
  get.mockImplementation(((path: string) =>
    path === '/esdeveniments'
      ? Promise.resolve({ data: [] })
      : new Promise<unknown>((resolve) => {
          resolvePoint = resolve;
        })) as typeof apiGet);
  await renderScreen();

  expect(screen.getByRole('header', { name: "Pla d'observació" })).toBeOnTheScreen();
  expect(screen.getByTestId('plan-point-loading')).toBeOnTheScreen();
  for (const label of ["Punt d'observació", 'Fenomen', 'Notes']) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
  expect(screen.getByRole('button', { name: "Dia: Dc. 21 d'oct." })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Hora de sortida: 23:15' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Fenomen: Cap en concret' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Desa el pla' })).toBeEnabled();
  // No hi ha columna `titol`; el calendari és opcional i no demana permís en entrar.
  expect(screen.queryByText('Títol')).toBeNull();
  expect(
    screen.getByRole('switch', { name: 'Afegeix-lo al meu calendari', checked: false }),
  ).toBeOnTheScreen();

  resolvePoint(asPointResponse());
  expect(await screen.findByText('Serra del Montsec')).toBeOnTheScreen();
  expect(screen.queryByTestId('plan-point-loading')).toBeNull();
});

it("l'hora de sortida s'obre en un full amb les rodes d'hora i minuts", async () => {
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Hora de sortida: 23:15' }));
  expect(screen.getByRole('header', { name: 'Hora de sortida' })).toBeOnTheScreen();

  await fireEvent(screen.getByRole('adjustable', { name: 'Hora' }), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  });
  expect(screen.getByRole('button', { name: 'Hora de sortida: 22:15' })).toBeOnTheScreen();
  expect(screen.getByRole('adjustable', { name: 'Minuts' })).toBeOnTheScreen();
});

it('una hora passada desactiva el botó i ho explica', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Hora de sortida: 23:15' }));
  for (let step = 0; step < 6; step += 1) {
    await fireEvent(screen.getByRole('adjustable', { name: 'Hora' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
  }
  expect(screen.getByRole('button', { name: 'Hora de sortida: 17:15' })).toBeOnTheScreen();
  expect(screen.getByRole('alert')).toHaveTextContent(
    "L'hora de sortida ja ha passat. Tria'n una de més tard.",
  );
  expect(screen.getByRole('button', { name: 'Desa el pla' })).toBeDisabled();
});

it('el fenomen es tria en un full, amb «Cap en concret» primer', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Fenomen: Cap en concret' }));
  expect(screen.getByRole('header', { name: 'Què aniràs a veure?' })).toBeOnTheScreen();
  const options = await screen.findAllByRole('radio');
  expect(options.map((option) => option.props.accessibilityLabel)).toEqual([
    'Cap en concret',
    "Pluja d'estels: Oriònides, Dc. 21 d'oct.",
  ]);
  expect(options[0]).toBeSelected();

  await fireEvent.press(options[1]!);
  expect(
    screen.getByRole('button', { name: "Fenomen: Pluja d'estels: Oriònides" }),
  ).toBeOnTheScreen();
});

it('desa el pla i torna enrere', async () => {
  post.mockResolvedValue({ id: 'p1' });
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Notes'), 'Frontal vermell');
  await fireEvent.press(screen.getByRole('button', { name: 'Desa el pla' }));
  await waitFor(() => expect(back).toHaveBeenCalled());
  expect(post).toHaveBeenCalledWith(
    '/plans',
    expect.objectContaining({ puntId: 'montsec', notes: 'Frontal vermell' }),
  );
});

it("ensenya l'error de l'API sota el botó", async () => {
  post.mockRejectedValue(new ApiError(409, 'plan_limit_reached', ''));
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Desa el pla' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Has arribat al màxim de 20 plans pendents.',
  );
  expect(back).not.toHaveBeenCalled();
});

it('en castellà, els textos més llargs surten sencers', async () => {
  await i18n.changeLanguage('es');
  await renderScreen();
  expect(screen.getByRole('header', { name: 'Plan de observación' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Fenómeno: Ninguno en concreto' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Hora de salida: 23:15' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Guarda el plan' })).toBeOnTheScreen();
  // L'etiqueta de la targeta es pot escurçar, però el valor s'ajusta a l'amplada sense tallar-se.
  expect(screen.getByText('Mié. 21 oct.').props.adjustsFontSizeToFit).toBe(true);
});
