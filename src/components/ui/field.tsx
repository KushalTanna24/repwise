import type { InputHTMLAttributes, ReactNode } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Label-left, control-right row for grouped forms. */
export function FieldRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex min-h-[48px] items-center gap-3 pl-4 [&:not(:last-child)>:last-child]:border-b [&:not(:last-child)>:last-child]:border-sep">
      <div className="flex min-w-0 flex-1 items-center gap-3 py-2 pr-4">
        <div className="flex-1">
          <div className="text-body">{label}</div>
          {hint && <div className="text-footnote text-label-2">{hint}</div>}
        </div>
        {children}
      </div>
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn('min-w-0 bg-transparent text-right text-body text-label-2 outline-none placeholder:text-label-3 focus:text-label', className)}
      {...props}
    />
  );
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <span className="relative inline-flex items-center gap-1 text-label-2">
      <select
        aria-label={label}
        value={String(value)}
        onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}
        className="appearance-none bg-transparent pr-5 text-right text-body outline-none"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-0 size-4 text-label-3" />
    </span>
  );
}

/** iOS switch. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={cn('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-green' : 'bg-fill')}
    >
      <span
        className={cn(
          'absolute top-[2px] size-[27px] rounded-full bg-white shadow-thumb transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}
