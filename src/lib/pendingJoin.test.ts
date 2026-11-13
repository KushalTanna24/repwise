import { describe, expect, it } from 'vitest';
import { createPendingJoin, inviteCodeFromSheet, inviteUrl } from './pendingJoin';

describe('inviteCodeFromSheet', () => {
  it('reads the code from a join sheet', () => expect(inviteCodeFromSheet('join:ab3cd7')).toBe('AB3CD7'));
  it('ignores an empty join sheet and other sheets', () => {
    expect(inviteCodeFromSheet('join:')).toBeNull();
    expect(inviteCodeFromSheet('member:g:u')).toBeNull();
    expect(inviteCodeFromSheet(null)).toBeNull();
  });
});

function memory(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('pendingJoin', () => {
  it('take returns the saved code once, then null', () => {
    const p = createPendingJoin(memory());
    p.save(' ab12cd ');
    expect(p.take()).toBe('AB12CD');
    expect(p.take()).toBeNull();
  });

  it('ignores an empty code', () => {
    const p = createPendingJoin(memory());
    p.save('');
    expect(p.take()).toBeNull();
  });

  it('survives storage that throws', () => {
    const p = createPendingJoin({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });
    expect(() => p.save('AB12CD')).not.toThrow();
    expect(p.take()).toBeNull();
  });
});

describe('inviteUrl', () => {
  it('builds the hash link', () => {
    expect(inviteUrl('AB12CD', 'https://repwise.app')).toBe('https://repwise.app/#/groups/join:AB12CD');
  });
});
