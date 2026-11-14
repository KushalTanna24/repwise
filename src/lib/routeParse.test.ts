import { describe, expect, it } from 'vitest';
import { parseHash } from './routeParse';

describe('parseHash', () => {
  it('treats an auth fragment as Today', () => {
    expect(parseHash('#access_token=a&x=b/c')).toEqual({ tab: 'today', sheet: null });
  });
  it('reads the groups tab and an invite sheet', () => {
    expect(parseHash('#/groups/join:AB12CD')).toEqual({ tab: 'groups', sheet: 'join:AB12CD' });
    expect(parseHash('#/groups/join%3AAB12CD')).toEqual({ tab: 'groups', sheet: 'join:AB12CD' });
  });
  it('reads tab and sheet', () => {
    expect(parseHash('#/profile/supps')).toEqual({ tab: 'profile', sheet: 'supps' });
  });
});
