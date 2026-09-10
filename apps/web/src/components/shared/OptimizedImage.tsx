import { useState } from 'react'
import { ImageOff } from 'lucide-react'

interface Props {
  src: string
  alt: string
  className?: string
  fallbackClassName?: string
}

export function OptimizedImage({ src, alt, className, fallbackClassName }: Props) {
  const [error, setError] = useState(false)
  if (error) {
    return (
      <div className={fallbackClassName ?? 'flex items-center justify-center bg-gray-100 rounded'}>
        <ImageOff className="h-5 w-5 text-gray-400" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setError(true)}
    />
  )
}
