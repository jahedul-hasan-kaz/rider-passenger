import { isAuthApiError, type AuthError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { api } from '@/api';
import { unregisterDevice } from '@/api/endpoints/care';
import { forgetPushToken, storedPushToken } from '@/features/push/push';
import { prefs } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

// Sign-in (docs/spec/03-screens.md §7.2–7.3): a 6-digit one-time code sent by email (always available) or by SMS
// (when phone sign-in is switched on — it needs an SMS gateway), Google as an option, and an email/password form in
// development builds only.

/** What went wrong, as one of a few things the passenger can act on. */
export type AuthProblem =
  | 'rateLimited'
  | 'smsDown'
  | 'signupClosed'
  | 'wrongCode'
  | 'codeExpired'
  | 'wrongPassword'
  | 'invalidEmail'
  | 'cancelled'
  | 'network'
  | 'unknown';

export class AuthFailure extends Error {
  constructor(
    readonly problem: AuthProblem,
    readonly retryAfterS?: number,
  ) {
    super(problem);
    this.name = 'AuthFailure';
  }
}

function toFailure(error: AuthError): AuthFailure {
  const code = (isAuthApiError(error) ? error.code : undefined) ?? '';
  const message = error.message.toLowerCase();
  if (error.status === 429 || code.startsWith('over_')) {
    const seconds = /(\d+)\s*seconds?/.exec(message)?.[1];
    return new AuthFailure('rateLimited', seconds ? Number(seconds) : 60);
  }
  if (code === 'otp_expired' || message.includes('expired')) return new AuthFailure('codeExpired');
  if (code === 'invalid_credentials') return new AuthFailure('wrongPassword');
  if (code === 'email_address_invalid' || code === 'validation_failed') return new AuthFailure('invalidEmail');
  if (code.includes('otp') || message.includes('token') || message.includes('invalid')) return new AuthFailure('wrongCode');
  if (code === 'signup_disabled' || code === 'phone_provider_disabled' || message.includes('signups not allowed')) {
    return new AuthFailure('signupClosed');
  }
  if (code === 'sms_send_failed' || message.includes('sms')) return new AuthFailure('smsDown');
  if (error.status === 0 || message.includes('network') || message.includes('fetch')) return new AuthFailure('network');
  return new AuthFailure('unknown');
}

/** Sends a 6-digit code by SMS. `e164` is `+8801…`. */
export async function sendCode(e164: string): Promise<void> {
  const { error } = await supabase().auth.signInWithOtp({ phone: e164, options: { channel: 'sms', shouldCreateUser: true } });
  if (error) throw toFailure(error);
}

export async function verifyCode(e164: string, code: string): Promise<void> {
  const { error } = await supabase().auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
  if (error) throw toFailure(error);
}

/** Sends a 6-digit code by email. New addresses get an account (role `user`) when the code is verified. */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw toFailure(error);
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
  if (error) throw toFailure(error);
}

/** Where a sign-in code goes: a phone number (E.164) or an email address. */
export type CodeTarget = { channel: 'sms'; phone: string } | { channel: 'email'; email: string };

export const sendCodeTo = (target: CodeTarget) => (target.channel === 'sms' ? sendCode(target.phone) : sendEmailCode(target.email));
export const verifyCodeFor = (target: CodeTarget, code: string) =>
  target.channel === 'sms' ? verifyCode(target.phone, code) : verifyEmailCode(target.email, code);

/** Google through the system browser (PKCE). Needs the Google provider and this app's redirect URL in Supabase. */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw toFailure(error);
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new AuthFailure('cancelled');
  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new AuthFailure('unknown');
  const exchanged = await supabase().auth.exchangeCodeForSession(code);
  if (exchanged.error) throw toFailure(exchanged.error);
}

/** Development builds only: sign in to a staging demo account. The password is typed by the developer, never stored. */
export async function devSignInWithPassword(email: string, password: string): Promise<void> {
  if (!__DEV__) throw new AuthFailure('unknown');
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toFailure(error);
}

/** Stop pushes to this phone first (so the next person on it gets nothing), then end the session. */
export async function signOut(): Promise<void> {
  const pushToken = storedPushToken();
  if (pushToken) await unregisterDevice(api(), pushToken).catch(() => undefined);
  forgetPushToken();
  await supabase().auth.signOut();
}

// ---- Consent (recorded locally until the backend stores it — gap B13) -------------------------------------------

export const TERMS_VERSION = '2026-11';
const CONSENT_KEY = 'consent.terms';

export function recordConsent(): void {
  prefs.set(CONSENT_KEY, JSON.stringify({ version: TERMS_VERSION, at: new Date().toISOString() }));
}

export function hasConsent(): boolean {
  try {
    return JSON.parse(prefs.getString(CONSENT_KEY) ?? 'null')?.version === TERMS_VERSION;
  } catch {
    return false;
  }
}
