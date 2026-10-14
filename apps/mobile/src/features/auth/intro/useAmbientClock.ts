import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

/** Rellotge del que continua viu després de la intro: ms des que s'ha muntat la pantalla. */
export function useAmbientClock() {
  const clock = useSharedValue(0);
  useFrameCallback((frame) => {
    clock.set(frame.timeSinceFirstFrame);
  });
  return clock;
}
