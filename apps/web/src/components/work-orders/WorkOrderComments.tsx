import { useState, useRef } from 'react'
import { Lock, Trash2, Mic } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useWorkOrderComments, useCreateComment, useDeleteComment } from '@/hooks/useWorkOrders'
import { useAuthStore } from '@/stores/authStore'

interface WorkOrderCommentsProps {
  workOrderId: number
  canViewInternal?: boolean
}

export function WorkOrderComments({ workOrderId, canViewInternal = false }: WorkOrderCommentsProps) {
  const { user } = useAuthStore()
  const { data: comments = [], isLoading } = useWorkOrderComments(workOrderId)
  const createComment = useCreateComment(workOrderId)
  const deleteComment = useDeleteComment(workOrderId)

  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const visible = canViewInternal ? comments : comments.filter((c) => !c.is_internal)

  const submit = async () => {
    if (!body.trim()) return
    await createComment.mutateAsync({ body: body.trim(), is_internal: isInternal })
    setBody('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  // 1-hour window for deletion
  const canDelete = (createdAt: string, commentUserId: number) => {
    if (commentUserId !== user?.id) return false
    return Date.now() - new Date(createdAt).getTime() < 60 * 60 * 1000
  }

  return (
    <div className="space-y-4">
      {/* Comment toggle */}
      {canViewInternal && (
        <div className="flex gap-1 rounded-lg border border-gray-200 p-1 w-fit dark:border-gray-700">
          <button
            onClick={() => {}}
            className="rounded-md px-3 py-1 text-xs font-medium bg-white text-gray-700 shadow-sm dark:bg-gray-700 dark:text-gray-200"
          >
            Public
          </button>
          <button
            onClick={() => {}}
            className="flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <Lock className="h-3 w-3" /> Internal
          </button>
        </div>
      )}

      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold dark:bg-brand-900/30 dark:text-brand-300">
                {comment.user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {comment.user.full_name}
                  </span>
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    {comment.user.role}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {comment.is_internal && (
                    <span className="flex items-center gap-0.5 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                      <Lock className="h-2.5 w-2.5" /> Internal note
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {comment.body}
                </p>
              </div>
              {canDelete(comment.created_at, comment.user.id) && (
                <button
                  onClick={() => deleteComment.mutate(comment.id)}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  aria-label="Delete comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
            }}
            onKeyDown={onKeyDown}
            placeholder="Add a comment... (Cmd+Enter to submit)"
            maxLength={2000}
            rows={2}
            className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {canViewInternal && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600"
                />
                <Lock className="h-3 w-3" />
                Internal note
              </label>
            )}
            <button
              className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Voice to text"
              type="button"
            >
              <Mic className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{body.length}/2000</span>
            <Button
              size="sm"
              onClick={submit}
              disabled={!body.trim() || createComment.isPending}
              loading={createComment.isPending}
            >
              Post Comment
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
