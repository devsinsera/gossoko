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
