const MAX_SIDE = 1600
const QUALITY = 0.8

/**
 * A phone photo is several megabytes; a work order needs one a person can read. Shrinking it first
 * saves mobile data and space on the device while it waits for a connection. Anything that is not an
 * ordinary photo, or that cannot be shrunk here, goes through unchanged.
 */
export async function prepareUpload(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file) // applies the photo's rotation
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}
