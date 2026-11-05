// Thin adapter so pages written against Next's <Link href> keep their markup.
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };

export const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, ...rest }, ref) {
  return <RouterLink ref={ref} to={href} {...rest} />;
});

/** Only same-origin relative paths are allowed as a post-login destination. */
export function safeNext(target: string | null | undefined): string {
  if (target && target.startsWith('/') && !target.startsWith('//')) return target;
  return '/';
}

/** Query-string values as a plain object (all optional strings). */
export function useQuery<K extends string>(...keys: K[]): Partial<Record<K, string>> {
  const [params] = useSearchParams();
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) {
    const v = params.get(k);
    if (v !== null) out[k] = v;
  }
  return out;
}
