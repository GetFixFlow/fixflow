import { useState } from 'react'
import { Mic, Send, Copy, ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { AIDisclaimer } from './AIDisclaimer'
import { AILoadingState } from './AILoadingState'
import { useAssistChat } from '@/hooks/useAssistChat'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { cn } from '@/lib/utils'
import type { WorkOrder } from '@/types'

interface FixFlowAssistDrawerProps {
  open: boolean
  onClose: () => void
  workOrder: WorkOrder
}

const SUGGESTED_QUESTIONS = [
  'What tools do I need for this job?',
  'What safety precautions should I take?',
  'How long should this take?',
]

function AnswerActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  return (
    <div className="mt-1.5 flex items-center gap-1">
      <button
        onClick={() => {
          navigator.clipboard.writeText(text).catch(() => {})
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
        aria-label="Copy answer"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => setFeedback('up')}
        className={cn('rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700', feedback === 'up' ? 'text-green-600' : 'text-gray-400')}
        aria-label="Good answer"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setFeedback('down')}
        className={cn('rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700', feedback === 'down' ? 'text-red-600' : 'text-gray-400')}
        aria-label="Poor answer"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function FixFlowAssistDrawer({ open, onClose, workOrder }: FixFlowAssistDrawerProps) {
  const [input, setInput] = useState('')
  const { messages, isStreaming, send } = useAssistChat(workOrder.id)
  const voice = useVoiceInput()

  const handleSend = (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || isStreaming) return
    setInput('')
    send(trimmed)
  }

  return (
    <Drawer open={open} onClose={onClose} title="✨ FixFlow Assist" description="AI assistant for this work order">
      <div className="flex h-full flex-col">
        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800/50">
            <p className="mb-1 font-medium text-gray-500 dark:text-gray-400">Context loaded:</p>
            <p className="text-gray-700 dark:text-gray-300">
              ✓ Asset: {workOrder.asset?.name ?? 'none'}
              {workOrder.asset && <><br />✓ Past work order history<br />✓ Manuals (if uploaded)</>}
            </p>
          </div>

          {messages.length === 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Suggested questions:</p>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="block w-full rounded-md border border-gray-200 px-3 py-1.5 text-left text-sm text-gray-700 hover:border-brand-300 hover:bg-brand-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-brand-900/20"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <AIDisclaimer feature="fixflow_assist" />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {messages.map((m, i) => (
            <div key={i} className={cn('text-sm', m.role === 'user' ? 'text-right' : '')}>
              {m.role === 'user' ? (
                <div className="inline-block rounded-lg bg-brand-600 px-3 py-2 text-white">{m.content}</div>
              ) : (
                <div>
                  <div className="inline-block rounded-lg bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                    {m.content ? (
                      <span className="whitespace-pre-wrap">🤖 {m.content}</span>
                    ) : (
                      <AILoadingState messages={['Reading manual...', 'Checking history...', 'Thinking...']} />
                    )}
                  </div>
                  {m.content && (
                    <>
                      {m.citations && m.citations.length > 0 && (
                        <p className="mt-1 text-xs text-gray-400">Source: {m.citations.join(', ')}</p>
                      )}
                      <AnswerActions text={m.content} />
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 p-3 dark:border-gray-700">
          <div className="flex items-end gap-2">
            <textarea
              value={voice.isListening ? voice.transcript : input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(input)
                }
              }}
              placeholder="Ask anything about this work order..."
              rows={1}
              className="flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
            />
            {voice.isSupported && (
              <Button
                variant={voice.isListening ? 'destructive' : 'outline'}
                size="icon"
                onClick={() => (voice.isListening ? voice.stop() : voice.start())}
                aria-label="Voice input"
                type="button"
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" onClick={() => handleSend(input)} loading={isStreaming} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
