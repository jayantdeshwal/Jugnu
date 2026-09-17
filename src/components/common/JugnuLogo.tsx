import React from 'react'

interface JugnuLogoProps {
  className?: string
  size?: number
  alt?: string
}

/**
 * Jugnu Official Brand Logo Component
 * Renders the official brand logo featuring the glowing 'j' with firefly wings.
 */
export const JugnuLogo: React.FC<JugnuLogoProps> = ({
  className = 'w-8 h-8',
  size,
  alt = 'Jugnu',
}) => {
  const style = size ? { width: size, height: size } : undefined

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden rounded-xl shadow-xs transition-transform ${className}`}
      style={style}
    >
      <img
        src="/app-logo.png"
        alt={alt}
        className="w-full h-full object-cover rounded-xl"
        loading="eager"
        decoding="async"
      />
    </div>
  )
}

export default JugnuLogo
