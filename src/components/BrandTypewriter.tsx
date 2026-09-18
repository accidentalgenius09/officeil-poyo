import { useEffect, useState } from 'react'

const PHRASES = [
  'Officeil Poyo?', //malayalam
  'Went to office?', //english
  'Office gaye?', //hindi
  'Office-ge hodra?', //kannada
  'Office-ku pona?' //tamil
]

const TYPE_MS = 48
const DELETE_MS = 28
const HOLD_MS = 1400
const GAP_MS = 320

type BrandTypewriterProps = {
  phrases?: string[]
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function BrandTypewriter({
  phrases = PHRASES,
}: BrandTypewriterProps) {
  const [text, setText] = useState(() =>
    prefersReducedMotion() ? (phrases[0] ?? 'Officeil Poyo?') : '',
  )
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [animate, setAnimate] = useState(() => !prefersReducedMotion())

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      const reduce = media.matches
      setAnimate(!reduce)
      if (reduce) {
        setText(phrases[0] ?? 'Officeil Poyo?')
        setDeleting(false)
        setPhraseIndex(0)
      }
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [phrases])

  useEffect(() => {
    if (!animate || phrases.length === 0) return

    const phrase = phrases[phraseIndex % phrases.length] ?? ''
    let timer: ReturnType<typeof setTimeout>

    if (!deleting && text === phrase) {
      timer = setTimeout(() => setDeleting(true), HOLD_MS)
    } else if (deleting && text === '') {
      timer = setTimeout(() => {
        setDeleting(false)
        setPhraseIndex((i) => (i + 1) % phrases.length)
      }, GAP_MS)
    } else if (deleting) {
      timer = setTimeout(() => setText(phrase.slice(0, text.length - 1)), DELETE_MS)
    } else {
      timer = setTimeout(() => setText(phrase.slice(0, text.length + 1)), TYPE_MS)
    }

    return () => clearTimeout(timer)
  }, [text, deleting, phraseIndex, phrases, animate])

  return (
    <h1 className="brand-mark brand-typewriter" aria-label="Officeil Poyo?">
      <span className="brand-typewriter-text" aria-hidden="true">
        {text}
      </span>
      {animate ? <span className="brand-caret" aria-hidden="true" /> : null}
    </h1>
  )
}
