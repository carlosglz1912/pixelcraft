const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

function sanitizeFileStem(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'pixelcraft'
}

function getExtension(url: string, contentType: string) {
  const normalizedType = contentType.split(';')[0]?.trim().toLowerCase()

  if (normalizedType && CONTENT_TYPE_EXTENSIONS[normalizedType]) {
    return CONTENT_TYPE_EXTENSIONS[normalizedType]
  }

  try {
    const pathname = new URL(url, window.location.href).pathname
    const candidate = pathname.split('.').pop()?.toLowerCase()

    if (candidate && candidate.length <= 5) {
      return candidate
    }
  } catch {
    return 'bin'
  }

  return 'bin'
}

function triggerDownload(href: string, downloadName?: string) {
  const link = document.createElement('a')

  link.href = href
  if (downloadName) {
    link.download = downloadName
  }

  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function getDownloadFileName(url: string, fileStem: string, contentType = '') {
  return `${sanitizeFileStem(fileStem)}.${getExtension(url, contentType)}`
}

export function createDownloadStem({
  type,
  prompt,
  model,
  fallback,
  index,
}: {
  type: 'image' | 'video'
  prompt?: string
  model?: string
  fallback: string
  index?: number
}) {
  const normalizedPrompt = prompt?.trim()
  const normalizedModel = model?.replace(/^fal-ai\//, '').trim()

  const parts = [
    type,
    normalizedPrompt ? normalizedPrompt.slice(0, 36) : '',
    normalizedModel ? normalizedModel.slice(0, 18) : '',
    typeof index === 'number' ? String(index + 1) : '',
  ].filter(Boolean)

  return parts.join('-') || fallback
}

export function downloadRemoteFile(url: string, fileStem: string) {
  const downloadName = getDownloadFileName(url, fileStem)

  if (url.startsWith('data:') || url.startsWith('blob:')) {
    triggerDownload(url, downloadName)
    return
  }

  const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(downloadName)}`
  triggerDownload(proxyUrl, downloadName)
}
