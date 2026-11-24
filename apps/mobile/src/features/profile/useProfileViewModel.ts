import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isSupportedLanguage, saveLanguage, SUPPORTED_LANGUAGES, type Language } from '@/core/i18n';
import { useAuthViewModel } from '@/features/auth/useAuthViewModel';

import { deleteAccount, useProfileQuery, useUpdateProfileName } from './profileRepository';

/** Avatar de reserva quan Supabase no en té cap: inicials del nom o del correu. */
export function profileInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.split('@')[0] || '';
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : source.slice(0, 2))
    .toLocaleUpperCase()
    .trim();
}

/** Perfil de l'API, edició del nom i accessos de la pestanya. */
export function useProfileViewModel() {
  const auth = useAuthViewModel();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const current: Language = isSupportedLanguage(i18n.language) ? i18n.language : 'ca';
  const profile = useProfileQuery(auth.user?.id);
  const updateName = useUpdateProfileName(auth.user?.id);
  const [draftOverride, setDraftOverride] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletionPending = useRef(false);
  const name = profile.data?.nom?.trim() || null;
  const email = profile.data?.email ?? auth.user?.email ?? null;
  const draftName = draftOverride ?? name ?? '';

  const cancelNameEdit = () => {
    if (updateName.isPending) return;
    setNameEditOpen(false);
    setDraftOverride(null);
    setNameError(null);
  };
  const saveName = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      setNameError(t('profile.nameInvalid'));
      return;
    }
    if (trimmed === (name ?? '')) {
      cancelNameEdit();
      return;
    }
    setNameError(null);
    try {
      await updateName.mutateAsync(trimmed);
      setNameEditOpen(false);
      setDraftOverride(null);
    } catch {
      setNameError(t('profile.nameSaveError'));
    }
  };
  const confirmDeleteAccount = async () => {
    if (deletionPending.current) return;
    deletionPending.current = true;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      setDeleteConfirmationOpen(false);
      await auth.signOut();
      router.replace('/benvinguda');
    } catch {
      setDeleteError(t('profile.deleteError'));
    } finally {
      deletionPending.current = false;
      setDeletingAccount(false);
    }
  };

  return {
    auth,
    title: t('profile.title'),
    myProfileLabel: t('profile.myProfile'),
    back: { label: t('profile.back'), onPress: () => router.back() },
    myProfileHint: t('profile.myProfileHint'),
    openMyProfile: () => router.push('/el-meu-perfil'),
    name: profile.isError ? '' : (name ?? t('profile.addName')),
    email,
    avatarUrl: profile.data?.avatarUrl ?? null,
    initials: profileInitials(name, email),
    profileLoading: profile.isPending && auth.isAuthenticated,
    profileError: profile.isError ? t('profile.loadError') : null,
    retryProfile: () => void profile.refetch(),
    nameEditOpen,
    openNameEdit: () => setNameEditOpen(true),
    draftName,
    setDraftName: (value: string) => {
      setDraftOverride(value);
      setNameError(null);
    },
    nameChanged: draftName.trim() !== (name ?? ''),
    nameError,
    savingName: updateName.isPending,
    cancelNameEdit,
    saveName: () => void saveName(),
    editNameLabel: t('profile.editName'),
    nameLabel: t('profile.name'),
    saveLabel: t('profile.save'),
    cancelLabel: t('profile.cancel'),
    unsavedTitle: t('profile.unsavedTitle'),
    unsavedMessage: t('profile.unsavedMessage'),
    keepEditingLabel: t('profile.keepEditing'),
    discardChangesLabel: t('profile.discardChanges'),
    languageLabel: t('profile.language'),
    languageCloseLabel: t('profile.closeLanguage'),
    languageValue: t(`profile.languages.${current}`),
    languageOpen,
    toggleLanguage: () => setLanguageOpen((open) => !open),
    closeLanguage: () => setLanguageOpen(false),
    currentLanguage: current,
    languages: SUPPORTED_LANGUAGES.map((code) => ({
      code,
      label: t(`profile.languages.${code}`),
      selected: code === current,
    })),
    selectLanguage: (code: Language) => {
      setLanguageOpen(false);
      return saveLanguage(code);
    },
    logoutConfirmationOpen,
    logoutConfirmationTitle: t('profile.logoutConfirmationTitle'),
    logoutConfirmationMessage: t('profile.logoutConfirmationMessage'),
    requestLogout: () => setLogoutConfirmationOpen(true),
    cancelLogout: () => setLogoutConfirmationOpen(false),
    confirmLogout: () => {
      setLogoutConfirmationOpen(false);
      void auth.signOut();
    },
    deleteAccountLabel: t('profile.deleteAccount'),
    deletingAccountLabel: t('profile.deletingAccount'),
    deleteConfirmationTitle: t('profile.deleteConfirmationTitle'),
    deleteConfirmationMessage: t('profile.deleteConfirmationMessage'),
    deleteConfirmationOpen,
    deletingAccount,
    deleteError,
    requestDeleteAccount: () => {
      setDeleteError(null);
      setDeleteConfirmationOpen(true);
    },
    cancelDeleteAccount: () => {
      if (!deletionPending.current) setDeleteConfirmationOpen(false);
    },
    confirmDeleteAccount: () => void confirmDeleteAccount(),
    plans: auth.isAuthenticated
      ? {
          label: t('profile.plans'),
          hint: t('profile.plansHint'),
          onPress: () => router.push('/plans'),
        }
      : null,
    savedPointsLabel: t('profile.savedPoints'),
    savedPointsHint: t('profile.savedPointsHint'),
    openSavedPoints: () => router.push('/favorits'),
    showApiStatus: __DEV__,
  };
}
