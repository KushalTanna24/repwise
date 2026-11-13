import { create } from 'zustand';
import { parseHash, type Route, type Tab } from './routeParse';

export type { Tab };

const parse = () => parseHash(location.hash);
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

/** Sheets push a history entry so Android's back button closes them. `replace` swaps the open sheet for another. */
export function openSheet(sheet: string, opts?: { replace?: boolean }) {
  const next = { tab: useRoute.getState().tab, sheet };
  if (opts?.replace && history.state?.sheet) history.replaceState({ sheet: true }, '', href(next));
  else history.pushState({ sheet: true }, '', href(next));
  useRoute.setState(next);
}

/** `replace` closes without history.back(), for sheets restored by a reload where back could leave the app. */
export function closeSheet(opts?: { replace?: boolean }) {
  if (!useRoute.getState().sheet) return;
  if (history.state?.sheet && !opts?.replace) history.back();
  else {
    const next = { tab: useRoute.getState().tab, sheet: null };
    history.replaceState(null, '', href(next));
    useRoute.setState(next);
  }
}
