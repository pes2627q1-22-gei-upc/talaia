import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { constellationJoins } from './sky';
import { introStart, type IntroMode, TL } from './timeline';

/** Clau d'AsyncStorage: si ja s'ha vist la intro sencera en aquest dispositiu. */
export const INTRO_SEEN_KEY = 'talaia:intro-vista';

/**
 * Espera abans de començar: el primer fotograma del cel compila els shaders de la GPU i, si la
 * línia de temps ja corregués, l'aturada es menjaria el batec.
 */
export const INTRO_LEAD = 300;

/** Quant triga a acabar la intro si l'usuari toca per saltar-la. */
export const SKIP_DURATION = 350;

/** Les vibracions de la intro sencera, sincronitzades amb la línia de temps (ms). */
export const INTRO_HAPTICS: { at: number; play: () => Promise<void> }[] = [
  { at: TL.heartbeat, play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft) },
  { at: TL.heartbeat + 220, play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft) },
  { at: TL.ignite, play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) },
  ...constellationJoins().map((join) => ({
    at: TL.constellation + join * TL.constellationFor,
    play: () => Haptics.selectionAsync(),
  })),
  { at: TL.logo, play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) },
];

/**
 * La intro de la benvinguda: sencera el primer cop, curta les altres, quieta amb «reduir
 * moviment». `forceFull` la mostra sencera igualment (demos i proves: `/benvinguda?intro=sencera`).
 * Retorna el rellotge de la línia de temps (`t`) i una acció per saltar-la.
 */
export function useIntro(forceFull = false) {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<IntroMode | null>(null);
  const t = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let alive = true;
    const choose = (seen: boolean) => {
      if (!alive) return;
      if (reduceMotion) setMode('still');
      else setMode(seen && !forceFull ? 'short' : 'full');
    };
    AsyncStorage.getItem(INTRO_SEEN_KEY)
      .then((value) => choose(value !== null))
      .catch(() => choose(true));
    return () => {
      alive = false;
    };
  }, [reduceMotion, forceFull]);

  useEffect(() => {
    if (!mode) return;
    const start = introStart(mode);
    t.set(start);
    t.set(
      withDelay(
        INTRO_LEAD,
        withTiming(TL.end, { duration: TL.end - start, easing: Easing.linear }),
      ),
    );

    const pending: ReturnType<typeof setTimeout>[] = [];
    if (mode === 'full') {
      for (const haptic of INTRO_HAPTICS) {
        pending.push(setTimeout(() => void haptic.play(), INTRO_LEAD + haptic.at));
      }
      pending.push(
        setTimeout(() => void AsyncStorage.setItem(INTRO_SEEN_KEY, '1'), INTRO_LEAD + TL.end),
      );
    }
    timers.current = pending;
    return () => pending.forEach(clearTimeout);
  }, [mode, t]);

  /** Porta la intro al final de seguida (un toc durant la intro). */
  const skip = () => {
    if (t.get() >= TL.end) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    t.set(withTiming(TL.end, { duration: SKIP_DURATION, easing: Easing.out(Easing.cubic) }));
    void AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
  };

  return { mode, t, skip };
}
