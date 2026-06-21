import { useState } from 'react'
import { cn, getDisplayProductName } from '@/lib/utils'

interface ProductImageProps {
  src?: string | null
  name: string
  className?: string
  containerClassName?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  isTried?: boolean
}

export function ProductImage({
  src,
  name,
  className,
  containerClassName,
  size = 'md',
  isTried = false,
}: ProductImageProps) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const productName = getDisplayProductName(name)
  const initials = productName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  // Font sizes and watermark text size depending on size prop
  let initialsSize = 'text-4xl'
  let watermarkSize = 'text-[10px]'
  let watermarkMargin = 'mt-14'
  let showWatermark = true

  if (size === 'xs') {
    initialsSize = 'text-[10px] font-black'
    showWatermark = false
  } else if (size === 'sm') {
    initialsSize = 'text-sm font-extrabold'
    watermarkSize = 'text-[6px]'
    watermarkMargin = 'mt-6'
    showWatermark = true
  } else if (size === 'lg') {
    initialsSize = 'text-5xl font-black'
    watermarkSize = 'text-xs'
    watermarkMargin = 'mt-20'
    showWatermark = true
  } else if (size === 'xl') {
    initialsSize = 'text-6xl font-black'
    watermarkSize = 'text-sm'
    watermarkMargin = 'mt-24'
    showWatermark = true
  }

  return (
    <div className={cn('relative overflow-hidden flex items-center justify-center bg-[hsl(var(--muted))] w-full h-full', containerClassName)}>
      {src && !imgError ? (
        <>
          {!imgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-[hsl(var(--muted))]" />
          )}
          <img
            src={src}
            alt={productName}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={cn(className, isTried && 'saturate-[0.6]', !imgLoaded && 'opacity-0')}
          />
        </>
      ) : (
        /* Amul-red gradient placeholder with initials */
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amul-red to-amul-red-dark relative">
          <span className={cn('font-black text-white/90 select-none', initialsSize)}>{initials}</span>
          {showWatermark && (
            <span className={cn('absolute inset-0 flex items-center justify-center font-semibold text-white/25 pointer-events-none select-none tracking-widest', watermarkSize, watermarkMargin)}>
              AMUL PAGLU
            </span>
          )}
        </div>
      )}
    </div>
  )
}
