// Account deletion: find and remove every file a user uploaded to the `gossoko-photos` bucket.
// Plain TypeScript (no Deno globals) so the app's unit tests can run it against a fake client.
//
// Files live at "<user id>/<uuid>.jpg" (storage policy + photos.path check). We remove both the paths
// recorded in gossoko.photos (read BEFORE the rows cascade away) and anything else under the user's
// folder (e.g. an upload whose row insert failed), so nothing is left behind.

export const PHOTO_BUCKET = 'gossoko-photos';

type StorageError = { message: string } | null;

/** The slice of a supabase-js (service-role) client this needs. */
export interface FilesClient {
  from(table: 'photos'): {
    select(cols: 'path'): { eq(col: 'user_id', v: string): PromiseLike<{ data: { path: string }[] | null; error: StorageError }> };
  };
  storage: {
    from(bucket: string): {
      list(prefix: string, opts: { limit: number; offset: number }): PromiseLike<{ data: { name: string; id?: string | null }[] | null; error: StorageError }>;
      remove(paths: string[]): PromiseLike<{ data: unknown; error: StorageError }>;
    };
  };
}

const PAGE = 1000;

/** Every path to delete for this user: their recorded photos plus whatever sits in their folder. Only their own folder. */
export async function collectAccountFiles(client: FilesClient, userId: string): Promise<string[]> {
  const out = new Set<string>();
  const { data: rows, error } = await client.from('photos').select('path').eq('user_id', userId);
  if (error) throw new Error(`photos: ${error.message}`);
  for (const r of rows ?? []) if (r.path) out.add(r.path);

  const bucket = client.storage.from(PHOTO_BUCKET);
  for (let offset = 0; ; offset += PAGE) {
    const { data, error: listErr } = await bucket.list(userId, { limit: PAGE, offset });
    if (listErr) throw new Error(`list: ${listErr.message}`);
    const page = data ?? [];
    // A folder entry has no id; photos are flat files under the user's folder.
    for (const f of page) if (f.name && f.id !== null) out.add(`${userId}/${f.name}`);
    if (page.length < PAGE) break;
  }
  // Never touch anything outside the user's own folder.
  return [...out].filter((p) => p.startsWith(`${userId}/`));
}

/** Delete the user's photo files. Returns how many paths were removed. Throws on a storage error. */
export async function removeAccountFiles(client: FilesClient, userId: string): Promise<number> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('bad user id');
  const paths = await collectAccountFiles(client, userId);
  const bucket = client.storage.from(PHOTO_BUCKET);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await bucket.remove(paths.slice(i, i + 100));
    if (error) throw new Error(`remove: ${error.message}`);
  }
  return paths.length;
}
