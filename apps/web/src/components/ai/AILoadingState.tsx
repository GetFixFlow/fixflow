import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface AILoadingStateProps {
  messages?: string[]
  className?: string
}

const DEFAULT_MESSAGES = ['Thinking...']

export function AILoadingState({ messages = DEFAULT_MESSAGES, className }: AILoadingStateProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (messages.length <= 1) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % messages.length), 1800)
    return () => clearInterval(timer)
  }, [messages])

  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Sparkles className="h-4 w-4 animate-pulse text-brand-500" />
        <span className="animate-pulse">{messages[index]}</span>
      </div>
      <div className="mt-2 space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-gray-100 dark:bg-gray-800"
            style={{ width: `${90 - i * 15}%` }}
          />
        ))}
      </div>
    </div>
  )
}
