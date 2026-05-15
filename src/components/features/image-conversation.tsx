"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ImageIcon, ImagePlus, Sparkles, ZoomIn, X } from "lucide-react";
import { toast } from "sonner";
import { editImage } from "@/lib/actions";
import { optimizeImageIfLarge } from "@/lib/image-optimize";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GalleryPicker } from "@/components/gallery-picker";
import { useGallery } from "@/stores/gallery";
import type { CostTier, GeneratedMedia } from "@/types";

type Iteration = {
  id: string;
  url: string;
  prompt: string;
  sourceId?: string;
};

interface EditModelConfig {
  label: string;
  family: string;
  costTier: CostTier;
  supportsStrength: boolean;
  supportsReferences: boolean;
}

const CONVERSATION_EDIT_MODELS: Record<string, EditModelConfig> = {
  "fal-ai/flux/dev/image-to-image": {
    label: "Flux Dev I2I",
    family: "Flux",
    costTier: "medium",
    supportsStrength: true,
    supportsReferences: false,
  },
  "fal-ai/nano-banana-2/edit": {
    label: "Nano Banana 2 Edit",
    family: "Google",
    costTier: "high",
    supportsStrength: false,
    supportsReferences: true,
  },
  "fal-ai/gpt-image-1.5/edit": {
    label: "GPT Image 1.5 Edit",
    family: "OpenAI",
    costTier: "premium",
    supportsStrength: false,
    supportsReferences: false,
  },
  "openai/gpt-image-2/edit": {
    label: "GPT Image 2 Edit",
    family: "OpenAI",
    costTier: "premium",
    supportsStrength: false,
    supportsReferences: false,
  },
};

const DEFAULT_EDIT_MODEL = "fal-ai/flux/dev/image-to-image";
const MAX_REFERENCE_IMAGES = 3;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

