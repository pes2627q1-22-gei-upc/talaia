import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { headingDelta, smoothHeading } from './headingFilter';
import { watchDeviceHeading } from './headingRepository';

const MIN_STEP_DEG = 1;
const MIN_INTERVAL_MS = 50;
/** Temps sense cap lectura vàlida abans d'amagar la fletxa. */
const LOST_AFTER_MS = 1500;
const SETTLE_AFTER_MS = 250;

/** Brúixola suavitzada. Atura el sensor en sortir del mapa o posar l'app en segon pla. */
export function useDeviceHeading(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let generation = 0;
      let subscription: { remove(): void } | undefined;
      let lostTimer: ReturnType<typeof setTimeout> | undefined;
      let settleTimer: ReturnType<typeof setTimeout> | undefined;
      const stop = () => {
        generation++;
        clearTimeout(lostTimer);
        clearTimeout(settleTimer);
        lostTimer = undefined;
        subscription?.remove();
        subscription = undefined;
        setHeading(null);
        setActive(false);
      };
      const start = () => {
        stop();
        if (!enabled) return;
        setActive(true);
        const current = generation;
        let smoothed: number | null = null;
        let sampleTime = 0;
        let shown: number | null = null;
        let shownTime = 0;
        const show = (value: number, now: number) => {
          shown = value;
          shownTime = now;
          setHeading(value);
        };
        void watchDeviceHeading((value) => {
          if (current !== generation) return;
          const now = Date.now();
          if (value === null) {
            // Una lectura sense calibrar de tant en tant no amaga la fletxa; si duren, sí.
            if (smoothed !== null && lostTimer === undefined) {
              clearTimeout(settleTimer);
              lostTimer = setTimeout(() => {
                lostTimer = undefined;
                smoothed = null;
                shown = null;
                setHeading(null);
              }, LOST_AFTER_MS);
            }
            return;
          }
          clearTimeout(lostTimer);
          lostTimer = undefined;
          smoothed = smoothHeading(smoothed, value, now - sampleTime);
          sampleTime = now;
          // Si el sensor calla (l'iOS només avisa quan canvia), la fletxa acaba a l'última lectura.
          clearTimeout(settleTimer);
          settleTimer = setTimeout(() => {
            smoothed = value;
            if (shown === null || headingDelta(shown, value) !== 0) show(value, Date.now());
          }, SETTLE_AFTER_MS);
          // Cada canvi travessa el pont fins a la DOM component: només els que es noten.
          if (
            shown !== null &&
            (Math.abs(headingDelta(shown, smoothed)) < MIN_STEP_DEG ||
              now - shownTime < MIN_INTERVAL_MS)
          ) {
            return;
          }
          show(smoothed, now);
        })
          .then((watcher) => {
            if (current !== generation) watcher.remove();
            else subscription = watcher;
          })
          .catch(() => {
            if (current === generation) setHeading(null);
          });
      };
      if (AppState.currentState === 'active') start();
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') start();
        else stop();
      });
      return () => {
        stop();
        listener.remove();
      };
    }, [enabled]),
  );
  return { heading: enabled ? heading : null, active };
}
