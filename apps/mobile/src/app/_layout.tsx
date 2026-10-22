import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
  AtkinsonHyperlegibleNext_800ExtraBold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AppProviders } from '@/core/providers/AppProviders';
import { stackOptions } from '@/core/navigation/transitions';
import { colors, sizes, spacing } from '@/core/theme/tokens';
import { PressableScale } from '@/shared/ui/PressableScale';

void SplashScreen.preventAutoHideAsync();

const closeIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.lluna}" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  )}`,
};
const closeStyle = {
  width: sizes.touch,
  height: sizes.touch,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
const closeIconStyle = { width: sizes.icon, height: sizes.icon };

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.nit,
    card: colors.card,
    text: colors.lluna,
    border: colors.linia,
    primary: colors.far,
  },
};

function RootStack() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={stackOptions}>
      {/* Des de la benvinguda, l'app entra amb una fosa (la benvinguda ja ha fet la seva sortida). */}
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="punt/[id]"
        options={{
          headerShown: true,
          title: t('point.title'),
          headerTintColor: colors.lluna,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Stack.Screen
        name="benvinguda"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="benvinguda-correu"
        options={{
          headerShown: true,
          title: '',
          headerBackTitle: t('emailLogin.back'),
          headerTransparent: true,
          headerTintColor: colors.lluna,
          // Sobre la benvinguda (un modal) es presenta com a full i no té botó enrere.
          headerLeft: () => (
            <PressableScale
              onPress={() => router.back()}
              accessibilityLabel={t('emailLogin.close')}
              hitSlop={spacing.sm}
              style={closeStyle}
            >
              <Image source={closeIcon} style={closeIconStyle} accessible={false} />
            </PressableScale>
          ),
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  // Les claus són els noms de família que fa servir `fonts` a tokens.ts.
  const [fontsLoaded, fontError] = useFonts({
    BigShouldersDisplay_800ExtraBold,
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_600SemiBold,
    AtkinsonHyperlegibleNext_700Bold,
    AtkinsonHyperlegibleNext_800ExtraBold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Si una font falla, l'app arrenca igualment amb la del sistema.
  if (!ready) return null;

  return (
    <AppProviders>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        <RootStack />
      </ThemeProvider>
    </AppProviders>
  );
}
