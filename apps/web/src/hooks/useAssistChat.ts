import { useCallback, useRef, useState } from 'react'

export interface AssistMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: string[]
}

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

export function useAssistChat(workOrderId: number) {
  const [messages, setMessages] = useState<AssistMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (question: string) => {
      const history = messages.map(({ role, content }) => ({ role, content }))
      setMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`${API_BASE}/ai/assist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ work_order_id: workOrderId, message: question, conversation_history: history }),
          signal: controller.signal,
        })

        if (!res.body) throw new Error('No response body')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const frames = buffer.split('\n\n')
          buffer = frames.pop() ?? ''

          for (const frame of frames) {
            const line = frame.split('\n').find((l) => l.startsWith('data: '))
            if (!line) continue
            const payload = JSON.parse(line.slice(6)) as { text?: string; done?: boolean; citations?: string[]; error?: string }

            if (payload.error) {
              setMessages((prev) => updateLastAssistant(prev, (m) => ({ ...m, content: m.content || `⚠️ ${payload.error}` })))
            } else if (payload.text) {
              setMessages((prev) => updateLastAssistant(prev, (m) => ({ ...m, content: m.content + payload.text })))
            } else if (payload.done) {
              setMessages((prev) => updateLastAssistant(prev, (m) => ({ ...m, citations: payload.citations ?? [] })))
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) => updateLastAssistant(prev, (m) => ({ ...m, content: m.content || '⚠️ Something went wrong. Please try again.' })))
        }
      } finally {
        setIsStreaming(false)
      }
    },
    [messages, workOrderId],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { messages, isStreaming, send, stop }
}

function updateLastAssistant(messages: AssistMessage[], updater: (m: AssistMessage) => AssistMessage): AssistMessage[] {
  const next = [...messages]
  const lastIndex = next.length - 1
  if (lastIndex >= 0 && next[lastIndex].role === 'assistant') {
    next[lastIndex] = updater(next[lastIndex])
  }
  return next
}
