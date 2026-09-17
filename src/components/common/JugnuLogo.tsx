import React from 'react'

interface JugnuLogoProps {
  className?: string
  size?: number
}

/**
 * Jugnu Brand Logo Component
 * Features a modern, glowing firefly badge with a bold, stylized letter 'J'.
 */
export const JugnuLogo: React.FC<JugnuLogoProps> = ({ className = 'w-8 h-8', size }) => {
  const style = size ? { width: size, height: size } : undefined

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={style}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
        aria-hidden="true"
      >
        <defs>
          {/* Vibrant Firefly Amber/Gold Gradient */}
          <linearGradient id="jugnuBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Glowing Spark Gradient */}
          <radialGradient id="jugnuSparkGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>

          {/* Inner Shadow / Emboss */}
          <linearGradient id="jugnuLetterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#09090b" />
            <stop offset="100%" stopColor="#18181b" />
          </linearGradient>
        </defs>

        {/* Squircle Badge Base */}
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="26"
          fill="url(#jugnuBgGrad)"
          className="transition-transform duration-200"
        />

        {/* Subtle Inner Border Glow */}
        <rect
          x="5.5"
          y="5.5"
          width="89"
          height="89"
          rx="24.5"
          stroke="#ffffff"
          strokeOpacity="0.35"
          strokeWidth="2.5"
        />

        {/* Stylized Modern Letter 'J' */}
        <path
          d="M 58 24
             L 58 59
             C 58 69 51 76 40 76
             C 30 76 24 70 24 62
             C 24 57.5 27.5 54 32 54
             C 36.5 54 39.5 57 40 61
             C 40.5 64 42.5 66 45.5 66
             C 48.5 66 50 63.5 50 59
             L 50 24
             Z"
          fill="url(#jugnuLetterGrad)"
          stroke="url(#jugnuLetterGrad)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Glowing Firefly Sparkle (Top-Right of 'J') */}
        <g transform="translate(68, 22)">
          {/* Radial soft glow halo */}
          <circle cx="0" cy="0" r="14" fill="url(#jugnuSparkGrad)" opacity="0.8" />
          {/* 4-point golden star */}
          <path
            d="M 0 -8 Q 0 0 8 0 Q 0 0 0 8 Q 0 0 -8 0 Q 0 0 0 -8 Z"
            fill="#ffffff"
          />
        </g>
      </svg>
    </div>
  )
}

export default JugnuLogo
