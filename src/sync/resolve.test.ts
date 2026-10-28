import { describe, expect, it } from 'vitest';
import { emptyAppData } from '@/domain/catalogue';
import v2 from '@/domain/fixtures/v2.json';
import type { AppData } from '@/domain/types';
import { resolveSync } from './resolve';

const NOW = '2026-10-17T08:00:00.000Z';
function doc(updatedAt: string, withData: boolean): AppData {
  const d = emptyAppData(updatedAt);
  if (withData) d.bodyweights = [{ id: 'w', date: '2026-10-01', kg: 60 }];
  return d;
}

describe('resolveSync', () => {
  it('no cloud row: push local', () => {
    const local = doc('2026-10-10T00:00:00Z', true);
    expect(resolveSync(local, { ok: true, doc: null }, NOW)).toEqual({ action: 'push', data: local });
  });

  it('empty local takes non-empty cloud even if local is newer', () => {
    const remote = doc('2026-10-01T00:00:00Z', true);
    const r = resolveSync(doc('2026-10-10T00:00:00Z', false), { ok: true, doc: remote }, NOW);
    expect(r.action).toBe('take');
    expect(r.data.bodyweights).toHaveLength(1);
  });

  it('empty cloud never overwrites local', () => {
    const local = doc('2026-10-01T00:00:00Z', true);
    expect(resolveSync(local, { ok: true, doc: doc('2026-10-10T00:00:00Z', false) }, NOW)).toEqual({ action: 'push', data: local });
  });

  it('both have data: newer wins', () => {
    const older = doc('2026-10-01T00:00:00Z', true);
    const newer = doc('2026-10-10T00:00:00Z', true);
    expect(resolveSync(older, { ok: true, doc: newer }, NOW).action).toBe('take');
    expect(resolveSync(newer, { ok: true, doc: older }, NOW).action).toBe('push');
    expect(resolveSync(newer, { ok: true, doc: newer }, NOW).action).toBe('keep');
  });

  it('resolveSync keeps local on error', () => {
    const local = doc('2026-10-01T00:00:00Z', true);
    const r = resolveSync(local, { ok: false }, NOW);
    expect(r.action).toBe('error');
    expect(r.data).toBe(local);
  });

  it('unreadable cloud document is an error, not an overwrite', () => {
    const local = doc('2026-10-01T00:00:00Z', true);
    expect(resolveSync(local, { ok: true, doc: { junk: true } }, NOW).action).toBe('error');
  });

  it('legacy v2 cloud documents are normalised', () => {
    const r = resolveSync(doc('2026-10-01T00:00:00Z', false), { ok: true, doc: v2 }, NOW);
    expect(r.action).toBe('take');
    expect(r.data.sessions).toHaveLength(2);
  });
});
