export type Tab = 'today' | 'history' | 'progress' | 'profile';
const TABS: Tab[] = ['today', 'history', 'progress', 'profile'];

export interface Route {
  tab: Tab;
  /** Open sheet, e.g. "workout", "session:<id>", "split". */
  sheet: string | null;
}

/** Pure so tests can import it without route.ts's browser side effects. */
export function parseHash(hash: string): Route {
  const [tab, ...rest] = hash.replace(/^#\/?/, '').split('/');
  // A first segment with "=" is an auth fragment (#access_token=...), not a route.
  if (tab.includes('=')) return { tab: 'today', sheet: null };
  return { tab: TABS.includes(tab as Tab) ? (tab as Tab) : 'today', sheet: rest.length ? decodeURIComponent(rest.join('/')) : null };
}
