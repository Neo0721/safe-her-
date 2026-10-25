import fs from 'fs'
import path from 'path'

function mediaDir() {
  const dir = process.env.SAFEHER_MEDIA_DIR
    ? path.resolve(process.env.SAFEHER_MEDIA_DIR)
    : path.join(process.cwd(), 'data', 'media')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Absolute path of a stored file. `fileName` is always a server-generated UUID plus a fixed
 * extension from the allow-list, never client input, so the dynamic path is safe; the annotation
 * stops the bundler from tracing the whole project because of it.
 */
export function mediaFile(fileName: string) {
  return path.join(/* turbopackIgnore: true */ mediaDir(), fileName)
}
