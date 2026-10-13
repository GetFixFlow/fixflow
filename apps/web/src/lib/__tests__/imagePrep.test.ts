import { describe, it, expect, vi, afterEach } from 'vitest'
import { prepareUpload } from '../imagePrep'

const photo = (size: number, name = 'IMG_0042.HEIC', type = 'image/heic') => new File([new Uint8Array(size)], name, { type })

function fakeBrowser({ width = 4000, height = 3000, encodedSize = 300_000 } = {}) {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close: vi.fn() }))
  const drawImage = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb) {
    cb(new Blob([new Uint8Array(encodedSize)], { type: 'image/jpeg' }))
  })
  return { drawImage }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('prepareUpload', () => {
  it('shrinks a big photo to a JPEG no larger than 1600 on a side', async () => {
    const { drawImage } = fakeBrowser({ width: 4000, height: 3000 })

    const result = await prepareUpload(photo(5_000_000))

    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('IMG_0042.jpg')
    expect(result.size).toBe(300_000)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200)
  })

  it('does not enlarge a small photo', async () => {
    const { drawImage } = fakeBrowser({ width: 800, height: 600, encodedSize: 20_000 })

    await prepareUpload(photo(50_000, 'small.png', 'image/png'))

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600)
  })

  it('keeps the original when shrinking would not make it smaller', async () => {
    fakeBrowser({ encodedSize: 900_000 })
    const original = photo(400_000, 'tiny.png', 'image/png')

    expect(await prepareUpload(original)).toBe(original)
  })

  it('leaves documents and other files alone', async () => {
    fakeBrowser()
    const pdf = new File(['%PDF'], 'manual.pdf', { type: 'application/pdf' })

    expect(await prepareUpload(pdf)).toBe(pdf)
  })

  it('uses the original when the browser cannot read the image', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')))
    const original = photo(2_000_000)

    expect(await prepareUpload(original)).toBe(original)
  })
})
