// Short-lived photo links for one member, as one group may see them. index.ts wires the real calls.

/** Links stop working five minutes after issue, so turning body sharing off cuts access quickly. */
export const PHOTO_URL_SECONDS = 300;

export interface PhotoDeps {
  /** The member's share_body in that group, or null when viewer and member are not both in it. */
  shareBody(group: string, viewer: string, member: string): Promise<boolean | null>;
  /** Storage paths from the member's photos. */
  listPaths(member: string): Promise<string[]>;
  sign(path: string, seconds: number): Promise<string>;
}

export interface PhotoResponse { status: 200 | 403; body: { urls?: Record<string, string>; error?: string } }

export async function handlePhotos(deps: PhotoDeps, req: { viewer: string; group: string; member: string }): Promise<PhotoResponse> {
  const share = await deps.shareBody(req.group, req.viewer, req.member);
  if (share === null) return { status: 403, body: { error: 'Not in this group' } };
  if (!share) return { status: 403, body: { error: 'Not shared with this group' } };

  // The document is the member's own, so a path outside their folder is never signed.
  const prefix = `${req.member}/`;
  const paths = (await deps.listPaths(req.member)).filter((p) => p.startsWith(prefix) && !p.includes('..'));
  const urls: Record<string, string> = {};
  for (const p of paths) urls[p] = await deps.sign(p, PHOTO_URL_SECONDS);
  return { status: 200, body: { urls } };
}
