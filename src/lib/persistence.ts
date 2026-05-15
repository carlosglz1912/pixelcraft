'use server'

import { createHash } from 'node:crypto'

import { getVideoEndpoint, type VideoGenerationMode, type MediaType, type CostTier } from '@/types'

interface PersistMediaOptions {
  url: string
  type: MediaType
  prompt: string
  model: string
  costTier?: CostTier
  estimatedCost?: number
  userId?: string
  metadata?: {
    seed?: number
    duration?: number
    aspectRatio?: string
    resolution?: string
    negativePrompt?: string
  }
}

export interface PersistedMediaResult {
  id: string
  storageId?: string
  url: string
  persisted: boolean
}

async function readJsonResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Unexpected non-JSON response (${response.status}): ${text.slice(0, 160)}`)
  }
}

interface PreparePersistUploadResult {
  uploadUrl: string
  uploadToken: string
  storageId: string | null
  storageProvider: 'convex' | 'r2'
}

interface StreamedFileMetadata {
  size: number
  sha256: string
  contentType: string | null
}

interface PersistRequestPayload {
  url: string
  fileName: string
  provider: 'convex' | 'r2'
  type: MediaType
  userId?: string
  metadata: {
    modelId: string
    prompt: string
    costTier?: CostTier
    estimatedCost?: number
    seed?: number
    duration?: number
    aspectRatio?: string
    resolution?: string
    negativePrompt?: string
  }
}

async function hashReadableStream(
  stream: ReadableStream<Uint8Array>,
  contentType: string | null,
): Promise<StreamedFileMetadata> {
  const reader = stream.getReader()
  const hash = createHash('sha256')
  let size = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      if (value) {
        size += value.byteLength
        hash.update(value)
      }
    }
  } finally {
    reader.releaseLock()
  }

  return {
    size,
    sha256: hash.digest('base64'),
    contentType,
  }
}

function buildPersistPayload(options: PersistMediaOptions, fileName: string): PersistRequestPayload {
  return {
    url: options.url,
    fileName,
    provider: 'r2',
    type: options.type,
    userId: options.userId,
    metadata: {
      modelId: options.model,
      prompt: options.prompt,
      costTier: options.costTier,
      estimatedCost: options.estimatedCost,
      seed: options.metadata?.seed,
      duration: options.metadata?.duration,
      aspectRatio: options.metadata?.aspectRatio,
      resolution: options.metadata?.resolution,
      negativePrompt: options.metadata?.negativePrompt,
    },
  }
}

async function runLegacyPersist(
  convexSiteUrl: string,
  payload: PersistRequestPayload,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${convexSiteUrl}/files/persistFromUrl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Persist failed: ${response.status} ${errorText.slice(0, 160)}`)
  }

  return readJsonResponse(response)
}

