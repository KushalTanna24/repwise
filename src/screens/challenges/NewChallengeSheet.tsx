import { useState } from 'react';
import dayjs from 'dayjs';
import { Plus, X } from 'lucide-react';
import { habitStackDraft, HABIT_STACK_DAYS, seventyFiveDraft, type ChallengeDraft } from '@/domain/challengeTemplates';
import { startChallenge } from '@/domain/challenges';
import type { ChallengeRun, ChallengeTask } from '@/domain/types';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { FieldRow, TextInput } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { useToday } from '@/lib/useToday';
import { act } from '@/store/app';

type TemplateId = ChallengeRun['templateId'];
type Link = 'none' | 'workout' | 'water';
interface TaskInput {
  label: string;
  kind: ChallengeTask['kind'];
  link: Link;
}

const TITLES: Record<TemplateId, string> = { '75-day': '75-Day Challenge', 'habit-stack': 'Habit stack', custom: 'Build your own' };
const MAX_TASKS = 10;

export function NewChallengeSheet({ templateId, onClose }: { templateId: TemplateId | null; onClose: () => void }) {
  const today = useToday();
  const [when, setWhen] = useState<'today' | 'tomorrow'>('today');
  const [anchor, setAnchor] = useState('');
  const [habits, setHabits] = useState(['', '', '']);
  const [length, setLength] = useState<'21' | '30' | '66'>('30');
  const [name, setName] = useState('');
  const [days, setDays] = useState('30');
  const [rule, setRule] = useState<'strict' | 'lenient'>('lenient');
  const [tasks, setTasks] = useState<TaskInput[]>([{ label: '', kind: 'tick', link: 'none' }]);

  function draft(): ChallengeDraft | string {
    if (templateId === '75-day') return seventyFiveDraft();
    if (templateId === 'habit-stack') {
      const list = habits.map((h) => h.trim()).filter(Boolean);
      if (!anchor.trim()) return 'Name the habit you already do';
      if (!list.length) return 'Add at least one new habit';
      return habitStackDraft(anchor.trim(), list, Number(length) as (typeof HABIT_STACK_DAYS)[number]);
    }
    const n = Math.round(Number(days));
    const list = tasks.filter((t) => t.label.trim());
    if (!name.trim()) return 'Name your challenge';
    if (!(n >= 7 && n <= 365)) return 'Pick 7 to 365 days';
    if (!list.length) return 'Add at least one task';
    return {
      templateId: 'custom',
      title: name.trim(),
      days: n,
      rule,
      tasks: list.map((t, i) => ({
        id: `c${i + 1}`,
        label: t.label.trim(),
        // A linked task ticks itself, so it is never a photo.
        kind: t.link === 'none' ? t.kind : 'tick',
        ...(t.link !== 'none' ? { auto: t.link } : {}),
      })),
    };
  }

  function start() {
    const d = draft();
    if (typeof d === 'string') return toast(d);
    const id = crypto.randomUUID();
    const startDate = when === 'today' ? today : dayjs(today).add(1, 'day').format('YYYY-MM-DD');
    act((x) => startChallenge(x, d, startDate, id));
    toast(when === 'today' ? `${d.title} started. Day 1` : `${d.title} starts tomorrow`);
    // Back from the run should not land on this form again.
    openSheet(`challenge:${id}`, { replace: true });
  }

  const setTask = (i: number, patch: Partial<TaskInput>) => setTasks(tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Sheet open={!!templateId} onClose={onClose} tall title={templateId ? TITLES[templateId] : ''}>
      {templateId === '75-day' && (
        <List>
          {seventyFiveDraft().tasks.map((t) => (
            <div key={t.id} className="px-4 py-2.5 text-body [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep">
              {t.label}
              {t.auto && <span className="ml-2 text-footnote text-label-2">ticks itself</span>}
            </div>
          ))}
        </List>
      )}

      {templateId === 'habit-stack' && (
        <List>
          <FieldRow label="After I…">
            <TextInput aria-label="Anchor habit" placeholder="have my morning coffee" value={anchor} onChange={(e) => setAnchor(e.target.value)} className="w-48" />
          </FieldRow>
          {habits.map((h, i) => (
            <FieldRow key={i} label={`New habit ${i + 1}`}>
              <TextInput aria-label={`New habit ${i + 1}`} placeholder={i === 0 ? 'stretch 5 min' : 'optional'} value={h} onChange={(e) => setHabits(habits.map((x, j) => (j === i ? e.target.value : x)))} className="w-48" />
            </FieldRow>
          ))}
          <FieldRow label="Days">
            <Segmented className="w-40" value={length} onChange={setLength} options={HABIT_STACK_DAYS.map((n) => ({ value: String(n) as '21' | '30' | '66', label: String(n) }))} />
          </FieldRow>
        </List>
      )}

      {templateId === 'custom' && (
        <>
          <List>
            <FieldRow label="Name">
              <TextInput aria-label="Challenge name" placeholder="30 days of pushups" value={name} onChange={(e) => setName(e.target.value)} className="w-48" />
            </FieldRow>
            <FieldRow label="Days">
              <TextInput aria-label="Days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="w-20 text-right" />
            </FieldRow>
            <FieldRow label="Rule" hint={rule === 'strict' ? 'Miss a task and you restart from day 1.' : 'Missed days lower your score; the run keeps going.'}>
              <Segmented className="w-44" value={rule} onChange={setRule} options={[{ value: 'lenient', label: 'Lenient' }, { value: 'strict', label: 'Strict' }]} />
            </FieldRow>
          </List>
          <div className="mt-4 space-y-2">
            {tasks.map((t, i) => (
              <List key={i}>
                <div className="flex items-center gap-2 px-4 py-2">
                  <TextInput aria-label={`Task ${i + 1}`} placeholder={`Task ${i + 1}`} value={t.label} onChange={(e) => setTask(i, { label: e.target.value })} className="min-w-0 flex-1" />
                  {tasks.length > 1 && (
                    <button aria-label={`Remove task ${i + 1}`} onClick={() => setTasks(tasks.filter((_, j) => j !== i))} className="press grid size-8 place-items-center rounded-full text-label-2">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 px-4 pb-3">
                  <Segmented className="w-32" value={t.kind} onChange={(kind) => setTask(i, { kind })} options={[{ value: 'tick', label: 'Tick' }, { value: 'photo', label: 'Photo' }]} />
                  <Segmented className="min-w-0 flex-1" value={t.link} onChange={(link) => setTask(i, { link })} options={[{ value: 'none', label: 'Manual' }, { value: 'workout', label: 'Workout' }, { value: 'water', label: 'Water' }]} />
                </div>
              </List>
            ))}
          </div>
          {tasks.length < MAX_TASKS && (
            <Button variant="plain" className="mt-2" onClick={() => setTasks([...tasks, { label: '', kind: 'tick', link: 'none' }])}>
              <Plus className="size-4" /> Add task
            </Button>
          )}
        </>
      )}

      <List className="mt-4">
        <FieldRow label="Start">
          <Segmented className="w-48" value={when} onChange={setWhen} options={[{ value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }]} />
        </FieldRow>
      </List>
      <Button size="lg" className="mt-4" onClick={start}>
        Start challenge
      </Button>
    </Sheet>
  );
}
