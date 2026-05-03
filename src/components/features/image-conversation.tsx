'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ImagePlus, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { editImage } from '@/lib/actions'
import { optimizeImageIfLarge } from '@/lib/image-optimize'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { useGallery } from '@/stores/gallery'
import type { CostTier, GeneratedMedia } from '@/types'

type Iteration = {
  id: string
  url: string
  prompt: string
  sourceId?: string
}

const DEFAULT_EDIT_MODEL = 'fal-ai/flux/dev/image-to-image'
const MAX_REFERENCE_IMAGES = 3

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

function normalizeModel(model?: string) {
  return model?.replace(/^fal-ai\//, '')
}

function getConversationEditModel(model?: string) {
  const normalizedModel = normalizeModel(model)

  if (!normalizedModel) return null
  if (normalizedModel === 'nano-banana-2' || normalizedModel === 'nano-banana-2/edit') {
    return 'fal-ai/nano-banana-2/edit'
  }
  if (normalizedModel === 'gpt-image-1.5' || normalizedModel === 'gpt-image-1.5/edit') {
    return 'fal-ai/gpt-image-1.5/edit'
  }
  if (normalizedModel === 'flux/dev/image-to-image' || normalizedModel.startsWith('flux/')) {
    return DEFAULT_EDIT_MODEL
  }

  return null
}

function resolveConversationEditModel(item: GeneratedMedia | undefined, items: GeneratedMedia[]) {
  const itemsById = new Map(items.map((entry) => [entry.id, entry]))
  const visited = new Set<string>()
  let currentItem = item

  while (currentItem && !visited.has(currentItem.id)) {
    visited.add(currentItem.id)

    const editModel = getConversationEditModel(currentItem.model)
    if (editModel) return editModel

    currentItem = currentItem.metadata?.sourceId
      ? itemsById.get(currentItem.metadata.sourceId)
      : undefined
  }

  return DEFAULT_EDIT_MODEL
}

function getEditCostTier(model: string): CostTier {
  const normalizedModel = normalizeModel(model)

  if (normalizedModel === 'nano-banana-2' || normalizedModel === 'nano-banana-2/edit') return 'high'
  if (normalizedModel === 'gpt-image-1.5' || normalizedModel === 'gpt-image-1.5/edit') return 'premium'

  return 'medium'
}

function supportsStrength(model: string) {
  return normalizeModel(model) === 'flux/dev/image-to-image'
}

function supportsConversationReferences(model: string) {
  return normalizeModel(model) === 'nano-banana-2/edit'
}

function getConversationModelLabel(model: string) {
  const normalizedModel = normalizeModel(model)

  if (normalizedModel === 'nano-banana-2/edit') return 'Nano Banana 2 Edit'
  if (normalizedModel === 'nano-banana-2') return 'Nano Banana 2'
  if (normalizedModel === 'gpt-image-1.5/edit') return 'GPT Image 1.5 Edit'
  if (normalizedModel === 'gpt-image-1.5') return 'GPT Image 1.5'

  return 'Flux I2I'
}

export function ImageConversation({ initialImageUrl }: { initialImageUrl: string }) {
  const [prompt, setPrompt] = useState('')
  const [strength, setStrength] = useState(92)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const items = useGallery((state) => state.items)
  const [history, setHistory] = useState<Iteration[]>([
    {
      id: 'initial',
      url: initialImageUrl,
      prompt: 'Original',
    },
  ])
  const [currentIterationId, setCurrentIterationId] = useState('initial')

  const addToGallery = useGallery((state) => state.addWithPersistence)
  const initialGalleryItem = items.find((item) => item.url === initialImageUrl)
  const currentIteration =
    history.find((item) => item.id === currentIterationId) ?? history[0]
  const currentImageUrl = currentIteration?.url ?? initialImageUrl
  const currentSourceItem = currentIteration?.sourceId
    ? items.find((item) => item.id === currentIteration.sourceId)
    : initialGalleryItem
  const editModel = resolveConversationEditModel(currentSourceItem, items)
  const canAdjustStrength = supportsStrength(editModel)
  const canUseReferences = supportsConversationReferences(editModel)
  const editCostTier = getEditCostTier(editModel)

  useEffect(() => {
    if (!initialGalleryItem?.id) return

    setHistory((current) =>
      current.map((item) =>
        item.id === 'initial' && !item.sourceId
          ? { ...item, sourceId: initialGalleryItem.id }
          : item
      )
    )
  }, [initialGalleryItem?.id])

  async function handleReferenceFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remainingSlots = Math.max(0, MAX_REFERENCE_IMAGES - referenceImages.length)
    if (remainingSlots === 0) {
      toast.error(`Puedes agregar hasta ${MAX_REFERENCE_IMAGES} referencias`)
      e.target.value = ''
      return
    }

    try {
      const nextImages = await Promise.all(
        files.slice(0, remainingSlots).map(async (file) => optimizeImageIfLarge(await fileToDataUrl(file), 800))
      )

      setReferenceImages((current) => [...current, ...nextImages].slice(0, MAX_REFERENCE_IMAGES))
    } catch (error) {
      toast.error('No se pudieron cargar las referencias')
      console.error(error)
    } finally {
      e.target.value = ''
    }
  }

  async function handleSubmit() {
    if (!prompt.trim()) {
      toast.error('Ingresa un prompt de edición')
      return
    }

    setLoading(true)

    try {
      const data = await editImage({
        imageUrl: currentImageUrl,
        prompt,
        strength: canAdjustStrength ? strength / 100 : undefined,
        model: editModel,
        referenceImageUrls: canUseReferences ? referenceImages : undefined,
      })

      const nextUrl = data.images?.[0]?.url || data.image?.url

      if (!nextUrl) {
        toast.error('No se recibió imagen')
        return
      }

      const nextIterationId = crypto.randomUUID()

      setCurrentIterationId(nextIterationId)
      setHistory((current) => [
        {
          id: nextIterationId,
          url: nextUrl,
          prompt,
          sourceId: undefined,
        },
        ...current,
      ])

      const nextSourceId = await addToGallery({
        type: 'image',
        url: nextUrl,
        prompt,
        model: editModel,
        costTier: editCostTier,
        metadata: {
          sourceId: currentIteration?.sourceId ?? initialGalleryItem?.id,
          source: currentImageUrl,
          referenceCount: canUseReferences ? referenceImages.length : undefined,
          strength: canAdjustStrength ? strength / 100 : undefined,
          costTier: editCostTier,
        },
      })
      setHistory((current) =>
        current.map((item) =>
          item.id === nextIterationId
            ? { ...item, sourceId: nextSourceId }
            : item
        )
      )

      setPrompt('')
      toast.success('Nueva iteración creada')
    } catch (error) {
      toast.error('Error al generar la iteración')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-[minmax(0,1fr)_300px] min-[1600px]:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-h-screen flex-col border-r border-secondary/20 bg-slate-950/88">
        <div className="surface-secondary flex items-center justify-between border-b border-secondary/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
            >
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Studio
              </Link>
            </Button>
            <Badge variant="secondary" className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint">
              Conversation
            </Badge>
            <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
              {getConversationModelLabel(editModel)}
            </Badge>
          </div>
          <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
            {history.length} versiones
          </Badge>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="depth-mixed w-full max-w-5xl overflow-hidden rounded-[2rem] border border-secondary/20 bg-black">
            <Image
              src={currentImageUrl}
              alt="Current iteration"
              width={1800}
              height={1800}
              className="max-h-[calc(100vh-14rem)] h-auto w-full object-contain"
              unoptimized
            />
          </div>
        </div>

        <div className="surface-primary border-t border-primary/20 px-6 py-5">
          <div className="depth-secondary rounded-[1.8rem] border border-secondary/20 bg-slate-950/82 p-4">
            <div className="mb-3 flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                Prompt
              </Label>
              {canAdjustStrength ? (
                <span className="text-sm text-primary-tint">{strength}%</span>
              ) : (
                <span className="text-xs uppercase tracking-[0.18em] text-secondary-tint">
                  Strength no aplica
                </span>
              )}
            </div>

            {canUseReferences ? (
              <div className="mb-4 rounded-[1.4rem] border border-secondary/20 bg-slate-900/70 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                    Referencias
                  </Label>
                  <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
                    {referenceImages.length}/{MAX_REFERENCE_IMAGES}
                  </Badge>
                </div>

                <label className="depth-secondary flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-secondary/25 bg-slate-950/75 px-4 py-3 text-sm text-slate-300">
                  <ImagePlus className="h-4 w-4 text-secondary-tint" />
                  Agregar referencias
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleReferenceFileChange}
                  />
                </label>

                {referenceImages.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {referenceImages.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className="depth-mixed relative overflow-hidden rounded-2xl border border-secondary/20 bg-slate-950/80"
                      >
                        <div className="relative aspect-square">
                          <Image
                            src={url}
                            alt={`Reference ${index + 1}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setReferenceImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
                          }
                          className="depth-primary absolute right-2 top-2 rounded-full border border-primary/20 bg-primary/15 p-1 text-primary-tint"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4">
              <div className="space-y-3">
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                   placeholder="Describe la siguiente edición..."
                  className="h-12 rounded-2xl border border-secondary/20 bg-slate-900/80 text-white"
                />
                {canAdjustStrength ? (
                  <Slider
                    value={[strength]}
                    onValueChange={([value]) => setStrength(value)}
                    min={50}
                    max={100}
                    step={1}
                  />
                ) : null}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading || !prompt.trim()}
                className="depth-primary h-full rounded-2xl border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? (
                  <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                 Iterar
               </Button>
             </div>
           </div>
         </div>
       </section>

       <aside className="depth-secondary min-h-screen bg-slate-950/96">
         <div className="surface-secondary border-b border-secondary/20 px-4 py-4">
           <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary-tint">
             Historial
           </p>
        </div>

        <ScrollArea className="h-[calc(100vh-4.5rem)]">
          <div className="space-y-3 p-4">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIterationId(item.id)}
                className={`w-full overflow-hidden rounded-[1.4rem] border text-left transition ${
                  currentIterationId === item.id
                    ? 'depth-primary border-primary/30 bg-primary/10'
                    : 'depth-secondary border-secondary/15 bg-slate-900/70'
                }`}
              >
                <div className="relative aspect-square">
                  <Image
                    src={item.url}
                    alt={item.prompt}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="px-3 py-3">
                  <p className="line-clamp-2 text-sm font-medium text-white">{item.prompt}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>
    </main>
  )
}
