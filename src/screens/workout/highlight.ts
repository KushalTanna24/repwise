import { create } from 'zustand';

/** The set row the Next bar points at; flashes briefly after a tap. */
export const useHighlight = create<{ key: string | null }>(() => ({ key: null }));

let timer: ReturnType<typeof setTimeout>;
export function flashSet(exIdx: number, setIdx: number) {
  clearTimeout(timer);
  useHighlight.setState({ key: `${exIdx}-${setIdx}` });
  document.querySelector(`[data-set-row="${exIdx}-${setIdx}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  timer = setTimeout(() => useHighlight.setState({ key: null }), 1500);
}