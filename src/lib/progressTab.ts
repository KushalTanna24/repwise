import { create } from 'zustand';

/** Which Progress segment is showing; Today deep-links to Body. */
export const useProgressTab = create<{ tab: 'strength' | 'body' }>(() => ({ tab: 'strength' }));
