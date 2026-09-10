import '@testing-library/jest-dom'
import { server } from './server'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'

// Polyfill missing DOM methods
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// Polyfill ResizeObserver (required by Radix UI Popover, etc.)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Polyfill canvas 2d context (required by qrcode library)
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  scale: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  fillText: vi.fn(),
  strokeText: vi.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock')

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
