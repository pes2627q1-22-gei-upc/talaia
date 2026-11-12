import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { CURRENT_PLACE_KEY } from './locationKeys';

export type Place = {
  /** Municipi (o comarca) on és l'usuari; buit si el geocodificador del mòbil no en sap el nom. */
  name: string;
  lat: number;
  lon: number;
};

export type CurrentPlace =
  | { status: 'ready'; place: Place }
  /** `canAskAgain`: el sistema encara deixa tornar a demanar el permís (si no, cal la configuració). */
  | { status: 'denied'; canAskAgain: boolean };

/** Una posició de fa menys de 10 min serveix: per triar punts a hores de cotxe, sobra. */
const MAX_AGE_MS = 10 * 60 * 1000;

/** On és l'usuari ara, amb el municipi. Demana permís el primer cop. */
export async function getCurrentPlace(): Promise<CurrentPlace> {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) return { status: 'denied', canAskAgain };

  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude: lat, longitude: lon } = position.coords;

  return { status: 'ready', place: { name: await placeName(lat, lon), lat, lon } };
}

/**
 * El municipi (o la comarca) d'un punt, amb el geocodificador del mòbil. El nom és un extra: si
 * falla, és buit i la posició continua servint.
 */
export async function placeName(lat: number, lon: number): Promise<string> {
  const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }).catch(
    () => [],
  );
  return address?.city ?? address?.subregion ?? address?.region ?? '';
}

/** Comparteix la ubicació entre Explora i el mapa, sense duplicar peticions. */
export function useCurrentPlaceQuery() {
  return useQuery({
    queryKey: CURRENT_PLACE_KEY,
    queryFn: getCurrentPlace,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
