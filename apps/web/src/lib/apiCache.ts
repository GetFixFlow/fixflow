/** The service worker keeps recent API answers so a visited page opens offline. Forget them when someone signs out. */
export const API_CACHE = 'api-cache'

export function clearApiCache() {
  if (typeof caches === 'undefined') return
  caches.delete(API_CACHE).catch(() => undefined)
}
