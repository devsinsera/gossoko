import { siteUrl } from '@/lib/env';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Share a venue through the phone's share sheet, or copy its link when there isn't one. */
export async function shareVenue(slug: string, name: string): Promise<ShareOutcome> {
  const url = `${siteUrl()}/venue/${slug}`;
  const text = `${name} on Gossoko — rated by tradies, for tradies.`;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title: name, text, url });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
