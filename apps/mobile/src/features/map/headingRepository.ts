import * as Location from 'expo-location';

/** Brúixola del dispositiu, no la direcció de desplaçament del GPS. */
export async function watchDeviceHeading(onHeading: (heading: number | null) => void) {
  return Location.watchHeadingAsync(
    ({ trueHeading, magHeading, accuracy }) => {
      const value = trueHeading >= 0 ? trueHeading : magHeading;
      onHeading(accuracy > 0 && Number.isFinite(value) && value >= 0 ? value % 360 : null);
    },
    () => onHeading(null),
  );
}
