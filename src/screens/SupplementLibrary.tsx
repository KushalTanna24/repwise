import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Check, Pencil, Plus } from 'lucide-react';
import { SUPPLEMENT_CATALOGUE, TIMING_LABEL, TIMING_ORDER, addFromCatalogue } from '@/domain/supplementCatalogue';
import { activeSupplements, addSupplement, renameSupplement, setSupplementArchived, updateSupplement } from '@/domain/supplements';
import type { SuppTiming } from '@/domain/types';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List, Row } from '@/components/ui/card';
import { FieldRow, Select, TextInput } from '@/components/ui/field';
import { Menu } from '@/components/ui/menu';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';

const TIMING_OPTIONS = TIMING_ORDER.map((value) => ({ value, label: TIMING_LABEL[value] }));
const Caption = ({ children }: { children: string }) => <div className="px-4 pb-2 pt-6 text-footnote uppercase text-label-2">{children}</div>;

export function SupplementSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState({ name: '', dose: '', timing: 'any' as SuppTiming });

  const active = activeSupplements(data);
  const archived = data.supplements.filter((s) => s.archived);
  const activeIds = new Set(active.map((s) => s.id));
  const query = q.trim();

  const groups = useMemo(() => {
    const n = query.toLowerCase();
    const hits = SUPPLEMENT_CATALOGUE.filter((c) => !n || `${c.name} ${c.note}`.toLowerCase().includes(n));
    return TIMING_ORDER.map((t) => ({ timing: t, items: hits.filter((c) => c.timing === t) })).filter((g) => g.items.length);
  }, [query]);

  function addCustom(name = draft.name, dose = draft.dose, timing = draft.timing) {
    if (!name.trim()) return toast('Name the supplement');
    act((d) => {
      const next = addSupplement(d, name, dose);
      const added = next.supplements[next.supplements.length - 1];
      return timing !== 'any' && next !== d ? updateSupplement(next, added.id, { timing }) : next;
    });
    toast(`${name.trim()} added`);
    setDraft({ name: '', dose: '', timing: 'any' });
    setQ('');
  }

  function rename(id: string, current: string) {
    const name = window.prompt('Rename supplement', current);
    if (name?.trim()) act((d) => renameSupplement(d, id, name));
  }

  const stackRow = (s: (typeof data.supplements)[number]) => (
    <div key={s.id} className="flex items-center gap-2 py-2.5 pl-4 pr-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep">
      <div className="min-w-0 flex-1">
        <div className={s.archived ? 'truncate text-body text-label-3' : 'truncate text-body'}>{s.name}</div>
        {s.archived ? (
          <div className="text-footnote text-label-2">Archived · history kept</div>
        ) : (
          <div className="flex items-center gap-3">
            <TextInput
              aria-label={`${s.name} dose`}
              placeholder="Dose"
              value={s.dose ?? ''}
              onChange={(e) => act((d) => updateSupplement(d, s.id, { dose: e.target.value }))}
              className="w-24 text-left text-footnote"
            />
            <Select label={`${s.name} timing`} value={s.timing ?? 'any'} options={TIMING_OPTIONS} onChange={(timing) => act((d) => updateSupplement(d, s.id, { timing }))} className="text-footnote" />
          </div>
        )}
      </div>
      <Menu
        label={`${s.name} options`}
        trigger={<Button variant="plain" size="sm">Edit</Button>}
        items={[
          { label: 'Rename', icon: <Pencil className="size-4" />, onSelect: () => rename(s.id, s.name) },
          s.archived
            ? { label: 'Restore', icon: <ArchiveRestore className="size-4" />, onSelect: () => act((d) => setSupplementArchived(d, s.id, false)) }
            : { label: 'Archive', icon: <Archive className="size-4" />, onSelect: () => act((d) => setSupplementArchived(d, s.id, true)), destructive: true },
        ]}
      />
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} tall title="Supplements" right={<Button variant="plain" size="sm" className="font-bold" onClick={onClose}>Done</Button>}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search supplements"
        aria-label="Search supplements"
        className="h-10 w-full rounded-[10px] bg-fill px-3 text-body outline-none placeholder:text-label-2"
      />

      <Caption>Your stack</Caption>
      {data.supplements.length ? (
        <List>
          {active.map(stackRow)}
          {archived.map(stackRow)}
        </List>
      ) : (
        <p className="px-4 text-footnote text-label-2">Nothing here yet. Add from the list below.</p>
      )}

      {groups.map((g) => (
        <div key={g.timing}>
          <Caption>{TIMING_LABEL[g.timing]}</Caption>
          <List>
            {g.items.map((c) => {
              const inStack = activeIds.has(c.id);
              return (
                <Row
                  key={c.id}
                  title={c.name}
                  subtitle={`${c.dose} · ${c.note}`}
                  value={
                    inStack ? (
                      <Check className="size-5 text-green" strokeWidth={3} aria-label="In your stack" />
                    ) : (
                      <Button
                        variant="plain"
                        size="sm"
                        aria-label={`Add ${c.name}`}
                        onClick={() => {
                          act((d) => addFromCatalogue(d, c.id));
                          toast(`${c.name} added`);
                        }}
                      >
                        <Plus className="size-4" strokeWidth={2.5} /> Add
                      </Button>
                    )
                  }
                />
              );
            })}
          </List>
        </div>
      ))}

      {query && !groups.length && (
        <>
          <Caption>No results</Caption>
          <List>
            <Row
              title={`No match. Add '${query}' as custom`}
              onClick={() => {
                setDraft({ ...draft, name: query });
                setQ('');
              }}
              chevron
            />
          </List>
        </>
      )}

      <Caption>Add custom</Caption>
      <List>
        <FieldRow label="Name">
          <TextInput placeholder="e.g. Taurine" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-40" />
        </FieldRow>
        <FieldRow label="Dose">
          <TextInput placeholder="Optional, e.g. 5 g" value={draft.dose} onChange={(e) => setDraft({ ...draft, dose: e.target.value })} className="w-40" />
        </FieldRow>
        <FieldRow label="When">
          <Select label="When" value={draft.timing} options={TIMING_OPTIONS} onChange={(timing) => setDraft({ ...draft, timing })} />
        </FieldRow>
      </List>
      <Button className="mt-3 w-full" onClick={() => addCustom()}>
        <Plus className="size-4" strokeWidth={2.5} /> Add supplement
      </Button>
    </Sheet>
  );
}
