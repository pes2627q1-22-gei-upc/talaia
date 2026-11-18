import { Stack } from 'expo-router';

import { stackOptions } from '@/core/navigation/transitions';

/**
 * Pila de la pestanya Alertes: la llista (mockup 10) i, a sobre, «Nova alerta» (mockup 11) o la
 * mateixa pantalla per editar-ne una (`alerta/[id]`).
 */
export default function AlertsLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nova-alerta" />
      <Stack.Screen name="alerta/[id]" />
    </Stack>
  );
}
