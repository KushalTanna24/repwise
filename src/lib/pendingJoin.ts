// An invite code opened before sign-in, kept across the magic-link round trip (the link lands back on the bare origin).
type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY = 'repwise_pending_join';

export function createPendingJoin(storage: KV | (() => KV | undefined)) {
  const get = (): KV | undefined => (typeof storage === 'function' ? storage() : storage);
  return {
    save(code: string) {
      const c = code.trim().toUpperCase();
      if (!c) return;
      try {
        get()?.setItem(KEY, c);
      } catch {
        /* storage blocked: the user can paste the code again */
      }
    },
    take(): string | null {
      try {
        const s = get();
        const c = s?.getItem(KEY) ?? null;
        if (c) s?.removeItem(KEY);
        return c;
      } catch {
        return null;
      }
    },
  };
}

/** The invite code in a `join:<code>` sheet, or null. */
export function inviteCodeFromSheet(sheet: string | null): string | null {
  if (!sheet?.startsWith('join:')) return null;
  const code = sheet.slice(5).trim().toUpperCase();
  return code || null;
}

export const pendingJoin =createPendingJoin(() => (typeof localStorage === 'undefined' ? undefined : localStorage));

export const inviteUrl = (code: string, origin: string = location.origin) => `${origin}/#/groups/join:${code}`;
