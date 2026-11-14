// Serves a built Gossoko dist the way sinsera.co's public/.htaccess does — same rewrites and the SAME
// response headers (Content-Security-Policy etc. read from .htaccess), so CSP problems show up locally.
// Local sim only. The sim API is http://127.0.0.1:<port>, not *.supabase.co, so SIM_API is added to
// connect-src next to the Supabase entries (the only change to the policy).
//   DIST=dist PORT=56680 SIM_API=http://127.0.0.1:56621 node sim/serve-dist.mjs
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.env.DIST ?? new URL('../dist', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 56680);
const API = process.env.SIM_API ?? 'http://127.0.0.1:56621';
const HTACCESS = readFileSync(process.env.HTACCESS ?? new URL('../public/.htaccess', import.meta.url), 'utf8');

/** `Header always set Name "value"` lines from .htaccess. */
export function htaccessHeaders(text, api) {
  const out = {};
  for (const m of text.matchAll(/^\s*Header always set ([\w-]+) "([^"]*)"/gm)) out[m[1]] = m[2];
  const csp = out['Content-Security-Policy'];
  if (csp && api) out['Content-Security-Policy'] = csp.replace(/connect-src ([^;]*)/, (_, v) => `connect-src ${v} ${api} ${api.replace(/^http/, 'ws')}`);
  return out;
}
const HEADERS = htaccessHeaders(HTACCESS, API);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
async function file(p) { try { const s = await stat(p); if (s.isDirectory()) { await stat(join(p, 'index.html')); return join(p, 'index.html'); } return p; } catch { return null; } }

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (!u.pathname.startsWith('/gossoko/')) { res.writeHead(302, { location: '/gossoko/' }); return res.end(); }
  const rel = decodeURIComponent(u.pathname.slice('/gossoko/'.length));
  let f = await file(join(ROOT, rel));
  if (!f && /^about\/?$/.test(rel)) { res.writeHead(301, { location: '/gossoko/' }); return res.end(); }
  if (!f && rel.startsWith('admin/')) f = join(ROOT, 'admin/index.html');
  if (!f) { res.writeHead(302, { location: `/gossoko/admin/${rel}${u.search}` }); return res.end(); }
  const body = await readFile(f);
  res.writeHead(200, { ...HEADERS, 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(body);
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on :${PORT} with the .htaccess headers`));
