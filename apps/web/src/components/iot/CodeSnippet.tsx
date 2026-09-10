import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeSnippetProps {
  code: string
  language?: string
  filename?: string
}

export function CodeSnippet({ code, language = 'bash', filename }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative rounded-lg bg-gray-900 text-gray-100 overflow-hidden">
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 text-xs text-gray-400">
          <span>{filename}</span>
          <span>{language}</span>
        </div>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 rounded p-1.5 text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className="p-4 text-sm overflow-x-auto whitespace-pre leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}
