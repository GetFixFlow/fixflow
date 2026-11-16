import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL is the address the site is published at (https://example.org, no trailing slash). It is only used for the
// sitemap and the canonical links, so leave it unset for local work: those are then left out.
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  site,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: site ? [sitemap()] : [],
  devToolbar: { enabled: false },
});