function normalizeModel(model?: string) {
  return model?.replace(/^fal-ai\//, "");
}

function getConversationEditModel(model?: string) {
  const normalizedModel = normalizeModel(model);

  if (!normalizedModel) return null;
  if (
    normalizedModel === "nano-banana-2" ||
    normalizedModel === "nano-banana-2/edit"
  ) {
    return "fal-ai/nano-banana-2/edit";
  }
  if (
    normalizedModel === "gpt-image-1.5" ||
    normalizedModel === "gpt-image-1.5/edit"
  ) {
    return "fal-ai/gpt-image-1.5/edit";
  }
  if (
    normalizedModel === "openai/gpt-image-2" ||
    normalizedModel === "openai/gpt-image-2/edit"
  ) {
    return "openai/gpt-image-2/edit";
  }
  if (
    normalizedModel === "flux/dev/image-to-image" ||
    normalizedModel.startsWith("flux/")
  ) {
    return DEFAULT_EDIT_MODEL;
  }

  return null;
}

function resolveConversationEditModel(
  item: GeneratedMedia | undefined,
  items: GeneratedMedia[],
) {
  const itemsById = new Map(items.map((entry) => [entry.id, entry]));
  const visited = new Set<string>();
  let currentItem = item;

  while (currentItem && !visited.has(currentItem.id)) {
    visited.add(currentItem.id);

    const editModel = getConversationEditModel(currentItem.model);
    if (editModel) return editModel;

    currentItem = currentItem.metadata?.sourceId
      ? itemsById.get(currentItem.metadata.sourceId)
      : undefined;
  }

  return DEFAULT_EDIT_MODEL;
}

function getModelConfig(model: string): EditModelConfig {
  return CONVERSATION_EDIT_MODELS[model] ?? {
    label: normalizeModel(model) ?? model,
    family: "Otro",
    costTier: "medium" as CostTier,
    supportsStrength: false,
    supportsReferences: false,
  };
}

export function ImageConversation({
  initialImageUrl,
}: {
  initialImageUrl: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState(92);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoomPosition, setZoomPosition] = useState<{ x: number; y: number } | null>(null);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [expandedRefIndex, setExpandedRefIndex] = useState<number | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const items = useGallery((state) => state.items);
  const getEditHistory = useGallery((state) => state.getEditHistory);
  const [history, setHistory] = useState<Iteration[]>([
    {
      id: "initial",
      url: initialImageUrl,
      prompt: "Original",
    },
  ]);
  const [currentIterationId, setCurrentIterationId] = useState("initial");
  const historyInitializedRef = useRef(false);
  const [modelOverride, setModelOverride] = useState<string | null>(null);

  const addToGallery = useGallery((state) => state.addWithPersistence);
  const initialGalleryItem = items.find((item) => item.url === initialImageUrl);
  const currentIteration =
    history.find((item) => item.id === currentIterationId) ?? history[0];
  const currentImageUrl = currentIteration?.url ?? initialImageUrl;
  const currentSourceItem = currentIteration?.sourceId
    ? items.find((item) => item.id === currentIteration.sourceId)
    : initialGalleryItem;
  const autoEditModel = resolveConversationEditModel(currentSourceItem, items);
  const activeEditModel = modelOverride ?? autoEditModel;
  const modelConfig = getModelConfig(activeEditModel);
  const canAdjustStrength = modelConfig.supportsStrength;
  const canUseReferences = modelConfig.supportsReferences;
  const editCostTier = modelConfig.costTier;

  useEffect(() => {
    if (historyInitializedRef.current) return;
    if (!initialGalleryItem?.id) return;

    const editHistory = getEditHistory(initialGalleryItem.id);
    if (editHistory.length > 1) {
      historyInitializedRef.current = true;
      const fullHistory: Iteration[] = editHistory.map((entry) => ({
        id: entry.item.id,
        url: entry.item.url,
        prompt: entry.item.prompt || entry.operation,
        sourceId: entry.item.id,
      })).reverse();
      setHistory(fullHistory);
      setCurrentIterationId(initialGalleryItem.id);
    } else {
      historyInitializedRef.current = true;
      setHistory((current) =>
        current.map((item) =>
          item.id === "initial" && !item.sourceId
            ? { ...item, sourceId: initialGalleryItem.id }
            : item,
        ),
      );
    }
  }, [initialGalleryItem?.id, getEditHistory]);

  const handleImageMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  }, []);

  const handleImageMouseLeave = useCallback(() => {
    setZoomPosition(null);
  }, []);

  async function handleReferenceFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remainingSlots = Math.max(
      0,
      MAX_REFERENCE_IMAGES - referenceImages.length,
    );
    if (remainingSlots === 0) {
      toast.error(`Puedes agregar hasta ${MAX_REFERENCE_IMAGES} referencias`);
      e.target.value = "";
      return;
    }

    try {
      const nextImages = await Promise.all(
        files
          .slice(0, remainingSlots)
          .map(async (file) =>
            optimizeImageIfLarge(await fileToDataUrl(file), 800),
          ),
      );

      setReferenceImages((current) =>
        [...current, ...nextImages].slice(0, MAX_REFERENCE_IMAGES),
      );
    } catch (error) {
      toast.error("No se pudieron cargar las referencias");
      console.error(error);
    } finally {
      e.target.value = "";
    }
  }

  async function handleSubmit() {
    if (!prompt.trim()) {
      toast.error("Ingresa un prompt de edición");
      return;
    }

    setLoading(true);

    try {
      const data = await editImage({
        imageUrl: currentImageUrl,
        prompt,
        strength: canAdjustStrength ? strength / 100 : undefined,
        model: activeEditModel,
        referenceImageUrls: canUseReferences ? referenceImages : undefined,
      });

      const nextUrl = data.images?.[0]?.url || data.image?.url;

      if (!nextUrl) {
        toast.error("No se recibió imagen");
        return;
      }

      const nextIterationId = crypto.randomUUID();

      setCurrentIterationId(nextIterationId);
      setHistory((current) => [
        {
          id: nextIterationId,
          url: nextUrl,
          prompt,
          sourceId: undefined,
        },
        ...current,
      ]);

      const nextSourceId = await addToGallery({
        type: "image",
        url: nextUrl,
        prompt,
        model: activeEditModel,
        costTier: editCostTier,
        metadata: {
          sourceId: currentIteration?.sourceId ?? initialGalleryItem?.id,
          source: currentImageUrl,
          referenceCount: canUseReferences ? referenceImages.length : undefined,
          strength: canAdjustStrength ? strength / 100 : undefined,
          costTier: editCostTier,
        },
      });
      setHistory((current) =>
        current.map((item) =>
          item.id === nextIterationId
            ? { ...item, sourceId: nextSourceId }
            : item,
        ),
      );

      setPrompt("");
      toast.success("Nueva iteración creada");
    } catch (error) {
      toast.error("Error al generar la iteración");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid h-screen grid-cols-[minmax(0,1fr)_300px] min-[1600px]:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex h-screen flex-col overflow-hidden border-r border-secondary/20 bg-slate-950/88">
        <div className="surface-secondary flex shrink-0 items-center justify-between border-b border-secondary/20 px-6 py-4">
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
            <Badge
              variant="secondary"
              className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint"
            >
              Conversation
            </Badge>
            <Select
              value={modelOverride ?? "auto"}
              onValueChange={(v) => setModelOverride(v === "auto" ? null : v)}
            >
              <SelectTrigger className="depth-secondary h-7 w-auto gap-1.5 rounded-2xl border border-secondary/20 bg-secondary/10 px-2.5 py-0 text-xs text-secondary-tint hover:bg-secondary/15">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <span className="flex items-center gap-2">
                    Auto ({getModelConfig(autoEditModel).label})
                  </span>
                </SelectItem>
                {Object.entries(CONVERSATION_EDIT_MODELS).map(([id, config]) => (
                  <SelectItem key={id} value={id}>
                    <span className="flex items-center gap-2">
                      {config.label}
                      <span className="text-xs text-slate-500">{config.family}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint"
            >
              {history.length} versiones
            </Badge>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
          <div
            ref={imageContainerRef}
            className="depth-mixed relative w-full max-w-5xl cursor-zoom-in overflow-hidden rounded-[2rem] border border-secondary/20 bg-black"
            onMouseMove={handleImageMouseMove}
            onMouseLeave={handleImageMouseLeave}
          >
            <Image
              src={currentImageUrl}
              alt="Current iteration"
              width={1800}
              height={1800}
              className="aspect-auto h-auto w-full max-h-[calc(100vh-16rem)] object-contain transition-transform duration-200"
              style={zoomPosition ? {
                transform: 'scale(2)',
                transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
              } : undefined}
              unoptimized
            />
            {zoomPosition && (
              <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-xs text-white/80 backdrop-blur-sm">
                <ZoomIn className="mr-1 inline h-3 w-3" />
                Zoom
              </div>
            )}
          </div>
        </div>

        <div className="surface-primary shrink-0 border-t border-primary/20 px-6 py-5">
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
                  <Badge
                    variant="secondary"
                    className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint"
                  >
                    {referenceImages.length}/{MAX_REFERENCE_IMAGES}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <label className="depth-secondary flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-secondary/25 bg-slate-950/75 px-4 py-3 text-sm text-slate-300 transition hover:border-secondary/40">
                    <ImagePlus className="h-4 w-4 text-secondary-tint" />
                    Dispositivo
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleReferenceFileChange}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setGalleryPickerOpen(true)}
                    className="depth-secondary flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-4 py-3 text-sm text-slate-300 transition hover:border-primary/40 hover:bg-primary/10"
                  >
                    <ImageIcon className="h-4 w-4 text-primary-tint" />
                    Galería
                  </button>
                </div>

                {referenceImages.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {referenceImages.map((url, index) => {
                      const isExpanded = expandedRefIndex === index;
                      return (
                        <div key={`${url}-${index}`}>
                          <button
                            type="button"
                            onClick={() => setExpandedRefIndex(isExpanded ? null : index)}
                            className={`flex items-center gap-2 overflow-hidden rounded-full border pr-1 transition ${
                              isExpanded
                                ? "border-primary/30 bg-primary/10"
                                : "border-secondary/20 bg-slate-950/80 hover:border-secondary/30"
                            }`}
                          >
                            <div className="relative h-7 w-7 shrink-0 overflow-hidden">
                              <Image
                                src={url}
                                alt={`Ref ${index + 1}`}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                            <span className="text-[10px] text-slate-400">Ref {index + 1}</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setReferenceImages((current) =>
                                  current.filter((_, i) => i !== index),
                                );
                              }}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-red-500/20 hover:text-red-400"
                            >
                              <X className="h-3 w-3" />
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="mt-1.5 overflow-hidden rounded-2xl border border-secondary/20 bg-slate-950/80">
                              <Image
                                src={url}
                                alt={`Reference ${index + 1}`}
                                width={600}
                                height={600}
                                className="h-auto w-[600px] max-w-full object-contain"
                                unoptimized
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4">
              <div className="space-y-3">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe la siguiente edición..."
                  rows={2}
                  className="min-h-[3rem] resize-none rounded-2xl border border-secondary/20 bg-slate-900/80 text-white"
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

      <aside className="depth-secondary h-screen overflow-hidden bg-slate-950/96">
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
                    ? "depth-primary border-primary/30 bg-primary/10"
                    : "depth-secondary border-secondary/15 bg-slate-900/70"
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
                  <p className="line-clamp-2 text-sm font-medium text-white">
                    {item.prompt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <GalleryPicker
        open={galleryPickerOpen}
        onOpenChange={setGalleryPickerOpen}
        mediaType="image"
        multiple
        maxSelection={Math.max(0, MAX_REFERENCE_IMAGES - referenceImages.length)}
        title="Seleccionar referencias"
        onSelect={(url) => {
          setReferenceImages((current) =>
            [...current, url].slice(0, MAX_REFERENCE_IMAGES),
          );
        }}
      />
    </main>
  );
}
