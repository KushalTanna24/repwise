import { describe, expect, it, vi } from 'vitest';
import { handlePhotos, PHOTO_URL_SECONDS, type PhotoDeps } from './run.ts';

function deps(over: Partial<PhotoDeps> = {}) {
  return {
    shareBody: vi.fn(async () => true as boolean | null),
    listPaths: vi.fn(async () => ['mom/p1.jpg', 'mom/p2.jpg']),
    sign: vi.fn(async (path: string, seconds: number) => `https://signed/${path}?s=${seconds}`),
    ...over,
  };
}
const req = { viewer: 'dad', group: 'g1', member: 'mom' };

describe('handlePhotos', () => {
  it('403 when not co-members', async () => {
    const d = deps({ shareBody: vi.fn(async () => null) });
    expect((await handlePhotos(d, req)).status).toBe(403);
    expect(d.sign).not.toHaveBeenCalled();
  });

  it('403 when share_body is off', async () => {
    const d = deps({ shareBody: vi.fn(async () => false) });
    expect((await handlePhotos(d, req)).status).toBe(403);
    expect(d.listPaths).not.toHaveBeenCalled();
  });

  it('signs every photo path for 300 seconds', async () => {
    const d = deps();
    const r = await handlePhotos(d, req);
    expect(PHOTO_URL_SECONDS).toBe(300);
    expect(r).toEqual({ status: 200, body: { urls: { 'mom/p1.jpg': 'https://signed/mom/p1.jpg?s=300', 'mom/p2.jpg': 'https://signed/mom/p2.jpg?s=300' } } });
  });

  it("only signs paths inside the member's own folder", async () => {
    const d = deps({ listPaths: vi.fn(async () => ['mom/p1.jpg', 'someone-else/p9.jpg', '../x.jpg']) });
    const r = await handlePhotos(d, req);
    expect(Object.keys(r.body.urls!)).toEqual(['mom/p1.jpg']);
  });
});
