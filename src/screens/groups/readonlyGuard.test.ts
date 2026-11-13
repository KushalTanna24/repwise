// Tripwire: a member's document must never reach the viewer's own store or sync. Group screens may only
// read; anything that writes the viewer's own document goes through src/lib/groups.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('./', import.meta.url);
const sources = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'));
const WRITES = /\bact\s*\(|\buseApp\b|\.replace\s*\(|from\s+['"]@\/store\/app['"]/;

describe('group screens never write the viewer\'s document', () => {
  it('has group screens to check', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  for (const f of sources) {
    it(`${f} does not import the app store or call act/replace`, () => {
      expect(readFileSync(new URL(f, dir), 'utf8')).not.toMatch(WRITES);
    });
  }

  it('the document context never imports act', () => {
    const ctx = readFileSync(new URL('../../store/docContext.tsx', import.meta.url), 'utf8');
    expect(ctx).not.toMatch(/\bact\b/);
  });
});
