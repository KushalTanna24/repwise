import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const button = cva(
  'press inline-flex items-center justify-center gap-2 font-semibold select-none disabled:opacity-40 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-blue text-white',
        tinted: 'bg-blue/12 text-blue',
        plain: 'text-blue',
        gray: 'bg-fill text-label',
        destructive: 'bg-red/12 text-red',
        success: 'bg-green text-white',
      },
      size: {
        lg: 'h-[52px] px-5 rounded-[14px] text-headline w-full',
        md: 'h-10 px-4 rounded-full text-subhead',
        sm: 'h-8 px-3 rounded-full text-footnote',
        icon: 'size-9 rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...props} />;
}
