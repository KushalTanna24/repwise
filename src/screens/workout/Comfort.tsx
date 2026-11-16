import { useEffect, useRef, useState } from 'react';
import { Annoyed, Frown, Laugh, Meh, Smile } from 'lucide-react';
import { COMFORT_LABELS, rateSession } from '@/domain/comfort';
import type { AppData, ComfortScore } from '@/domain/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { act, useApp } from '@/store/app';

const SCORES: { score: ComfortScore; icon: typeof Smile }[] = [
  { score: 1, icon: Frown },
  { score: 2, icon: Annoyed },
  { score: 3, icon: Meh },
  { score: 4, icon: Smile },
  { score: 5, icon: Laugh },
];

const tone = (s: ComfortScore) => (s <= 2 ? 'bg-orange/15 text-[#C93400] ring-orange' : s === 3 ? 'bg-fill text-label ring-label-3' : 'bg-green/15 text-[#248A3D] ring-green');

/** "How did the exercise order feel?" for one finished workout. Tap the chosen face again to clear it. */
export function ComfortCard({ data, sessionId, className }: { data: AppData; sessionId: string; className?: string }) {
  const s = data.sessions.find((x) => x.id === sessionId);
  const score = s?.comfort?.score ?? null;
  const saved = s?.comfort?.note ?? '';
  const [note, setNote] = useState(saved);
  const latest = useRef(note);
  latest.current = note;
  useEffect(() => setNote(saved), [saved]);
  // Closing the sheet mid-typing still keeps the note.
  useEffect(
    () => () => {
      const cur = useApp.getState().data.sessions.find((x) => x.id === sessionId)?.comfort;
      if (cur) act((x) => rateSession(x, sessionId, cur.score, latest.current));
    },
    [sessionId],
  );
  if (!s) return null;

  return (
    <Card className={cn('w-full p-4 text-left', className)}>
      <div className="text-headline font-semibold">How did the exercise order feel?</div>
      <p className="text-footnote text-label-2">Log the flow of this day so you know when to reshuffle your split.</p>
      <div role="radiogroup" aria-label="Exercise order comfort" className="mt-3 grid grid-cols-5 gap-1.5">
        {SCORES.map(({ score: n, icon: Icon }) => {
          const on = score === n;
          return (
            <button
              key={n}
              role="radio"
              aria-checked={on}
              onClick={() => act((d) => rateSession(d, sessionId, on ? null : n))}
              className={cn('press flex flex-col items-center gap-1 rounded-[12px] py-2 transition-colors', on ? `ring-2 ${tone(n)}` : 'bg-fill-2 text-label-2')}
            >
              <Icon className="size-6" strokeWidth={on ? 2.5 : 2} />
              <span className="text-caption font-semibold">{COMFORT_LABELS[n]}</span>
            </button>
          );
        })}
      </div>
      {score != null && (
        <textarea
          rows={2}
          value={note}
          aria-label="Comfort note"
          placeholder={score <= 3 ? 'What felt off? e.g. Two heavy presses back to back' : 'What worked? (optional)'}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => act((d) => rateSession(d, sessionId, score, note))}
          className="mt-3 w-full resize-none rounded-[10px] bg-fill px-3 py-2 text-body outline-none placeholder:text-label-3 focus:ring-2 focus:ring-blue"
        />
      )}
    </Card>
  );
}
