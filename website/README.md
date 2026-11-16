# The FixFlow website

The public site: the home page, features, install, open source and support pages, and (as they are built) the API reference, help articles and blog. It is an [Astro](https://astro.build) project that builds to **plain static files**, so it can be put on any static host: GitHub Pages, Netlify, Cloudflare Pages, or a folder served by nginx. It sets no cookies and makes no requests to other sites (the font is served from the site itself).

The product documentation stays where it is: Markdown in [`../docs/`](../docs), built by MkDocs, and published per release by the release workflow. The website links to it, and the build below also puts a copy under `/docs/` so one folder holds everything.

## Work on it

```bash
cd website
npm ci
npm run dev        # http://localhost:4321, reloads as you edit
npm run check      # type-check the pages
```

`/docs/` links go nowhere under `npm run dev` (the docs are not built by it). To see the whole thing, build both and preview:

```bash
pip install -r ../deploy/docs/requirements.txt    # once
../bin/build_website
npx astro preview
```

## Build it for publishing

```bash
SITE_URL=https://example.org bin/build_website    # from the repository root
```

The result is `website/dist/`: upload or serve that folder. `SITE_URL` (no trailing slash) is the address the site will have; it gives every page a canonical link, writes a sitemap, and points `robots.txt` at it. The script also builds the docs strictly into `dist/docs/` (a broken docs link fails it) and then checks that **every internal link and `#anchor` in all pages resolves**.

| Setting | What it does | Default |
| --- | --- | --- |
| `SITE_URL` | The public address; canonical links, sitemap, `robots.txt` | not set: those are left out |
| `PUBLIC_DOCS_URL` | Where the website's "Docs" links go | `/docs/` |
| `PUBLIC_SUPPORT_EMAIL` | The address shown on the support page for paid support | not set: the page says none is published yet |

`public/_headers` holds security headers and cache rules in the format Netlify and Cloudflare Pages read; on another host, copy them into its settings. The site has no Content-Security-Policy yet because the docs (MkDocs Material) use inline scripts.

## Where things are

| | |
| --- | --- |
| `src/pages/` | One file per page |
| `src/layouts/Base.astro` | The page frame: head, header, footer, the copy buttons |
| `src/components/` | Header, footer, icons, code block |
| `src/data/site.ts` | Navigation and the addresses shared by the pages |
| `src/styles/global.css` | All the styling: colour tokens (light and dark), type, layout |
| `public/` | Logo mark and icons (cut from `docs/logo.png`), `robots.txt`, `_headers` |
| `scripts/check-links.mjs` | The link check run by the build and CI |

The docs are styled to match by `../docs/stylesheets/extra.css`.

## Writing rules

- A claim on a page must be something the docs or the code back up, and each feature line links to the docs page that explains it.
- Text colours must keep 4.5:1 against their background in both themes. After a visual change, run an accessibility checker (axe) over every page in light and dark, at desktop and phone width; the pages were clean when this was written.
- No screenshots yet: the product has none to show (the docs say so too). Add them to `public/` when there are real ones.

## Dependencies: a known advisory

`npm audit` reports advisories against Astro 6.4.8 (and the `sharp` and `esbuild` it uses). The fix is Astro 7, which needs **Node 22.23.4 or newer**; this was built on Node 22.22.3, where Astro 7 refuses to start, so it stays on 6.x for now. What the advisories describe (XSS through spread attributes, view transitions and MDX, image optimisation, the Node adapter, the Windows dev server) is not used here: the site is plain static pages with no MDX, no image service and no adapter, and it is built from files in this repository, not from anything a visitor sends. Move to Astro 7 when your Node is new enough (`npm install --save-exact astro@7`, then run the build and the checks above); CI already uses the newest Node 22.
