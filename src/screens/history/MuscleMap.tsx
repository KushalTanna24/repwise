import { useMemo, useState } from 'react';
import { MUSCLE_LABEL, MUSCLES, muscleHeat, type Heat, type Muscle } from '@/domain/muscles';
import type { AppData } from '@/domain/types';
import { Card } from '@/components/ui/card';
import { fmtDay } from '@/lib/fmt';
import { BODY_BACK, BODY_FRONT, type BodyPart } from './bodyShapes';

const HOT = 'var(--color-red)';
const COLD = 'var(--color-label-3)';
const BODY = 'var(--color-label-3)';

const fmtSets = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

/** Group polygons by muscle so one tap target covers every piece of it. */
function byMuscle(parts: BodyPart[]) {
  const frame: string[] = [];
  const muscles = new Map<Muscle, string[]>();
  for (const p of parts) {
    if (p.muscle) muscles.set(p.muscle, [...(muscles.get(p.muscle) ?? []), ...p.points]);
    else frame.push(...p.points);
  }
  return { frame, muscles: [...muscles.entries()] };
}

const FRONT = byMuscle(BODY_FRONT);
const BACK = byMuscle(BODY_BACK);

function Figure({ label, body, heat, selected, onSelect }: { label: string; body: ReturnType<typeof byMuscle>; heat: Record<Muscle, Heat>; selected: Muscle | null; onSelect: (m: Muscle) => void }) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 100 222" className="h-40 w-auto" role="group" aria-label={`${label} muscles`}>
        {body.frame.map((pts, i) => (
          <polygon key={`f${i}`} points={pts} fill={BODY} fillOpacity={0.35} />
        ))}
        {body.muscles.map(([m, polys]) => {
          const h = heat[m].heat;
          const on = selected === m;
          return (
            <g
              key={m}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${MUSCLE_LABEL[m]}, ${fmtSets(heat[m].sets)} sets in the last 7 days`}
              onClick={() => onSelect(m)}
              onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onSelect(m))}
              className="cursor-pointer outline-none [&>*]:transition-[fill-opacity] [&>*]:duration-300 motion-reduce:[&>*]:transition-none focus-visible:[&>*]:stroke-blue"
            >
              {polys.map((pts, i) => (
                <polygon
                  key={i}
                  points={pts}
                  fill={h > 0 ? HOT : COLD}
                  fillOpacity={h > 0 ? 0.25 + 0.75 * h : 0.55}
                  stroke={on ? 'var(--color-label)' : 'var(--color-card)'}
                  strokeWidth={on ? 1.2 : 0.6}
                  strokeLinejoin="round"
                />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-caption font-semibold uppercase tracking-wide text-label-2">{label}</figcaption>
    </figure>
  );
}

/** Front and back body, each muscle lit by last week's sets and fading as the days pass. */
export function MuscleMap({ data, today }: { data: AppData; today: string }) {
  const heat = useMemo(() => muscleHeat(data, today), [data, today]);
  const [selected, setSelected] = useState<Muscle | null>(null);
  const top = MUSCLES.filter((m) => heat[m].heat > 0)
    .sort((a, b) => heat[b].heat - heat[a].heat)
    .slice(0, 3);
  const pick = (m: Muscle) => setSelected(selected === m ? null : m);
  const h = selected ? heat[selected] : null;

  return (
    <Card className="mt-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-headline font-semibold">
          Muscles <span className="text-footnote font-normal text-label-2">· last 7 days</span>
        </h2>
        <div className="flex items-center gap-1.5 text-caption text-label-2" aria-hidden>
          <span>Fading</span>
          <span className="h-1.5 w-12 rounded-full" style={{ background: `linear-gradient(to right, color-mix(in srgb, ${HOT} 25%, transparent), ${HOT})` }} />
          <span>Fresh</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex shrink-0">
          <Figure label="Front" body={FRONT} heat={heat} selected={selected} onSelect={pick} />
          <Figure label="Back" body={BACK} heat={heat} selected={selected} onSelect={pick} />
        </div>
        <div className="min-w-0 flex-1" aria-live="polite">
          {selected && h ? (
            <>
              <div className="text-headline font-semibold">{MUSCLE_LABEL[selected]}</div>
              <div className="mt-0.5 text-title2 font-bold tabular">
                {fmtSets(h.sets)} <span className="text-subhead font-semibold text-label-2">{h.sets === 1 ? 'set' : 'sets'} this week</span>
              </div>
              <div className="mt-1 text-footnote text-label-2">{h.last ? `Last trained ${fmtDay(h.last).replace(/^(Today|Yesterday)$/, (d) => d.toLowerCase())}` : 'Not trained yet'}</div>
            </>
          ) : top.length ? (
            <>
              <div className="text-caption font-semibold uppercase tracking-wide text-label-2">Most worked</div>
              <ul className="mt-1 grid gap-1.5">
                {top.map((m) => (
                  <li key={m}>
                    <button onClick={() => pick(m)} className="press flex w-full items-baseline justify-between gap-2 text-left">
                      <span className="truncate text-subhead font-semibold">{MUSCLE_LABEL[m]}</span>
                      <span className="shrink-0 text-footnote tabular text-label-2">{fmtSets(heat[m].sets)} sets</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-caption text-label-3">Tap a muscle for details</div>
            </>
          ) : (
            <p className="text-footnote text-label-2">Nothing trained in the last 7 days. Muscles light up as you log sets.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
