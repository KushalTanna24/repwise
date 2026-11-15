import { Clock, Dumbbell, Plus, Zap } from 'lucide-react';
import type { StartChoice, StartMode } from '@/domain/startOptions';
import { List, Row } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';

const ICON: Record<StartMode, typeof Clock> = { full: Dumbbell, short: Clock, 'extra-sets': Zap, 'extra-exercise': Plus };

/** Asked as a workout starts: use the time as planned, keep it short, or push a little more today. */
export function StartSheet({ choices, onPick, onClose }: { choices: StartChoice[] | null; onPick: (mode: StartMode) => void; onClose: () => void }) {
  return (
    <Sheet open={!!choices} onClose={onClose} title="How much time today?">
      <p className="px-1 pb-3 text-subhead text-label-2">Pick what fits. You can still stop early or add more once you're going.</p>
      <List>
        {(choices ?? []).map((c) => {
          const Icon = ICON[c.mode];
          return (
            <Row
              key={c.mode}
              leading={<Icon className="size-5 shrink-0 text-blue" />}
              title={c.label}
              subtitle={c.detail}
              value={`~${c.minutes} min`}
              chevron
              onClick={() => onPick(c.mode)}
            />
          );
        })}
      </List>
    </Sheet>
  );
}
