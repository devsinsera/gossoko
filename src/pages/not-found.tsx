import { Link } from '@/lib/nav';
import { COLORS } from '@/lib/theme';

export default function NotFound() {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center' }}>
      <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 1 }}>NOT FOUND</h1>
      <p style={{ color: COLORS.textSecondary }}>That page isn't on the menu.</p>
      <Link href="/" style={{ color: COLORS.orange }}>Back to the feed</Link>
    </div>
  );
}
