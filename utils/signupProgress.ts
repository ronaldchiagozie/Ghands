import AsyncStorage from '@react-native-async-storage/async-storage';

import { authService } from '@/services/authService';
import { resolveClientProfileComplete } from '@/utils/profileCompletion';

/**
 * Where a half-finished signup should resume.
 *
 * Signing up is several screens long — account type, credentials, then the
 * profile (name, phone, gender). If the app is closed between them the account
 * already exists, so the next launch has a valid token and used to land on Home
 * with a profile that was never filled in. Nothing brought the user back.
 *
 * The resume point is *derived* from what is actually true (is there a token, is
 * the profile complete) rather than replayed from a breadcrumb, so a stale or
 * missing marker can never strand someone. The recorded step is kept alongside
 * it for support and analytics — it tells us where people drop off.
 */

const STEP_KEY = '@ghands:signup_step';
const STARTED_KEY = '@ghands:signup_started_at';

/** Ordered. Later steps imply every earlier one. */
export const SIGNUP_STEPS = [
  'account_type',
  'credentials',
  'account_created',
  'profile',
  'complete',
] as const;

export type SignupStep = (typeof SIGNUP_STEPS)[number];

function rank(step: SignupStep | null): number {
  return step ? SIGNUP_STEPS.indexOf(step) : -1;
}

/** Records the furthest point reached. Never moves backwards. */
export async function recordSignupStep(step: SignupStep): Promise<void> {
  try {
    const current = (await AsyncStorage.getItem(STEP_KEY)) as SignupStep | null;
    if (rank(step) <= rank(current)) return;
    await AsyncStorage.setItem(STEP_KEY, step);
    if (!(await AsyncStorage.getItem(STARTED_KEY))) {
      await AsyncStorage.setItem(STARTED_KEY, new Date().toISOString());
    }
  } catch {
    /* progress tracking must never block signup */
  }
}

export async function getSignupStep(): Promise<SignupStep | null> {
  try {
    return (await AsyncStorage.getItem(STEP_KEY)) as SignupStep | null;
  } catch {
    return null;
  }
}

/** How long the user has been mid-signup — useful when diagnosing drop-off. */
export async function getSignupStartedAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STARTED_KEY);
  } catch {
    return null;
  }
}

export async function clearSignupProgress(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([STEP_KEY, STARTED_KEY]);
  } catch {
    /* ignore */
  }
}

export type SignupResume =
  | { kind: 'unauthenticated' }
  | { kind: 'finish_profile' }
  | { kind: 'complete' };

/**
 * What the app should do on launch for a signup that may be half-finished.
 *
 * Fails open to `complete` — if the profile check cannot run (offline, API
 * down), sending someone to Home is recoverable; trapping them in an
 * onboarding screen they cannot get past is not.
 */
export async function resolveSignupResume(): Promise<SignupResume> {
  try {
    const token = await authService.getAuthToken();
    if (!token) return { kind: 'unauthenticated' };

    const profileComplete = await resolveClientProfileComplete();
    if (profileComplete) {
      await clearSignupProgress();
      return { kind: 'complete' };
    }

    await recordSignupStep('account_created');
    return { kind: 'finish_profile' };
  } catch {
    return { kind: 'complete' };
  }
}
