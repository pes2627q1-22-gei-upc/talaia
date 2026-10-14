import * as Location from 'expo-location';

import { getCurrentPlace } from '../locationRepository';

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const location = jest.mocked(Location);
const position = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude } }) as Location.LocationObject;

describe('getCurrentPlace', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as Location.LocationPermissionResponse);
  });

  it('sense permís, ho diu i no busca la posició', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
    } as Location.LocationPermissionResponse);
    await expect(getCurrentPlace()).resolves.toEqual({ status: 'denied' });
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('fa servir la darrera posició coneguda i hi posa el municipi', async () => {
    location.getLastKnownPositionAsync.mockResolvedValue(position(41.39, 2.17));
    location.reverseGeocodeAsync.mockResolvedValue([
      { city: 'Barcelona' } as Location.LocationGeocodedAddress,
    ]);
    await expect(getCurrentPlace()).resolves.toEqual({
      status: 'ready',
      place: { name: 'Barcelona', lat: 41.39, lon: 2.17 },
    });
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('si no n’hi ha cap de recent, la demana; sense municipi, diu la comarca', async () => {
    location.getLastKnownPositionAsync.mockResolvedValue(null);
    location.getCurrentPositionAsync.mockResolvedValue(position(42.05, 0.73));
    location.reverseGeocodeAsync.mockResolvedValue([
      { city: null, subregion: 'Noguera' } as Location.LocationGeocodedAddress,
    ]);
    await expect(getCurrentPlace()).resolves.toMatchObject({ place: { name: 'Noguera' } });
  });

  it('si el geocodificador falla, la posició continua servint', async () => {
    location.getLastKnownPositionAsync.mockResolvedValue(position(41.98, 2.82));
    location.reverseGeocodeAsync.mockRejectedValue(new Error('sense xarxa'));
    await expect(getCurrentPlace()).resolves.toEqual({
      status: 'ready',
      place: { name: '', lat: 41.98, lon: 2.82 },
    });
  });
});
