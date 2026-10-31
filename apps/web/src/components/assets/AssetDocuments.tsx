import { useRef, useState } from 'react'
import { FileText, Paperclip, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAssetDocuments, useDeleteAssetDocument, useUploadAssetDocument } from '@/hooks/useAssetDocuments'
import { formatDate } from '@/lib/localeFormat'
import type { AssetDocument } from '@/types'

const MAX_BYTES = 10 * 1024 * 1024

function DocumentRow({ document, canRemove, onRemove }: { document: AssetDocument; canRemove: boolean; onRemove: () => void }) {
  const isImage = (document.content_type ?? '').startsWith('image/')
  return (
    <li className="flex items-center gap-3 py-3">
      {isImage && document.url ? (
        <img src={document.url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md border border-gray-200 object-cover dark:border-gray-700" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700">
          <FileText className="h-6 w-6 text-gray-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <a href={document.url ?? undefined} target="_blank" rel="noopener noreferrer"
          className="block truncate text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          {document.filename}
        </a>
        {document.description && <p className="truncate text-sm text-gray-700 dark:text-gray-300">{document.description}</p>}
        <p className="text-xs text-gray-500">Added by {document.user.full_name} on {formatDate(document.created_at)}</p>
      </div>
      {canRemove && (
        <Button size="sm" variant="outline" aria-label={`Remove ${document.filename}`} onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </li>
  )
}

/** The manuals, photos and certificates kept with an asset. Anyone who works on equipment can add one; a manager can remove any. */
export function AssetDocuments({ assetId, canManage, userId }: { assetId: number; canManage: boolean; userId?: number }) {
  const { data: documents, isLoading, isError } = useAssetDocuments(assetId)
  const upload = useUploadAssetDocument(assetId)
  const remove = useDeleteAssetDocument(assetId)
  const [description, setDescription] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const choose = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) {
      toast.error('That file is over 10 MB. Choose a smaller one.')
    } else {
      upload.mutate({ file, description: description.trim() || undefined }, { onSuccess: () => setDescription('') })
    }
    if (input.current) input.current.value = ''
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (isError) return <p className="text-sm text-red-600">The documents could not be loaded.</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Manuals, photos of the nameplate, certificates. A PDF manual is also read by the AI assistant when it helps with a work order on this asset.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor="document-note" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Note (optional)</label>
          <Input id="document-note" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Operator manual, 2019 edition" />
        </div>
        <input ref={input} type="file" className="sr-only" aria-label="Choose a file" tabIndex={-1}
          accept="image/*,application/pdf,.doc,.docx" onChange={(e) => choose(e.target.files?.[0])} />
        <Button onClick={() => input.current?.click()} loading={upload.isPending}>
          <Paperclip className="mr-1.5 h-4 w-4" />Add a file
        </Button>
      </div>
      {documents?.length ? (
        <Card>
          <CardContent className="p-4">
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {documents.map((document) => (
                <DocumentRow key={document.id} document={document} canRemove={canManage || document.user.id === userId}
                  onRemove={() => { if (window.confirm(`Remove “${document.filename}” from this asset?`)) remove.mutate(document.id) }} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={FileText} title="No documents yet" description="Add the manual or a photo of the nameplate, so it is at hand when the machine needs work." />
      )}
    </div>
  )
}
