import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { colors } from '@/core/theme/tokens';

// Icones provisionals: SF Symbols a iOS i les del template a Android/web.
// La barra pròpia del mockup (icones de Talaia) queda per a una tasca a part.
const mapIcon = require('@/assets/images/tabIcons/home.png');
const calendarIcon = require('@/assets/images/tabIcons/explore.png');

export default function TabsLayout() {
  const { t } = useTranslation();
  const ios = Platform.OS === 'ios';

  return (
    <NativeTabs
      backgroundColor={colors.card}
      indicatorColor={colors.crep}
      tintColor={colors.far}
      labelStyle={{ default: { color: colors.boira }, selected: { color: colors.far } }}
    >
      <NativeTabs.Trigger name="(explora)">
        <NativeTabs.Trigger.Label>{t('tabs.explore')}</NativeTabs.Trigger.Label>
        {ios ? (
          <NativeTabs.Trigger.Icon sf="safari" />
        ) : (
          <NativeTabs.Trigger.Icon src={mapIcon} renderingMode="template" />
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendari">
        <NativeTabs.Trigger.Label>{t('tabs.calendar')}</NativeTabs.Trigger.Label>
        {ios ? (
          <NativeTabs.Trigger.Icon sf="calendar" />
        ) : (
          <NativeTabs.Trigger.Icon src={calendarIcon} renderingMode="template" />
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="alertes">
        <NativeTabs.Trigger.Label>{t('tabs.alerts')}</NativeTabs.Trigger.Label>
        {ios ? (
          <NativeTabs.Trigger.Icon sf="bell" />
        ) : (
          <NativeTabs.Trigger.Icon src={calendarIcon} renderingMode="template" />
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
        {ios ? (
          <NativeTabs.Trigger.Icon sf="person.crop.circle" />
        ) : (
          <NativeTabs.Trigger.Icon src={mapIcon} renderingMode="template" />
        )}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
