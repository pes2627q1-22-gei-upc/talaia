import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authRepository, SignInFailure, type SignInFailureReason } from './authRepository';
import { signInAndEnsureProfile } from './signIn';
import { useSignInErrorMessage } from './useWelcomeViewModel';

export const CODE_LENGTH = 6;
/** Supabase no deixa demanar un altre codi abans d'un minut (`max_frequency`). */
export const RESEND_AFTER_S = 60;

/** `nom@domini.tld` sense espais. Sense regex: Supabase ja valida l'adreça de debò. */
function isEmail(value: string): boolean {
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@') || /\s/.test(value)) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

export type EmailLoginStep = 'email' | 'code';

/** Inici de sessió amb un codi de 6 xifres enviat per correu (HU35, TG-249). */
export function useEmailLoginViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const errorMessage = useSignInErrorMessage();
  const [step, setStep] = useState<EmailLoginStep>('email');
  const [email, setEmailValue] = useState('');
  const [code, setCodeValue] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<SignInFailureReason | null>(null);
  const [resent, setResent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const address = email.trim().toLowerCase();
  const emailValid = isEmail(address);
  const codeValid = code.length === CODE_LENGTH;

  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailure(null);
    setResent(false);
    try {
      await action();
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const send = (isResend = false) =>
    run(async () => {
      try {
        await authRepository.sendEmailCode(address);
        setStep('code');
        setResendIn(RESEND_AFTER_S);
        setResent(isResend);
      } catch (error) {
        setFailure(error instanceof SignInFailure ? error.reason : 'unknown');
      }
    });

  const verify = (token: string) =>
    run(async () => {
      const result = await signInAndEnsureProfile(() =>
        authRepository.verifyEmailCode(address, token),
      );
      if (result.ok) {
        // La benvinguda queda sota: es tanca tot i s'entra a l'app.
        router.dismissAll();
        router.replace('/');
      } else {
        setFailure(result.reason);
        if (result.reason === 'invalidCode') setCodeValue('');
      }
    });

  const isCode = step === 'code';
  return {
    step,
    title: t(isCode ? 'emailLogin.codeTitle' : 'emailLogin.title'),
    subtitle: isCode
      ? t('emailLogin.codeSubtitle', { email: address })
      : t('emailLogin.emailSubtitle'),
    emailLabel: t('emailLogin.emailLabel'),
    emailPlaceholder: t('emailLogin.emailPlaceholder'),
    codeLabel: t('emailLogin.codeLabel'),
    email,
    code,
    codeLength: CODE_LENGTH,
    pending,
    errorMessage: errorMessage(failure),
    notice: resent ? t('emailLogin.resent') : null,
    submitLabel: isCode
      ? t(pending ? 'emailLogin.verifying' : 'emailLogin.verify')
      : t(pending ? 'emailLogin.sending' : 'emailLogin.send'),
    canSubmit: !pending && (isCode ? codeValid : emailValid),
    resendLabel:
      resendIn > 0 ? t('emailLogin.resendIn', { seconds: resendIn }) : t('emailLogin.resend'),
    canResend: !pending && resendIn === 0,
    changeEmailLabel: t('emailLogin.changeEmail'),
    setEmail: (value: string) => {
      setEmailValue(value);
      setFailure(null);
    },
    /** Només xifres; en arribar a 6, es comprova sol (també si el teclat l'enganxa de l'SMS). */
    setCode: (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
      setCodeValue(digits);
      setFailure(null);
      if (digits.length === CODE_LENGTH) void verify(digits);
    },
    submit: () => (isCode ? verify(code) : send()),
    resend: () => send(true),
    changeEmail: () => {
      setStep('email');
      setCodeValue('');
      setFailure(null);
      setResent(false);
    },
  };
}
