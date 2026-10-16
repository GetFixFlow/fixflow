import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { apiErrorMessage } from '../apiError'

function failure(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig
  return new AxiosError('failed', String(status), config, null, { status, data, statusText: '', headers: {}, config })
}

describe('apiErrorMessage', () => {
  it("uses the server's own words when it gave some", () => {
    expect(apiErrorMessage(failure(422, { error: { message: 'This alert is resolved, so it cannot be acknowledged' } }), 'x'))
      .toBe('This alert is resolved, so it cannot be acknowledged')
  })

  it('says only managers can, for a 403, whatever the body says', () => {
    expect(apiErrorMessage(failure(403, { error: { message: 'You are not authorized to perform this action' } }), 'x'))
      .toBe('Only managers and administrators can do that.')
  })

  it('asks to wait, for a 429', () => {
    expect(apiErrorMessage(failure(429, {}), 'x')).toMatch(/wait a moment/i)
  })

  it.each([
    ['no message', failure(500, {})],
    ['a message that is not text', failure(500, { error: { message: { nested: true } } })],
    ['no body at all', failure(500, undefined)],
    ['a body that is not an object', failure(500, 'Internal Server Error')],
    ['no answer from the server', new AxiosError('Network Error')],
    ['something that is not an axios error', new Error('boom')],
    ['nothing', undefined],
  ])('falls back to the general message for %s', (_name, error) => {
    expect(apiErrorMessage(error, 'Could not do it.')).toBe('Could not do it.')
  })
})
