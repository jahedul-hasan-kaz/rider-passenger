import i18n from '@/i18n';

import { AuthFailure } from './auth';

/** User-facing text for a sign-in failure. */
export function authMessage(error: unknown): string {
  if (!(error instanceof AuthFailure)) return i18n.t('errors.generic');
  return i18n.t(`auth.errors.${error.problem}`, { seconds: error.retryAfterS ?? 60 });
}
