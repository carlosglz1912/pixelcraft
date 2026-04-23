import { type NextRequest } from 'next/server'

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'pixelcraft.bin'
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get('url')
  const requestedFileName = request.nextUrl.searchParams.get('filename')

  if (!targetUrl) {
    return Response.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(targetUrl)
  } catch {
    return Response.json({ error: 'Invalid url parameter' }, { status: 400 })
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return Response.json({ error: 'Unsupported protocol' }, { status: 400 })
  }

  let upstream: Response

  try {
    upstream = await fetch(parsedUrl.toString(), { cache: 'no-store' })
  } catch {
    return Response.json({ error: 'Failed to fetch remote file' }, { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: 'Remote file unavailable' }, { status: 502 })
  }

  const headers = new Headers()
  const contentType = upstream.headers.get('content-type')
  const contentLength = upstream.headers.get('content-length')

  if (contentType) {
    headers.set('content-type', contentType)
  }

  if (contentLength) {
    headers.set('content-length', contentLength)
  }

  headers.set('content-disposition', `attachment; filename="${sanitizeFileName(requestedFileName ?? 'pixelcraft.bin')}"`)
  headers.set('cache-control', 'no-store')
  headers.set('x-content-type-options', 'nosniff')

  return new Response(upstream.body, {
    status: 200,
    headers,
  })
}
