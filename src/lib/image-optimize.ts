'use client'

interface ImageOptimizeOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'image/webp' | 'image/jpeg' | 'image/png'
}

const DEFAULT_OPTIONS: ImageOptimizeOptions = {
  maxWidth: 2560,
  maxHeight: 2560,
  quality: 0.95,
  format: 'image/webp',
}

export async function optimizeImage(
  dataUrl: string,
  options: ImageOptimizeOptions = {}
): Promise<string> {
  const { maxWidth, maxHeight, quality, format } = { ...DEFAULT_OPTIONS, ...options }

  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      let { width, height } = img

      // Solo redimensionar si excede el máximo
      if (width > maxWidth! || height > maxHeight!) {
        const ratio = Math.min(maxWidth! / width, maxHeight! / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Mejor calidad de renderizado
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      ctx.drawImage(img, 0, 0, width, height)

      const optimizedDataUrl = canvas.toDataURL(format, quality)
      
      console.info('[image.optimize]', {
        originalSize: `${Math.round(dataUrl.length / 1024)}KB`,
        optimizedSize: `${Math.round(optimizedDataUrl.length / 1024)}KB`,
        reduction: `${Math.round((1 - optimizedDataUrl.length / dataUrl.length) * 100)}%`,
        dimensions: `${img.width}x${img.height} → ${width}x${height}`,
        format,
        quality,
      })

      resolve(optimizedDataUrl)
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

export function getImageFormat(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:image\/([^;]+)/)
  return match ? match[1] : null
}

export function hasTransparency(dataUrl: string): boolean {
  return dataUrl.includes('image/png')
}

export function isImageOptimizable(dataUrl: string): boolean {
  if (!dataUrl.startsWith('data:image/')) return false
  const format = getImageFormat(dataUrl)
  return format !== null && ['png', 'jpeg', 'jpg', 'webp', 'gif'].includes(format)
}

export async function optimizeImageIfLarge(
  dataUrl: string,
  maxSizeKB: number = 1000
): Promise<string> {
  if (!isImageOptimizable(dataUrl)) {
    return dataUrl
  }

  const sizeKB = dataUrl.length / 1024
  
  // No optimizar si ya está por debajo del límite
  if (sizeKB <= maxSizeKB) {
    console.info('[image.skip]', { 
      sizeKB: Math.round(sizeKB), 
      maxSizeKB,
      reason: 'already_optimal'
    })
    return dataUrl
  }

  // Preservar PNG si tiene transparencia
  const shouldPreservePng = hasTransparency(dataUrl)
  
  return optimizeImage(dataUrl, {
    maxWidth: 2560,
    maxHeight: 2560,
    quality: 0.95, // 95% calidad - prácticamente sin pérdida
    format: shouldPreservePng ? 'image/png' : 'image/webp',
  })
}
