import { isEmpty } from '../migrate';
import type { AppData } from '../types';

/**
 * Onboarding shows only on a truly fresh document. Synced data arriving on a new
 * device ends it even before `onboardedAt` exists there.
 */
export function needsOnboarding(data: AppData): boolean {
  return !data.profile.onboardedAt && isEmpty(data) && !data.program.splitId && data.customSplits.length === 0;
}