export async function persistMedia(options: PersistMediaOptions): Promise<PersistedMediaResult> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const r2PublicUrl = process.env.R2_PUBLIC_URL
  
  if (!convexUrl) {
    console.warn('[persistence] NEXT_PUBLIC_CONVEX_URL not configured')
    return {
      id: crypto.randomUUID(),
      url: options.url,
      persisted: false,
    }
  }

  if (!r2PublicUrl) {
    console.warn('[persistence] R2_PUBLIC_URL not configured in .env.local')
  }

  try {
    const ext = options.type === 'video' ? 'mp4' : 'png'
    const timestamp = Date.now()
    const fileName = `${options.model.replace(/\//g, '-')}_${timestamp}.${ext}`
    const persistPayload = buildPersistPayload(options, fileName)
    
    const convexSiteUrl = convexUrl.replace('.cloud', '.site')
    const sourceResponse = await fetch(options.url)

    if (!sourceResponse.ok) {
      const errorText = await sourceResponse.text()
      throw new Error(`Source fetch failed: ${sourceResponse.status} ${errorText.slice(0, 160)}`)
    }

    if (!sourceResponse.body) {
      throw new Error('Source fetch failed: missing response body')
    }

    const prepareResponse = await fetch(`${convexSiteUrl}/files/preparePersistUpload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'r2',
      }),
    })

    if (!prepareResponse.ok) {
      if (prepareResponse.status === 404) {
        console.warn('[persistence] Convex preparePersistUpload route not found, falling back to legacy persistFromUrl. Run `bunx convex dev` to enable streaming persistence.')
        const legacyResult = await runLegacyPersist(convexSiteUrl, persistPayload)

        if (!legacyResult.storageId || typeof legacyResult.storageId !== 'string') {
          console.warn('No storageId in legacy persist response:', Object.keys(legacyResult))
          return {
            id: crypto.randomUUID(),
            url: options.url,
            persisted: false,
          }
        }

        const publicUrl = process.env.R2_PUBLIC_URL
        const finalUrl = publicUrl ? `${publicUrl}/${legacyResult.storageId}` : options.url

        return {
          id: typeof legacyResult.mediaId === 'string' ? legacyResult.mediaId : crypto.randomUUID(),
          storageId: legacyResult.storageId,
          url: finalUrl,
          persisted: true,
        }
      }

      const errorText = await prepareResponse.text()
      throw new Error(`Prepare failed: ${prepareResponse.status} ${errorText.slice(0, 160)}`)
    }

    const prepareResult = (await readJsonResponse(prepareResponse)) as unknown as PreparePersistUploadResult

    if (!prepareResult.uploadUrl || !prepareResult.uploadToken || !prepareResult.storageId) {
      throw new Error('Prepare failed: missing upload data')
    }

    const contentType = sourceResponse.headers.get('content-type') ?? null
    const contentLengthHeader = sourceResponse.headers.get('content-length')
    const hasContentEncoding = sourceResponse.headers.has('content-encoding')
    const sourceSize = !hasContentEncoding && contentLengthHeader
      ? Number.parseInt(contentLengthHeader, 10)
      : undefined

    const [uploadStream, hashStream] = sourceResponse.body.tee()

    const uploadHeaders = new Headers({
      'Content-Type': contentType ?? 'application/octet-stream',
    })

    if (typeof sourceSize === 'number' && Number.isFinite(sourceSize) && sourceSize >= 0) {
      uploadHeaders.set('Content-Length', String(sourceSize))
    }

    const uploadRequest: RequestInit & { duplex: 'half' } = {
      method: prepareResult.storageProvider === 'r2' ? 'PUT' : 'POST',
      body: uploadStream,
      headers: uploadHeaders,
      duplex: 'half',
    }

    const uploadPromise = fetch(prepareResult.uploadUrl, uploadRequest)

    const metadataPromise = hashReadableStream(hashStream, contentType)
    const [uploadResponse, fileMetadata] = await Promise.all([uploadPromise, metadataPromise])

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText.slice(0, 160)}`)
    }

    const finalizeResponse = await fetch(`${convexSiteUrl}/files/finalizePersistUpload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadToken: prepareResult.uploadToken,
        storageId: prepareResult.storageId,
        fileName,
        provider: prepareResult.storageProvider,
        type: options.type,
        originalUrl: options.url,
        contentType,
        size: fileMetadata.size,
        fileMetadata,
        metadata: persistPayload.metadata,
        userId: options.userId,
      }),
    })

    if (!finalizeResponse.ok) {
      const errorText = await finalizeResponse.text()
      throw new Error(`Persist failed: ${finalizeResponse.status} ${errorText.slice(0, 160)}`)
    }

    const result = await readJsonResponse(finalizeResponse)
    
    if (!result.storageId || typeof result.storageId !== 'string') {
      console.warn('No storageId in persist response:', Object.keys(result))
      return {
        id: crypto.randomUUID(),
        url: options.url,
        persisted: false,
      }
    }

    const publicUrl = process.env.R2_PUBLIC_URL
    const finalUrl = publicUrl ? `${publicUrl}/${result.storageId}` : options.url

    return {
      id: typeof result.mediaId === 'string' ? result.mediaId : crypto.randomUUID(),
      storageId: result.storageId,
      url: finalUrl,
      persisted: true,
    }
  } catch (error) {
    console.error('Failed to persist media:', error)
    return {
      id: crypto.randomUUID(),
      url: options.url,
      persisted: false,
    }
  }
}

export async function listPersistedMedia(limit = 50, userId?: string) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  
  if (!convexUrl) {
    return []
  }

  try {
    const convexSiteUrl = convexUrl.replace('.cloud', '.site')
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    if (userId) params.set('userId', userId)
    const response = await fetch(`${convexSiteUrl}/api/media/list?${params}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[persistence] /api/media/list route not found. Run `bunx convex dev` to deploy.')
        return []
      }
      throw new Error(`Failed to list media: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error('Failed to list persisted media:', error)
    return []
  }
}

