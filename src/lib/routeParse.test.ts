import { describe, expect, it } from 'vitest';
import { parseHash } from './routeParse';

describe('parseHash', () => {
  it('treats an auth fragment as Today', () => {
    expect(parseHash('#access_token=a&x=b/c')).toEqual({ tab: 'today', sheet: null });
  });
  it('reads tab and sheet', () => {
    expect(parseHash('#/profile/supps')).toEqual({ tab: 'profile', sheet: 'supps' });
  });
});
