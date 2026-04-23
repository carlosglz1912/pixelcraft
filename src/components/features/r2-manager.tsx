'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useQuery, useMutation } from 'convex/react'
import { api } from 'convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getUser, setUsername, getUserId } from '@/lib/user'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Trash2,
  User,
  Cloud,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Copy,
  ImagePlus,
} from 'lucide-react'
import { toast } from 'sonner'

interface MediaItem {
  _id: string
  storageId: string
  provider: 'convex' | 'r2'
  type: 'image' | 'video'
  url: string
  originalUrl?: string
  fileName: string
  size?: number
  prompt?: string
  modelId?: string
  createdAt: number
}

interface DuplicateGroup {
  originalUrl: string
  count: number
  items: Array<{
    _id: string
    storageId: string
    fileName: string
    createdAt: number
    size?: number
  }>
}

interface R2ManagerProps {
  onSwitchTab?: (tab: 'gallery' | 'storage') => void
}

export function R2Manager({ onSwitchTab }: R2ManagerProps) {
  const [username, setUsernameState] = useState('')
  const [userId, setUserId] = useState('')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [deleting, setDeleting] = useState<Set<string>>(new Set())

  const items = useQuery(api.files.listByUser, userId ? { userId, limit: 100 } : 'skip') as MediaItem[] | undefined
  const duplicates = useQuery(api.files.findDuplicates, userId ? { userId } : 'skip') as DuplicateGroup[] | undefined
  const removeItem = useMutation(api.files.remove)
  const removeMultipleItems = useMutation(api.files.removeMultiple)

  useEffect(() => {
    const user = getUser()
    setUsernameState(user.username || '')
    setUserId(getUserId())
  }, [])

  function handleSetUsername() {
    if (!username.trim()) {
      toast.error('Ingresa un nombre de usuario')
      return
    }
    setUsername(username.trim())
    setUserId(getUserId())
    toast.success('Usuario guardado')
  }

  async function handleDeleteItem(id: string) {
    setDeleting((prev) => new Set(prev).add(id))
    
    try {
      await removeItem({ id: id as any })
      setSelectedItem(null)
      toast.success('Archivo eliminado')
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Error al eliminar')
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function handleDeleteDuplicates(keepFirst: boolean) {
    if (!duplicates || duplicates.length === 0) return

    const idsToDelete: string[] = []
    
    for (const group of duplicates) {
      const sorted = [...group.items].sort((a, b) => a.createdAt - b.createdAt)
      const toDelete = keepFirst ? sorted.slice(1) : sorted.slice(0, -1)
      idsToDelete.push(...toDelete.map((item) => item._id))
    }

    if (idsToDelete.length === 0) return

    setDeleting((prev) => new Set(prev).add('batch'))
    
    try {
      const result = await removeMultipleItems({ ids: idsToDelete as any[] })
      toast.success(`${result.deleted} duplicados eliminados`)
    } catch (error) {
      console.error('Failed to delete duplicates:', error)
      toast.error('Error al eliminar duplicados')
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev)
        next.delete('batch')
        return next
      })
    }
  }

  function copyUserId() {
    navigator.clipboard.writeText(userId)
    toast.success('ID copiado')
  }

  const totalSize = items?.reduce((acc, item) => acc + (item.size || 0), 0) || 0
  const formatSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="flex h-full flex-col">
      <div className="surface-secondary flex items-center justify-between gap-3 border-b border-secondary/20 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
            <Cloud className="mr-1 h-3 w-3" />
            R2 Manager
          </Badge>
          <Badge variant="secondary" className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint">
            {items?.length || 0} archivos
          </Badge>
          <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
            {formatSize(totalSize)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {onSwitchTab && (
            <button
              type="button"
              onClick={() => onSwitchTab('gallery')}
              className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 px-3 py-1.5 text-xs font-medium text-secondary-tint transition hover:bg-secondary/15 hover:text-white"
            >
              <ImagePlus className="mr-1.5 inline h-3 w-3" />
              Galería
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-4.75rem)]">
        <div className="space-y-6 p-5">
          {/* User Section */}
          <div className="depth-mixed rounded-3xl border border-secondary/15 bg-slate-900/78 p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-primary-tint" />
              <h3 className="text-sm font-semibold text-white">Tu Usuario</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={username}
                  onChange={(e) => setUsernameState(e.target.value)}
                  placeholder="Nombre de usuario"
                  className="depth-secondary border border-secondary/20 bg-slate-900/70 text-white"
                />
                <Button
                  onClick={handleSetUsername}
                  className="depth-primary border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Guardar
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-secondary/20 bg-slate-950/50 px-3 py-2 font-mono text-xs text-slate-400">
                  {userId}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyUserId}
                  className="depth-secondary border border-secondary/15"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Duplicates Section */}
          {duplicates && duplicates.length > 0 && (
            <div className="depth-mixed rounded-3xl border border-amber-500/30 bg-amber-950/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">
                  Duplicados Detectados ({duplicates.reduce((acc, g) => acc + g.count - 1, 0)})
                </h3>
              </div>
              
              <div className="space-y-2 mb-4">
                {duplicates.map((group, i) => (
                  <div key={i} className="text-xs text-slate-300">
                    {group.count} copias de: {group.originalUrl?.slice(0, 60)}...
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleDeleteDuplicates(true)}
                  disabled={deleting.has('batch')}
                  className="depth-primary border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {deleting.has('batch') ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mantener el más antiguo'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDeleteDuplicates(false)}
                  disabled={deleting.has('batch')}
                  className="depth-secondary border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15"
                >
                  Mantener el más reciente
                </Button>
              </div>
            </div>
          )}

          {/* Files List */}
          <div className="depth-mixed rounded-3xl border border-secondary/15 bg-slate-900/78 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cloud className="h-5 w-5 text-primary-tint" />
              <h3 className="text-sm font-semibold text-white">Tus Archivos</h3>
            </div>
            
            {!items ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary-tint" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No hay archivos persistidos
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => setSelectedItem(item)}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-secondary/15 bg-slate-950/50 transition hover:border-primary/30"
                  >
                    {item.type === 'image' ? (
                      <Image
                        src={item.url}
                        alt={item.prompt || item.fileName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <video
                        src={item.url}
                        className="h-full w-full object-cover"
                        muted
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="depth-mixed max-h-[90vh] overflow-hidden border-secondary/25 bg-slate-950/95 p-0 text-white sm:max-w-2xl">
          {selectedItem && (
            <div className="flex flex-col">
              <DialogHeader className="surface-secondary border-b border-secondary/20 px-5 py-4">
                <DialogTitle className="text-white">Detalle del Archivo</DialogTitle>
                <DialogDescription className="sr-only">
                  Información detallada del archivo seleccionado
                </DialogDescription>
              </DialogHeader>
              
              <div className="p-5 space-y-4">
                <div className="depth-mixed overflow-hidden rounded-xl border border-secondary/20 bg-black">
                  {selectedItem.type === 'image' ? (
                    <Image
                      src={selectedItem.url}
                      alt={selectedItem.prompt || selectedItem.fileName}
                      width={800}
                      height={800}
                      className="w-full h-auto max-h-[50vh] object-contain"
                      unoptimized
                    />
                  ) : (
                    <video
                      src={selectedItem.url}
                      controls
                      className="w-full max-h-[50vh]"
                    />
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="depth-secondary">
                      {selectedItem.type}
                    </Badge>
                    <Badge variant="secondary" className="depth-secondary">
                      {formatSize(selectedItem.size)}
                    </Badge>
                    <Badge variant="secondary" className="depth-secondary">
                      {new Date(selectedItem.createdAt).toLocaleString()}
                    </Badge>
                  </div>
                  
                  {selectedItem.prompt && (
                    <p className="text-slate-300">{selectedItem.prompt}</p>
                  )}
                  
                  <div className="font-mono text-xs text-slate-500 break-all">
                    {selectedItem.storageId}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  onClick={() => handleDeleteItem(selectedItem._id)}
                  disabled={deleting.has(selectedItem._id)}
                  className="w-full depth-secondary border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  {deleting.has(selectedItem._id) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Eliminar archivo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
