import { useState, useRef } from 'react'
import { Upload, FileText, Image, Download, Trash2, X, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useWorkOrderAttachments, useUploadAttachment } from '@/hooks/useWorkOrders'
import type { WorkOrderAttachment } from '@/types'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AttachmentThumbnailProps {
  attachment: WorkOrderAttachment
  onClick: () => void
}

function AttachmentThumbnail({ attachment, onClick }: AttachmentThumbnailProps) {
  const isImage = attachment.content_type.startsWith('image/')
  const isPdf = attachment.content_type === 'application/pdf'

  return (
    <div className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <button
        onClick={onClick}
        className="block w-full"
        aria-label={`View ${attachment.filename}`}
      >
        {isImage && attachment.thumbnail_url ? (
          <img
            src={attachment.thumbnail_url}
            alt={attachment.filename}
            className="h-32 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-32 items-center justify-center">
            {isPdf ? (
              <FileText className="h-12 w-12 text-red-400" />
            ) : (
              <FileText className="h-12 w-12 text-gray-400" />
            )}
          </div>
        )}
      </button>

      <div className="p-2">
        <p
          className="truncate text-xs font-medium text-gray-700 dark:text-gray-300"
          title={attachment.filename}
        >
          {attachment.filename}
        </p>
        <p className="text-[10px] text-gray-400">{formatFileSize(attachment.file_size)}</p>
      </div>

      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
        <a
          href={attachment.url}
          download={attachment.filename}
          className="rounded bg-white/90 p-1 shadow hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800"
          aria-label="Download"
        >
          <Download className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
        </a>
      </div>
    </div>
  )
}

// Lightbox
function Lightbox({ url, filename, onClose }: { url: string; filename: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={url}
        alt={filename}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

interface WorkOrderAttachmentsProps {
  workOrderId: number
  editable?: boolean
}

export function WorkOrderAttachments({ workOrderId, editable = true }: WorkOrderAttachmentsProps) {
  const { data: attachments = [], isLoading } = useWorkOrderAttachments(workOrderId)
  const upload = useUploadAttachment(workOrderId)
  const [lightbox, setLightbox] = useState<WorkOrderAttachment | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string[]>([])

  const uploadFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert(`${file.name} exceeds 10 MB limit.`)
      return
    }
    setUploading((prev) => [...prev, file.name])
    try {
      await upload.mutateAsync(file)
    } finally {
      setUploading((prev) => prev.filter((n) => n !== file.name))
    }
  }

  const onFiles = (files: FileList | null) => {
    if (!files) return
    const accepted = Array.from(files).slice(0, 20 - attachments.length)
    accepted.forEach(uploadFile)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    onFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      ) : attachments.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((att) => (
            <AttachmentThumbnail
              key={att.id}
              attachment={att}
              onClick={() => att.content_type.startsWith('image/') && setLightbox(att)}
            />
          ))}
        </div>
      ) : null}

      {/* In-progress uploads */}
      {uploading.map((name) => (
        <div key={name} className="flex items-center gap-2 rounded-lg border p-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div className="h-2 w-1/2 animate-pulse rounded-full bg-brand-500" />
          </div>
          <span className="text-xs text-gray-500 truncate max-w-32">{name}</span>
        </div>
      ))}

      {/* Upload zone */}
      {editable && attachments.length < 20 && (
        <div
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
            dragOver
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
              : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload files"
        >
          <Upload className="mb-2 h-8 w-8 text-gray-400" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Drag & drop or click to upload
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Images, PDF, documents · max 10 MB · {20 - attachments.length} remaining
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
            capture={undefined}
          />
        </div>
      )}

      {/* Mobile camera button */}
      {editable && (
        <Button
          variant="outline"
          size="sm"
          className="sm:hidden"
          onClick={() => {
            const inp = document.createElement('input')
            inp.type = 'file'
            inp.accept = 'image/*'
            inp.capture = 'environment'
            inp.onchange = () => onFiles(inp.files)
            inp.click()
          }}
        >
          <Camera className="h-4 w-4" />
          Take Photo
        </Button>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          url={lightbox.url}
          filename={lightbox.filename}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
