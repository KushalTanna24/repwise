import type { Profile } from '@/domain/types';
import { updateProfile } from '@/domain/session';
import { toast } from '@/lib/toast';
import { act, useApp } from '@/store/app';

export function setProfile(patch: Partial<Profile>, note = true) {
  const busy = !!useApp.getState().data.activeSession;
  act((d) => updateProfile(d, patch));
  if (note) toast(busy ? 'Saved. Applies after this workout' : 'Saved. Applies from your next workout');
}
