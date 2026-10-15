import * as Location from 'expo-location';

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

  // El nom és un extra: si el geocodificador falla, la posició continua servint.
  const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }).catch(
    () => [],
  );
  const name = address?.city ?? address?.subregion ?? address?.region ?? '';
  return { status: 'ready', place: { name, lat, lon } };
}
