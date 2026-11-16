// Dependency-free copy of waterPace from src/domain/water.ts. decide.test.ts proves they match.
export interface ReminderWindow { from: number; to: number; }

export function waterPace(glasses: number, goal: number, nowMinutes: number, window: ReminderWindow): { expected: number; behind: number; inWindow: boolean } {
  const { from, to } = window;
  if (to <= from || goal <= 0 || nowMinutes < from * 60 || nowMinutes > to * 60) return { expected: 0, behind: 0, inWindow: false };
  const raw = Math.ceil((goal * (nowMinutes - from * 60)) / ((to - from) * 60));
  const expected = Math.min(goal, Math.max(0, raw));
  return { expected, behind: Math.max(0, expected - glasses), inWindow: true };
}
