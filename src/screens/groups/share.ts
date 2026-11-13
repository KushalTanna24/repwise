import { inviteUrl } from '@/lib/pendingJoin';
import { toast } from '@/lib/toast';

/** Opens the phone's share sheet with the invite link, or copies it where sharing isn't available. */
export async function shareInvite(groupName: string, code: string): Promise<void> {
  const url = inviteUrl(code);
  const text = `Join "${groupName}" on Repwise so we can keep each other going. Code: ${code}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Join my group on Repwise', text, url });
      return;
    }
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Invite link copied');
  } catch {
    toast(`Share this code: ${code}`);
  }
}
