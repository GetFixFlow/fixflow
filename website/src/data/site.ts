// Everything the header, the footer and the pages share. Addresses that depend on where the site is hosted come from
// PUBLIC_* settings at build time (see website/README.md); the rest is fixed.
export const repo = 'https://github.com/GetFixFlow/fixflow';
export const repoRaw = 'https://raw.githubusercontent.com/GetFixFlow/fixflow/main';

/** The product docs (MkDocs). On the published site they sit under /docs/ on the same address. */
export const docs = (import.meta.env.PUBLIC_DOCS_URL || '/docs/').replace(/\/?$/, '/');
export const doc = (page: string) => `${docs}${page}/`;

/** The address people write to about paid support. Not set until the project has published one. */
export const supportEmail: string = import.meta.env.PUBLIC_SUPPORT_EMAIL || '';

export const links = {
  discussions: `${repo}/discussions`,
  discussionsQA: `${repo}/discussions/categories/q-a`,
  discussionsIdeas: `${repo}/discussions/categories/ideas`,
  discussionsShow: `${repo}/discussions/categories/show-and-tell`,
  issues: `${repo}/issues/new/choose`,
  releases: `${repo}/releases`,
  license: `${repo}/blob/main/LICENSE`,
  contributing: `${repo}/blob/main/CONTRIBUTING.md`,
  conduct: `${repo}/blob/main/CODE_OF_CONDUCT.md`,
  security: `${repo}/blob/main/SECURITY.md`,
  goodFirstIssue: `${repo}/labels/good%20first%20issue`,
  helpWanted: `${repo}/labels/help%20wanted`,
};

/** The main navigation. Pages are added here as they are built. */
export const nav = [
  { href: '/features/', label: 'Features' },
  { href: '/install/', label: 'Install' },
  { href: '/open-source/', label: 'Open source' },
  { href: '/support/', label: 'Support' },
];
