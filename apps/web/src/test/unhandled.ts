/** Runs `action` and says whether anything was left as an unhandled rejection (a refused request nobody caught). */
export async function unhandledRejectionsDuring(action: () => Promise<void>): Promise<unknown[]> {
  const seen: unknown[] = []
  const listener = (reason: unknown) => seen.push(reason)
  process.on('unhandledRejection', listener)
  try {
    await action()
    await new Promise((resolve) => setTimeout(resolve, 50)) // rejections are reported a tick later
  } finally {
    process.off('unhandledRejection', listener)
  }
  return seen
}
