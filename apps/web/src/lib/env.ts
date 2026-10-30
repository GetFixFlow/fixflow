export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  wsUrl: import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/cable',
  // The guides (the docs site of the released version). Built into the app, so a server with no internet still shows the link.
  docsUrl: import.meta.env.VITE_DOCS_URL ?? 'https://getfixflow.github.io/fixflow/latest/',
  appEnv: import.meta.env.VITE_APP_ENV ?? 'development',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}

// In production, warn if API URL is default
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.warn('[FixFlow] VITE_API_URL not set — using default localhost')
}
