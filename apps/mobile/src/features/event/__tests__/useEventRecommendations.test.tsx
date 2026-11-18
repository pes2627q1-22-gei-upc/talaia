import type { Esdeveniment } from '@talaia/shared';
import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState, Linking } from 'react-native';

import i18n from '@/core/i18n';

import { useCurrentPlaceQuery } from '../../explore/locationRepository';
import { useEventRecommendations } from '../useEventRecommendations';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../explore/locationRepository', () => ({ useCurrentPlaceQuery: jest.fn() }));
const location = jest.mocked(useCurrentPlaceQuery);
const refetch = jest.fn();
const event = { id: 'leonids-2026', nom: 'Leònids', fi: '2099-11-30T23:59:59Z' } as Esdeveniment;
const ready = {
  isError: false,
  data: { status: 'ready', place: { lat: 41.981234, lon: 2.821234, name: '' } },
};
function query(overrides: object = {}) {
  location.mockReturnValue({
    isFetching: false,
    isError: false,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useCurrentPlaceQuery>);
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  refetch.mockReset().mockResolvedValue(ready);
  query();
  await i18n.changeLanguage('ca');
});

it('no demana ubicació en obrir la fitxa i impedeix dos salts per un doble toc', async () => {
  let resolve!: (value: typeof ready) => void;
  refetch.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result } = await renderHook(() => useEventRecommendations(event));
  expect(location).toHaveBeenCalledWith(false);
  expect(refetch).not.toHaveBeenCalled();
  let first!: Promise<void>;
  await act(async () => {
    first = result.current.onPress('18 de novembre');
    await result.current.onPress('18 de novembre');
  });
  expect(refetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(ready);
    await first;
  });
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/calendari/recomanacions',
    params: {
      esdevenimentId: event.id,
      eventName: event.nom,
      eventWhen: '18 de novembre',
      lat: '41.981',
      lon: '2.821',
    },
  });
});

it('el botó indica que busca la ubicació i queda desactivat mentre espera', async () => {
  query({ isFetching: true });
  const { result } = await renderHook(() => useEventRecommendations(event));
  expect(result.current).toMatchObject({
    label: i18n.t('explore.origin.locating'),
    disabled: true,
  });
});

it('sense permís o si falla el GPS es queda a la fitxa i permet reintentar', async () => {
  refetch.mockResolvedValueOnce({ data: { status: 'denied', canAskAgain: true } });
  query({ data: { status: 'denied', canAskAgain: true } });
  const { result, rerender } = await renderHook(() => useEventRecommendations(event));
  expect(result.current.message).toBe(i18n.t('explore.origin.denied'));
  await act(() => result.current.onPress('18 de novembre'));
  expect(router.push).not.toHaveBeenCalled();
  refetch.mockResolvedValueOnce({ isError: true });
  query({ isError: true });
  await rerender({});
  expect(result.current.message).toBe(i18n.t('explore.origin.error'));
  await act(() => result.current.onPress('18 de novembre'));
  expect(router.push).not.toHaveBeenCalled();
  refetch.mockResolvedValueOnce(ready);
  await act(() => result.current.onPress('18 de novembre'));
  expect(router.push).toHaveBeenCalledTimes(1);
});

it('obre la configuració quan el permís està bloquejat i el revisa quan es torna a l’app', async () => {
  const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const listen = jest.spyOn(AppState, 'addEventListener');
  query({ data: { status: 'denied', canAskAgain: false } });
  const { result, unmount } = await renderHook(() => useEventRecommendations(event));
  expect(result.current.label).toBe(i18n.t('explore.origin.settings'));
  await act(() => result.current.onPress('18 de novembre'));
  expect(settings).toHaveBeenCalledTimes(1);
  expect(router.push).not.toHaveBeenCalled();
  const listener = listen.mock.calls.at(-1)![1];
  await act(async () => listener('active'));
  expect(refetch).toHaveBeenCalledTimes(1);
  await unmount();
  settings.mockRestore();
  listen.mockRestore();
});

it('si es tanca la fitxa mentre espera la ubicació no navega després', async () => {
  let resolve!: (value: typeof ready) => void;
  refetch.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result, unmount } = await renderHook(() => useEventRecommendations(event));
  const pending = result.current.onPress('18 de novembre');
  await unmount();
  await act(async () => {
    resolve(ready);
    await pending;
  });
  expect(router.push).not.toHaveBeenCalled();
});

it('un esdeveniment acabat desactiva l’acció i no demana la ubicació', async () => {
  const past = { ...event, fi: '2020-11-30T23:59:59Z' };
  const { result } = await renderHook(() => useEventRecommendations(past));
  expect(result.current.disabled).toBe(true);
  expect(result.current.message).toBe(i18n.t('recommendations.pastWindow'));
  await act(() => result.current.onPress('30 de novembre'));
  expect(refetch).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});

it('no navega si l’esdeveniment acaba mentre espera la ubicació', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(event.fi) - 1);
  let finish!: (value: typeof ready) => void;
  refetch.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  try {
    const { result } = await renderHook(() => useEventRecommendations(event));
    const pending = result.current.onPress('30 de novembre');
    now.mockReturnValue(Date.parse(event.fi) + 1);
    await act(async () => {
      finish(ready);
      await pending;
    });
    expect(router.push).not.toHaveBeenCalled();
  } finally {
    now.mockRestore();
  }
});
