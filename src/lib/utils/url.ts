export function isFalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('fal.media') || parsed.hostname.endsWith('fal.ai')
  } catch {
    return false
  }
}
