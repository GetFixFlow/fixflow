import { createConsumer } from '@rails/actioncable'

// The server only lets a signed-in person connect, and a browser cannot send a header on a WebSocket, so the
// sign-in token goes in the address. It is read each time the connection is made, so signing in again is picked up.
export function cableUrl(): string {
  let token: string | null = null
  try {
    token = localStorage.getItem('auth_token')
  } catch {
    // Storage is not available: connect without one, and the server refuses.
  }
  return token ? `/cable?token=${encodeURIComponent(token)}` : '/cable'
}

// The library takes a function (and calls it for every connection); its typings only say string.
export const cable = createConsumer(cableUrl as unknown as string)
