import { Stack } from 'expo-router';

import { stackOptions } from '@/core/navigation/transitions';

/** Pila de la pestanya Explora: «Què vols veure?» i, a sobre, les recomanacions al mapa. */
export default function ExploreLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" />
      {/* La capçalera del mapa (botó enrere i, amb una cerca, el mockup 03) és de `MapScreen`. */}
      <Stack.Screen name="recomanacions" />
    </Stack>
  );
}
