import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { fileStore } from '../fileStore'

const read = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(blob)
  })

describe('fileStore', () => {
  it('keeps a file by key and gives it back with its contents and type', async () => {
    await fileStore.put('photo-1', new Blob(['pixels'], { type: 'image/jpeg' }))

    const blob = await fileStore.get('photo-1')

    expect(blob?.type).toBe('image/jpeg')
    expect(await read(blob!)).toBe('pixels')
  })

  it('gives nothing for a key it does not have', async () => {
    expect(await fileStore.get('nope')).toBeUndefined()
  })

  it('forgets a file when told to', async () => {
    await fileStore.put('photo-2', new Blob(['x']))
    await fileStore.delete('photo-2')

    expect(await fileStore.get('photo-2')).toBeUndefined()
  })
})
