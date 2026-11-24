import { Image } from 'expo-image';
import { usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { makeStyles, useNightTint } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Screen } from '@/shared/ui/Screen';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';
import { TextField } from '@/shared/ui/TextField';

import { ProfileAvatar } from './ProfileAvatar';
import { LogoutConfirmationSheet } from './LogoutConfirmationSheet';
import { useProfileViewModel } from './useProfileViewModel';

const editIcon = require('@/assets/images/profile/edit.svg');
const closeIcon = require('@/assets/images/profile/close.svg');
const checkIcon = require('@/assets/images/profile/check.svg');

/** Dades del compte amb edició del nom a la mateixa fila. */
export function MyProfileScreen() {
  const vm = useProfileViewModel();
  const styles = useStyles();
  const tint = useNightTint();
  const checkTint = useNightTint('nit');
  const [pendingRepeat, setPendingRepeat] = useState<(() => void) | null>(null);
  usePreventRemove(vm.nameEditOpen && (vm.nameChanged || vm.savingName), ({ repeat }) => {
    if (vm.savingName) return;
    setPendingRepeat(() => repeat);
  });
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen title={vm.myProfileLabel} back={vm.back}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {vm.profileError ? (
            <StateMessage
              title={vm.profileError}
              action={{ label: vm.auth.retryLabel, onPress: vm.retryProfile }}
            />
          ) : (
            <>
              <View style={styles.identity}>
                <ProfileAvatar avatarUrl={vm.avatarUrl} initials={vm.initials} large />
                {vm.email ? (
                  <AppText variant="body" color="boira">
                    {vm.email}
                  </AppText>
                ) : null}
              </View>
              {vm.profileLoading ? (
                <Skeleton height={sizes.button} />
              ) : vm.nameEditOpen ? (
                <View style={styles.editRow}>
                  <View style={styles.editField}>
                    <TextField
                      label={vm.nameLabel}
                      value={vm.draftName}
                      onChangeText={vm.setDraftName}
                      maxLength={100}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={vm.saveName}
                      error={vm.nameError}
                      autoFocus
                    />
                  </View>
                  <PressableScale
                    accessibilityLabel={vm.saveLabel}
                    accessibilityState={{ disabled: !vm.nameChanged || vm.savingName }}
                    disabled={!vm.nameChanged || vm.savingName}
                    onPress={vm.saveName}
                    style={[
                      styles.saveButton,
                      (!vm.nameChanged || vm.savingName) && styles.disabled,
                    ]}
                  >
                    <Image
                      source={checkIcon}
                      tintColor={checkTint}
                      style={styles.editIcon}
                      accessible={false}
                    />
                  </PressableScale>
                  <PressableScale
                    accessibilityLabel={vm.cancelLabel}
                    accessibilityState={{ disabled: vm.savingName }}
                    disabled={vm.savingName}
                    onPress={vm.cancelNameEdit}
                    style={[styles.cancelButton, vm.savingName && styles.disabled]}
                  >
                    <Image
                      source={closeIcon}
                      tintColor={tint}
                      style={styles.editIcon}
                      accessible={false}
                    />
                  </PressableScale>
                </View>
              ) : (
                <PressableScale
                  accessibilityLabel={`${vm.editNameLabel}, ${vm.name}`}
                  onPress={vm.openNameEdit}
                  style={styles.nameRow}
                >
                  <View style={styles.nameCopy}>
                    <AppText variant="caption" color="boira">
                      {vm.nameLabel}
                    </AppText>
                    <AppText variant="body">{vm.name}</AppText>
                  </View>
                  <Image
                    source={editIcon}
                    tintColor={tint}
                    style={styles.editIcon}
                    accessible={false}
                  />
                </PressableScale>
              )}
            </>
          )}
          {vm.auth.isAuthenticated ? (
            <View style={styles.deleteSection}>
              <PressableScale
                accessibilityLabel={vm.deleteAccountLabel}
                accessibilityState={{ disabled: vm.deletingAccount || vm.auth.signingOut }}
                disabled={vm.deletingAccount || vm.auth.signingOut}
                onPress={vm.requestDeleteAccount}
                style={[styles.deleteButton, vm.deletingAccount && styles.disabled]}
              >
                <AppText variant="label" color="perill">
                  {vm.deleteAccountLabel}
                </AppText>
              </PressableScale>
            </View>
          ) : null}
        </ScrollView>
      </Screen>
      <LogoutConfirmationSheet
        visible={vm.deleteConfirmationOpen}
        title={vm.deleteConfirmationTitle}
        message={vm.deleteConfirmationMessage}
        error={vm.deleteError}
        cancelLabel={vm.cancelLabel}
        confirmLabel={vm.deletingAccount ? vm.deletingAccountLabel : vm.deleteAccountLabel}
        disabled={vm.deletingAccount}
        cancelDisabled={vm.deletingAccount}
        onCancel={vm.cancelDeleteAccount}
        onConfirm={vm.confirmDeleteAccount}
      />
      <Sheet
        visible={pendingRepeat !== null}
        title={vm.unsavedTitle}
        closeLabel={vm.keepEditingLabel}
        onClose={() => setPendingRepeat(null)}
      >
        <AppText variant="body" color="boira">
          {vm.unsavedMessage}
        </AppText>
        <View style={styles.confirmActions}>
          <Button
            label={vm.keepEditingLabel}
            variant="secondary"
            onPress={() => setPendingRepeat(null)}
            style={styles.confirmAction}
          />
          <PressableScale
            accessibilityLabel={vm.discardChangesLabel}
            onPress={() => {
              const repeat = pendingRepeat;
              setPendingRepeat(null);
              vm.cancelNameEdit();
              repeat?.();
            }}
            style={styles.confirmAction}
          >
            <AppText variant="label" color="perill">
              {vm.discardChangesLabel}
            </AppText>
          </PressableScale>
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  identity: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.button + spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.linia,
  },
  nameCopy: { flex: 1, gap: spacing.xs },
  editIcon: { width: sizes.icon, height: sizes.icon },
  editRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.linia,
  },
  editField: { flex: 1, minWidth: 0 },
  saveButton: {
    minWidth: sizes.touch,
    minHeight: sizes.touch,
    marginBottom: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.far,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    minWidth: sizes.touch,
    minHeight: sizes.touch,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  deleteSection: { marginTop: spacing.xl },
  deleteButton: {
    minHeight: sizes.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.vora,
    borderRadius: radii.md,
    backgroundColor: colors.sheet,
  },
  confirmActions: { flexDirection: 'row', gap: spacing.sm },
  confirmAction: {
    flex: 1,
    minHeight: sizes.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
