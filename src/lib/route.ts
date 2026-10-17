import { create } from 'zustand';

export type Tab = 'today' | 'history' | 'progress' | 'profile';
const TABS: Tab[] = ['today', 'history', 'progress', 'profile'];

interface Route {
  tab: Tab;
  /** Open sheet, e.g. "workout", "session:<id>", "split". */
  sheet: string | null;
}

function parse(): Route {
  const [tab, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return { tab: TABS.includes(tab as Tab) ? (tab as Tab) : 'today', sheet: rest.length ? decodeURIComponent(rest.join('/')) : null };
}
const href = (r: Route) => `#/${r.tab}${r.sheet ? `/${encodeURIComponent(r.sheet)}` : ''}`;

export const useRoute = create<Route>(() => parse());

addEventListener('popstate', () => useRoute.setState(parse()));

// After a reload, the sheet entry has no in-app entry behind it; drop the flag so close() replaces.
if (history.state?.sheet) history.replaceState(null, '', location.hash);

export function go(tab: Tab) {
  const next = { tab, sheet: null };
  history.replaceState(null, '', href(next));
  useRoute.setState(next);
  scrollTo({ top: 0 });
}

/** Sheets push a history entry so Android's back button closes them. */
export function openSheet(sheet: string) {
  const next = { tab: useRoute.getState().tab, sheet };
  history.pushState({ sheet: true }, '', href(next));
  useRoute.setState(next);
}

/** eplace closes without history.back(), for sheets restored by a reload where back could leave the app. */
export function closeSheet(opts?: { replace?: boolean }) {
  if (!useRoute.getState().sheet) return;
  if (history.state?.sheet && !opts?.replace) history.back();
  else {
    const next = { tab: useRoute.getState().tab, sheet: null };
    history.replaceState(null, '', href(next));
    useRoute.setState(next);
  }
}
