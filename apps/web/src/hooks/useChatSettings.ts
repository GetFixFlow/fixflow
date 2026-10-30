import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { chatApi } from '@/api/chat'

function failure(fallback: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? fallback)
}

export function useChatSettings() {
  return useQuery({ queryKey: ['chat_settings'], queryFn: () => chatApi.get().then((r) => r.data.chat) })
}

export function useUpdateChatSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: chatApi.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat_settings'] })
      toast.success('Chat settings saved.')
    },
    onError: failure('Could not save the chat settings.'),
  })
}

export function useRemoveChatSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: chatApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat_settings'] })
      toast.success('Chat settings removed.')
    },
    onError: failure('Could not remove the chat settings.'),
  })
}

/** The page shows the outcome (and why it failed) next to the button, so no toast here. */
export function useTestChat() {
  return useMutation({ mutationFn: chatApi.test })
}
