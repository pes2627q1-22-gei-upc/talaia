import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import type { ManualChoice } from './nightModeModel';

/** Clau d'AsyncStorage de la tria a mà del mode nit (ADR-0032). */
export const NIGHT_MODE_KEY = 'talaia:mode-nit';

/** Una posició de fa menys de 2 min serveix: el radi és de 500 m. */
const MAX_AGE_MS = 2 * 60 * 1000;

const isChoice = (value: unknown): value is ManualChoice =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ManualChoice).on === 'boolean' &&
  Number.isFinite((value as ManualChoice).until);

export const nightModeRepository = {
  /** Si no es pot llegir (o el valor no és vàlid), no hi ha cap tria: mana l'automàtic. */
  async load(): Promise<ManualChoice | null> {
    try {
      const parsed: unknown = JSON.parse((await AsyncStorage.getItem(NIGHT_MODE_KEY)) ?? 'null');
      return isChoice(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async save(choice: ManualChoice): Promise<void> {
    await AsyncStorage.setItem(NIGHT_MODE_KEY, JSON.stringify(choice)).catch(() => undefined);
  },

  /**
   * On és l'usuari, només si ja ha donat el permís (a «A prop meu», per exemple): el mode nit no el
   * demana mai, i sense permís només hi ha l'interruptor (HU45). La posició no surt del mòbil.
   */
  async position(): Promise<{ lat: number; lon: number } | null> {
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) return null;
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: position.coords.latitude, lon: position.coords.longitude };
  },
};
