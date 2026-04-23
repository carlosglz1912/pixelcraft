import { estimateImageTransformCost, type CostEstimate } from '@/lib/cost-estimate'

export interface ImageDimensions {
  width: number
  height: number
}

export function getImageDimensions(imageUrl: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Image dimensions are only available in the browser'))
      return
    }

    const image = new window.Image()

    image.onload = () => {
      const width = image.naturalWidth || image.width
      const height = image.naturalHeight || image.height

      if (!width || !height) {
        reject(new Error('Invalid image dimensions'))
        return
      }

      resolve({ width, height })
    }

    image.onerror = () => reject(new Error('Failed to load image dimensions'))
    image.src = imageUrl
  })
}

export async function estimateImageTransformCostFromUrl(config: {
  model: string
  imageUrl: string
}): Promise<CostEstimate | null> {
  const dimensions = await getImageDimensions(config.imageUrl)
  return estimateImageTransformCost({
    model: config.model,
    width: dimensions.width,
    height: dimensions.height,
  })
}
