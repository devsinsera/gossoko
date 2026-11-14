// Settings for the web-only sales pages (about/, business/). Read at build time by the
// `gossoko-native-guard` plugin in vite.config.ts, which fills __CONTACT_HREF__, __CONTACT_CTA__ and __CONTACT_LABEL__.

/**
 * TODO(Peta): the address venue owners write to. No working Gossoko or Sinsera inbox is in this repo
 * (the old plan's hello@gossoko.app is on a domain that doesn't exist). While this is null, the
 * pages' "Get in touch" buttons send owners to claim their venue and use "Ask for Pro" in the
 * dashboard, which lands in admin → Business.
 */
export const CONTACT_EMAIL: string | null = null;

/** The contact button on the sales pages: `cta` is the button, `label` the line under it. */
export function contactLink(base: string): { href: string; cta: string; label: string } {
  if (CONTACT_EMAIL) {
    return { href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Gossoko for my venue')}`, cta: 'Email us', label: CONTACT_EMAIL };
  }
  return {
    href: `${base}search`,
    cta: 'Find your venue',
    label: 'Claim it, then tap Ask for Pro in your dashboard and leave a note. It comes straight to us.',
  };
}

/**
 * Who runs Gossoko, as the privacy policy and terms say it. Found in the vault (Plan.md / Apple
 * Developer notes): SINSERA PTY LTD, ABN 64 693 039 379, ACN 693 039 379, Greenbank QLD.
 * Filled in the legal pages at build time by the `gossoko-native-guard` plugin (vite.config.ts).
 */
export const LEGAL_ENTITY = 'Sinsera Pty Ltd';
export const ABN = '64 693 039 379';

/**
 * Where privacy requests, complaints and legal notices go. support@sinsera.co is the address the live
 * Sona/Cipher privacy page already publishes, but the vault says the mailbox was NOT created yet
 * (14 Nov). Set MAILBOX_CONFIRMED to true once Peta has made it and sent a test. The release check
 * (tests/unit/legalRelease.test.ts, `npm run release-check`) fails while it is false.
 */
export const PRIVACY_EMAIL = 'support@sinsera.co';
export const MAILBOX_CONFIRMED = false;

/**
 * Postal address for privacy complaints. null = the policy says "write to us by email". The only
 * address found (46 Sprout St, Greenbank QLD) is on the D&B record and looks like a home address, so it
 * is NOT published; Peta decides (a PO box or registered office is better).
 */
export const POSTAL: string | null = null;

/** The date at the top of the privacy policy and terms. Change it whenever their wording changes. */
export const LEGAL_UPDATED = '14 November 2026';

/** Everything the legal pages need, as the tokens the build fills in. */
export function legalTokens(): Record<string, string> {
  return {
    __LEGAL_ENTITY__: LEGAL_ENTITY,
    __ABN__: ABN,
    __PRIVACY_EMAIL__: PRIVACY_EMAIL,
    __LEGAL_UPDATED__: LEGAL_UPDATED,
    __POSTAL_LINE__: POSTAL
      ? `Post: ${POSTAL}.`
      : 'We don&rsquo;t publish a street address; email is the quickest way to reach us.',
  };
}
