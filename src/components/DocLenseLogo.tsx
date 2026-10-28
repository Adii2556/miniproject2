interface Props {
  size?: number
  className?: string
}

/** DocLense mark: an open book sprouting a spark — inline SVG, theme-aware. */
export default function DocLenseLogo({ size = 40, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} role="img" aria-label="DocLense logo">
      <rect x="2" y="2" width="44" height="44" rx="13" className="fill-[#175e54] dark:fill-[#ff8a5c]" />
      <path d="M13 17.5c4.2-1.4 8-.7 11 1.6 3-2.3 6.8-3 11-1.6v17c-4.2-1.4-8-.7-11 1.6-3-2.3-6.8-3-11-1.6v-17Z" fill="#faf6ec" stroke="#175e54" strokeWidth="2.1" strokeLinejoin="round" className="dark:stroke-[#7a2d12]" />
      <path d="M24 19.1v17" stroke="#175e54" strokeWidth="2.1" className="dark:stroke-[#7a2d12]" />
      <path d="M17.5 22.6c2.3-.5 4.4-.1 6 .9M17.5 27.3c2.3-.5 4.4-.1 6 .9M30.5 22.6c-2.3-.5-4.4-.1-6 .9M30.5 27.3c-2.3-.5-4.4-.1-6 .9" stroke="#175e54" strokeWidth="1.5" strokeLinecap="round" className="dark:stroke-[#7a2d12]" opacity="0.75" />
      <path d="M37.5 8.6l.95 2.35a.6.6 0 0 0 1.14 0l.95-2.35 2.35-.95a.6.6 0 0 0 0-1.14l-2.35-.95-.95-2.35a.6.6 0 0 0-1.14 0l-.95 2.35-2.35.95a.6.6 0 0 0 0 1.14l2.35.95Z" fill="#d9a441" stroke="#8a5b0e" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}
