import { create } from 'zustand';

export const useToast = create<{ text: string | null; id: number }>(() => ({ text: null, id: 0 }));

let timer: ReturnType<typeof setTimeout>;
export function toast(text: string) {
  clearTimeout(timer);
  useToast.setState((s) => ({ text, id: s.id + 1 }));
  timer = setTimeout(() => useToast.setState({ text: null }), 2400);
}
