import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';

import { makeStyles, useNightTint, useTheme } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { ApiStatusCard } from '@/features/apiStatus/ApiStatusCard';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';

import { LanguageSheet } from './LanguageSheet';
import { LogoutConfirmationSheet } from './LogoutConfirmationSheet';
import { useProfileViewModel } from './useProfileViewModel';

const plansIcon = require('@/assets/images/profile/plans.svg');
const profileIcon = require('@/assets/images/profile/edit.svg');
const savedIcon = require('@/assets/images/profile/saved.svg');
const languageIcon = require('@/assets/images/profile/language.svg');
const chevronIcon = require('@/assets/images/calendar/chevron-down.svg');
const logoutIcon = require('@/assets/images/profile/logout.svg');

type MenuRowProps = {
  icon: number;
  label: string;
  hint: string;
  onPress?: () => void;
  badge?: string;
  value?: string;
};

function MenuRow({ icon, label, hint, onPress, badge, value }: MenuRowProps) {
  const styles = useStyles();
  const tint = useNightTint();
  const content = (
    <>
      <View style={styles.iconTile}>
        <Image source={icon} tintColor={tint} style={styles.menuIcon} accessible={false} />
      </View>
      <View style={styles.menuCopy}>
        <AppText variant="label" numberOfLines={2}>
          {label}
        </AppText>
        {!badge ? (
          <AppText variant="caption" color="boira" numberOfLines={2}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="caption" color="boira">
            {badge}
          </AppText>
        </View>
      ) : onPress ? (
        <Image source={chevronIcon} tintColor={tint} style={styles.chevron} accessible={false} />
      ) : null}
    </>
  );
  return onPress ? (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={value ? undefined : hint}
      style={styles.menuRow}
    >
      {content}
    </PressableScale>
  ) : (
    <View accessible accessibilityLabel={`${label}, ${badge ?? hint}`} style={styles.menuRow}>
      {content}
    </View>
  );
}

export function ProfileScreen() {
  const vm = useProfileViewModel();
  const styles = useStyles();
  const { name: themeName } = useTheme();
  const logoutTint = useNightTint('perill');
  return (
    <Screen title={vm.title}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {vm.auth.isAuthenticated ? (
          <>
            <View style={styles.identity}>
              <View
                style={styles.avatar}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                testID="profile-avatar"
              >
                {vm.avatarUrl && themeName !== 'vermell' ? (
                  <Image
                    source={{ uri: vm.avatarUrl }}
                    style={styles.avatarImage}
                    accessible={false}
                    testID="profile-avatar-image"
                  />
                ) : (
                  <AppText variant="title" color="nit" accessible={false}>
                    {vm.initials}
                  </AppText>
                )}
              </View>
              <View style={styles.identityCopy}>
                {vm.profileError ? null : vm.profileLoading ? (
                  <Skeleton width="65%" height={sizes.icon} />
                ) : (
                  <AppText variant="heading" numberOfLines={2}>
                    {vm.name}
                  </AppText>
                )}
                {vm.email ? (
                  <AppText variant="caption" color="boira" numberOfLines={1}>
                    {vm.email}
                  </AppText>
                ) : null}
              </View>
            </View>
            {vm.profileError ? (
              <View style={styles.feedback}>
                <AppText accessibilityRole="alert" color="tap">
                  {vm.profileError}
                </AppText>
                <Button label={vm.auth.retryLabel} variant="text" onPress={vm.retryProfile} />
              </View>
            ) : null}
            <View style={styles.menu}>
              <MenuRow
                icon={profileIcon}
                label={vm.myProfileLabel}
                hint={vm.myProfileHint}
                onPress={vm.openMyProfile}
              />
              {vm.plans ? <MenuRow icon={plansIcon} {...vm.plans} /> : null}
              <MenuRow
                icon={savedIcon}
                label={vm.savedPointsLabel}
                badge={vm.comingSoonLabel}
                hint={vm.comingSoonLabel}
              />
              <MenuRow
                icon={languageIcon}
                label={vm.languageLabel}
                hint={vm.languageValue}
                value={vm.languageValue}
                onPress={vm.toggleLanguage}
              />
            </View>
            <PressableScale
              accessibilityLabel={vm.auth.logoutLabel}
              accessibilityState={{ disabled: vm.auth.signingOut || vm.auth.loading }}
              disabled={vm.auth.signingOut || vm.auth.loading}
              onPress={vm.requestLogout}
              style={[
                styles.logoutButton,
                (vm.auth.signingOut || vm.auth.loading) && styles.disabled,
              ]}
            >
              <Image
                source={logoutIcon}
                tintColor={logoutTint}
                style={styles.logoutIcon}
                accessible={false}
              />
              <AppText variant="label" color="perill">
                {vm.auth.logoutLabel}
              </AppText>
            </PressableScale>
          </>
        ) : (
          <View style={styles.menu}>
            <MenuRow
              icon={languageIcon}
              label={vm.languageLabel}
              hint={vm.languageValue}
              value={vm.languageValue}
              onPress={vm.toggleLanguage}
            />
          </View>
        )}
        {vm.showApiStatus ? <ApiStatusCard /> : null}
        {vm.auth.errorMessage ? (
          <View style={styles.feedback}>
            <AppText accessibilityRole="alert">{vm.auth.errorMessage}</AppText>
            {vm.auth.error === 'restore' ? (
              <Button label={vm.auth.retryLabel} onPress={() => void vm.auth.restore()} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <LanguageSheet
        languageOpen={vm.languageOpen}
        languageLabel={vm.languageLabel}
        languageCloseLabel={vm.languageCloseLabel}
        closeLanguage={vm.closeLanguage}
        languages={vm.languages}
        selectLanguage={vm.selectLanguage}
      />
      <LogoutConfirmationSheet
        visible={vm.logoutConfirmationOpen}
        title={vm.logoutConfirmationTitle}
        message={vm.logoutConfirmationMessage}
        cancelLabel={vm.cancelLabel}
        confirmLabel={vm.auth.logoutLabel}
        disabled={vm.auth.signingOut || vm.auth.loading}
        onCancel={vm.cancelLogout}
        onConfirm={vm.confirmLogout}
      />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  content: { gap: spacing.ms, paddingBottom: spacing.xl },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    minHeight: sizes.button + spacing.md,
  },
  avatar: {
    width: sizes.button,
    height: sizes.button,
    borderRadius: radii.pill,
    backgroundColor: colors.pedra,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: sizes.button, height: sizes.button },
  identityCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  feedback: { gap: spacing.sm },
  menu: { gap: 0 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    minHeight: sizes.button + spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.linia,
  },
  iconTile: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radii.sm,
    backgroundColor: colors.vel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { width: sizes.icon, height: sizes.icon },
  menuCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.vel,
  },
  chevron: { width: sizes.iconSmall, height: sizes.iconSmall, transform: [{ rotate: '-90deg' }] },
  logoutButton: {
    minHeight: sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  logoutIcon: { width: sizes.icon, height: sizes.icon },
  disabled: { opacity: 0.4 },
}));
