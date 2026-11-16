import { applyProfileToActive } from '@/domain/session';
import { currentRotation, getSplit, weekSummary } from '@/domain/training';
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
  const split = data.program.splitId ? getSplit(data, data.program.splitId) : undefined;
  const len = split?.sessions.length ?? 0;
  // A generated plan was built for a set number of days; a different count deserves a fresh plan, not a repeat.
  const generated = !!split?.custom && ('generated' in split || split.name.startsWith('Your plan'));
  const rebuild = generated && len !== p.daysPerWeek;
  return (
    <Sheet open={open} onClose={onClose} tall title="Training plan" right={<Done onClose={onClose} />}>
      <List>
        <Row title="Split" value={(data.program.splitId && getSplit(data, data.program.splitId)?.name) || 'Not set'} onClick={() => openSheet('split')} chevron />
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
      {split && (
        <p className="px-4 pt-2 text-footnote text-label-2">
          {split.name} has {len} {len === 1 ? 'day' : 'days'}. {weekSummary(len, p.daysPerWeek)}.
          {currentRotation(data, split.id).sessionIndex > 0 ? ' Your place in the rotation stays.' : ''}
        </p>
      )}
      {rebuild && (
        <div className="mt-3">
          <List>
            <Row
              title={`Rebuild your plan for ${p.daysPerWeek} days`}
              subtitle="Answers stay filled in. Your current plan stays in your splits."
              onClick={() => openSheet('plan', { replace: true })}
              className="text-blue"
              chevron
            />
          </List>
        </div>
      )}
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
