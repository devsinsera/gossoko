// Photos: re-encoded in the browser (max 1280px JPEG — this also strips EXIF/GPS), uploaded to the
// public `gossoko-photos` bucket under the uploader's id, and held 'pending' until a moderator approves.

import { supabase as getSupabase } from '@/lib/supabase/client';

const BUCKET = 'gossoko-photos';
const MAX_EDGE = 1280;
export const MAX_REVIEW_PHOTOS = 3;

export interface Photo { id: string; url: string; review_id: string | null }

export function photoUrl(path: string): string {
  return getSupabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Decode, scale to MAX_EDGE, re-encode as JPEG. Rejects anything that isn't a decodable image. */
export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file isn\'t a photo.');
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('Couldn\'t read that photo. Try a JPEG or PNG.'); }
  const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * k));
  canvas.height = Math.max(1, Math.round(bmp.height * k));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Couldn\'t process that photo.');
  if (blob.size > 2 * 1024 * 1024) throw new Error('That photo is too big even after shrinking.');
  return blob;
}

/** Upload one photo. venue photos: reviewId null (verified owners only). */
export async function uploadPhoto(userId: string, venueId: string, reviewId: string | null, file: File): Promise<void> {
  const blob = await prepareImage(file);
  const sb = getSupabase();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await sb.from('photos').insert({ user_id: userId, venue_id: venueId, review_id: reviewId, path });
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);   // don't leave an orphan behind
    throw new Error(error.message);
  }
}

/** Approved photos for a venue page (venue + review photos, newest first). */
export async function getVenuePhotos(venueId: string, limit = 12): Promise<Photo[]> {
  const { data, error } = await getSupabase().from('photos')
    .select('id, path, review_id').eq('venue_id', venueId).eq('moderation_status', 'approved').is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('[gossoko] getVenuePhotos failed:', error.message); return []; }
  return (data as { id: string; path: string; review_id: string | null }[]).map((p) => ({ id: p.id, url: photoUrl(p.path), review_id: p.review_id }));
}
