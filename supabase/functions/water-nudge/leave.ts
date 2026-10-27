// Copy of onLeave in src/domain/leave.ts; leave.test.ts keeps them in step.
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function onLeaveDoc(doc: unknown, date: string): boolean {
  if (!isObj(doc) || !Array.isArray(doc.leave)) return false;
  return doc.leave.some((r) => isObj(r) && typeof r.start === 'string' && date >= r.start && (r.end === null || (typeof r.end === 'string' && date <= r.end)));
}
