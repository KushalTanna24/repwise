import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Custom type scale from index.css. Without this, tailwind-merge treats
// `text-headline` as a colour and drops `text-white` next to it.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ['largetitle', 'title2', 'title3', 'headline', 'body', 'callout', 'subhead', 'footnote', 'caption'] },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
