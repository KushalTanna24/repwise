// The groups migration can't run in vitest, so its privilege lines are pinned here.
// Supabase grants ALL on new public tables to `authenticated` by default; the column grants mean nothing unless that is revoked.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../../supabase/migrations/20261113000000_groups.sql', import.meta.url), 'utf8');

describe('groups migration privileges', () => {
  it('revokes default table privileges from authenticated as well as anon and public', () => {
    const revoke = sql.match(/revoke all on table public\.groups, public\.group_members, public\.nudges from ([^;]+);/)?.[1] ?? '';
    const roles = revoke.split(',').map((r) => r.trim()).sort();
    expect(roles).toEqual(['anon', 'authenticated', 'public']);
  });

  it('grants authenticated only select and the named column updates', () => {
    const grants = [...sql.matchAll(/^grant ([^;]+) on table ([^;]+) to authenticated;/gm)].map((m) => `${m[1]} @ ${m[2]}`);
    expect(grants).toEqual([
      'select @ public.groups, public.group_members, public.nudges',
      'update (name) @ public.groups',
      'update (display_name, share_body) @ public.group_members',
      'update (read_at) @ public.nudges',
    ]);
  });
});
