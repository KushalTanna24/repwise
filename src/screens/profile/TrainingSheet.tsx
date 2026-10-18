import { applyProfileToActive } from '@/domain/session';
import { SPLITS } from '@/domain/splits';
import { Sheet } from '@/components/ui/sheet';
import { List, Row } from '@/components/ui/card';
import { FieldRow, Select } from '@/components/ui/field';
import { openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';
import { Done } from './Done';
import { setProfile } from './setProfile';

export function TrainingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const p = data.profile;
  return (
    <Sheet open={open} onClose={onClose} tall title="Training" right={<Done onClose={onClose} />}>
      <List>
        <Row title="Split" value={data.program.splitId ? SPLITS[data.program.splitId].name : 'Not set'} onClick={() => openSheet('split')} chevron />
        <FieldRow label="Goal">
          <Select
            label="Goal"
            value={p.objective}
            onChange={(objective) => setProfile({ objective })}
            options={[
              { value: 'hypertrophy', label: 'Build muscle' },
              { value: 'strength', label: 'Get stronger' },
              { value: 'general', label: 'General fitness' },
            ]}
          />
        </FieldRow>
        <FieldRow label="Experience">
          <Select
            label="Experience"
            value={p.experience}
            onChange={(experience) => setProfile({ experience }, false)}
            options={[
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
        </FieldRow>
        <FieldRow label="Days per week">
          <Select label="Days per week" value={p.daysPerWeek} onChange={(daysPerWeek) => setProfile({ daysPerWeek }, false)} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
        </FieldRow>
        <FieldRow label="Session length">
          <Select
            label="Session length"
            value={p.sessionMinutes}
            onChange={(sessionMinutes) => setProfile({ sessionMinutes })}
            options={[
              { value: 45 as const, label: '45 min' },
              { value: 60 as const, label: '60 min' },
              { value: 75 as const, label: '75 min' },
              { value: 90 as const, label: '90 min' },
            ]}
          />
        </FieldRow>
        <FieldRow label="Units">
          <Select label="Units" value={p.units} onChange={(units) => setProfile({ units }, false)} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </FieldRow>
      </List>
      {data.activeSession && (
        <div className="mt-3">
          <List>
            <Row
              title="Apply to current workout"
              subtitle="Updates exercises you haven't started. Logged sets stay as they are."
              onClick={() => {
                act(applyProfileToActive);
                toast('Current workout updated');
              }}
              className="text-blue"
              chevron
            />
          </List>
        </div>
      )}
      <p className="px-4 pt-2 text-footnote text-label-2">Changes apply from your next workout. History is never touched.</p>
    </Sheet>
  );
}
