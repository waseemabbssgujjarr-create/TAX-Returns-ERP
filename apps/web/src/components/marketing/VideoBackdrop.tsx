'use client'

import { useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

export type BackdropSource = { src: string; poster: string }

/**
 * Looping, muted background videos with a crossfade. Controlled by `active`.
 * Videos pause when inactive and stay on their poster under reduced motion.
 */
export function VideoBackdrop({
  sources,
  active = 0,
}: {
  sources: BackdropSource[]
  active?: number
}) {
  const reduce = useReducedMotion()
  const refs = useRef<Array<HTMLVideoElement | null>>([])

  useEffect(() => {
    refs.current.forEach((video, index) => {
      if (!video) return
      if (index === active && !reduce) {
        video.currentTime = 0
        void video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    })
  }, [active, reduce])

  return (
    <div className="mk-backdrop" aria-hidden="true">
      {sources.map((source, index) => (
        <video
          key={source.src}
          ref={(el) => {
            refs.current[index] = el
          }}
          className={index === active ? 'on' : undefined}
          muted
          loop
          playsInline
          preload={index === 0 ? 'auto' : 'metadata'}
          poster={source.poster}
          tabIndex={-1}
        >
          <source src={source.src} type="video/mp4" />
        </video>
      ))}
    </div>
  )
}
