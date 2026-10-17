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

export function closeSheet() {
  if (!useRoute.getState().sheet) return;
  if (history.state?.sheet) history.back();
  else {
    const next = { tab: useRoute.getState().tab, sheet: null };
    history.replaceState(null, '', href(next));
    useRoute.setState(next);
  }
}
