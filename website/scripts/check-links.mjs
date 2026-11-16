// Checks that every internal link and image in a built site points at a file that exists in it. Run by bin/build_website and CI.
// Usage: node scripts/check-links.mjs <dist folder>
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, posix } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    // MkDocs writes its 404 page with links relative to the address the docs are published at, which a build with no SITE_URL cannot know.
    else if (name.endsWith('.html') && !p.endsWith(join('docs', '404.html'))) pages.push(p);
  }
})(root);

const exists = (urlPath) => {
  const rel = decodeURIComponent(urlPath).replace(/^\//, '');
  const target = join(root, rel);
  if (existsSync(target) && statSync(target).isFile()) return true;
  return existsSync(join(target, 'index.html'));
};

let bad = 0;
const idsCache = new Map();
const idsOf = (file) => {
  if (!idsCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
};

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const here = '/' + posix.relative(root, page).replace(/index\.html$/, '').replace(/\\/g, '/');
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const raw = m[1];
    if (!raw || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/.test(raw)) continue;
    const [pathPart, hash] = raw.split('#');
    const url = pathPart === '' ? here : pathPart.startsWith('/') ? pathPart : posix.join(here.endsWith('/') ? here : posix.dirname(here) + '/', pathPart);
    if (!exists(url)) { console.error(`${here}: broken link ${raw}`); bad++; continue; }
    if (hash) {
      const rel = url.replace(/^\//, '');
      const file = existsSync(join(root, rel)) && statSync(join(root, rel)).isFile() ? join(root, rel) : join(root, rel, 'index.html');
      if (file.endsWith('.html') && !idsOf(file).has(hash)) { console.error(`${here}: no #${hash} on ${url}`); bad++; }
    }
  }
}
if (bad) { console.error(`${bad} broken link(s) in ${pages.length} pages.`); process.exit(1); }
console.log(`Checked the links in ${pages.length} pages: all good.`);
