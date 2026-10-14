import { Stack } from 'expo-router';

import { stackOptions } from '@/core/navigation/transitions';
import { colors } from '@/core/theme/tokens';

/** Pila de la pestanya Explora: «Què vols veure?» i, a sobre, les recomanacions al mapa. */
export default function ExploreLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" />
      {/* TG-102 hi posarà la capçalera del mockup 03; de moment, només el botó enrere sobre el mapa. */}
      <Stack.Screen
        name="recomanacions"
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerTintColor: colors.lluna,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
    </Stack>
  );
}
