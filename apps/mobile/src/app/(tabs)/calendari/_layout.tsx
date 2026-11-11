import { Stack } from 'expo-router';

import { stackOptions } from '@/core/navigation/transitions';

/** Pila de la pestanya Calendari: el calendari i, a sobre, la fitxa d'un esdeveniment (mockup 09). */
export default function CalendarLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" />
      {/* La capçalera de la fitxa (botó enrere i títol) és d'`EventDetailScreen`. */}
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
