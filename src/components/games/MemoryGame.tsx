import { useEffect, useId, useMemo, useRef, useState, type ComponentType } from 'react'
import { trackEvent } from '../../lib/analytics'
import {
  Clock,
  Coffee,
  Desktop,
  EnvelopeSimple,
  Key,
  Monitor,
  PencilSimple,
  Question,
  Star,
  type IconProps,
} from '@phosphor-icons/react'

type IconComponent = ComponentType<IconProps>

type Card = {
  id: number
  key: string
  label: string
  Icon: IconComponent
  matched: boolean
}

type MemoryGameProps = {
  onBack: () => void
}

const PAIRS: { key: string; label: string; Icon: IconComponent }[] = [
  { key: 'desk', label: 'Desk', Icon: Desktop },
  { key: 'mug', label: 'Mug', Icon: Coffee },
  { key: 'mail', label: 'Mail', Icon: EnvelopeSimple },
  { key: 'pen', label: 'Pen', Icon: PencilSimple },
  { key: 'clock', label: 'Clock', Icon: Clock },
  { key: 'key', label: 'Key', Icon: Key },
  { key: 'screen', label: 'Screen', Icon: Monitor },
  { key: 'star', label: 'Star', Icon: Star },
]

function shuffleCards(): Card[] {
  const deck = PAIRS.flatMap((pair, index) => [
    {
      id: index * 2,
      key: pair.key,
      label: pair.label,
      Icon: pair.Icon,
      matched: false,
    },
    {
      id: index * 2 + 1,
      key: pair.key,
      label: pair.label,
      Icon: pair.Icon,
      matched: false,
    },
  ])

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function MemoryGame({ onBack }: MemoryGameProps) {
  const titleId = useId()
  const [cards, setCards] = useState<Card[]>(() => shuffleCards())
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [locked, setLocked] = useState(false)

  const won = useMemo(() => cards.every((card) => card.matched), [cards])
  const trackedWin = useRef(false)

  useEffect(() => {
    if (!won || trackedWin.current) return
    trackedWin.current = true
    trackEvent('game_complete', { game: 'memory', moves })
  }, [won, moves])

  useEffect(() => {
    if (flipped.length !== 2) return

    const [a, b] = flipped
    setLocked(true)
    setMoves((m) => m + 1)

    const timer = window.setTimeout(() => {
      setCards((prev) => {
        if (prev[a].key === prev[b].key) {
          return prev.map((card, index) =>
            index === a || index === b ? { ...card, matched: true } : card,
          )
        }
        return prev
      })
      setFlipped([])
      setLocked(false)
    }, 520)

    return () => window.clearTimeout(timer)
  }, [flipped])

  function flipCard(index: number) {
    if (locked || won) return
    if (cards[index].matched) return
    if (flipped.includes(index)) return
    if (flipped.length >= 2) return
    setFlipped((prev) => [...prev, index])
  }

  function reset() {
    trackedWin.current = false
    setCards(shuffleCards())
    setFlipped([])
    setMoves(0)
    setLocked(false)
    trackEvent('new_game', { game: 'memory' })
  }

  return (
    <div className="game-view" role="region" aria-labelledby={titleId}>
      <header className="game-view-header">
        <button type="button" className="game-back" onClick={onBack}>
          Games
        </button>
        <h3 id={titleId}>Memory Match</h3>
        <button type="button" className="game-action" onClick={reset}>
          New
        </button>
      </header>

      <p className="game-help">
        Flip two cards at a time. Match every pair in as few moves as you can.
      </p>

      <p className="memory-stats" aria-live="polite">
        Moves: <strong>{moves}</strong>
        {won && <span className="memory-win"> · Cleared!</span>}
      </p>

      <div className="memory-grid" role="grid" aria-label="Memory cards">
        {cards.map((card, index) => {
          const isFaceUp = card.matched || flipped.includes(index)
          const Icon = card.Icon
          return (
            <button
              type="button"
              key={card.id}
              className={`memory-card${isFaceUp ? ' face-up' : ''}${
                card.matched ? ' matched' : ''
              }`}
              onClick={() => flipCard(index)}
              disabled={locked || card.matched || won}
              aria-label={
                isFaceUp ? `${card.label} card` : `Hidden card ${index + 1}`
              }
            >
              <span className="memory-face memory-back" aria-hidden="true">
                <Question size={22} weight="bold" />
              </span>
              <span className="memory-face memory-front" aria-hidden="true">
                <Icon size={26} weight="duotone" />
              </span>
            </button>
          )
        })}
      </div>

      {won && (
        <div className="game-win memory-win-banner" role="status">
          <p className="game-win-title">Nice work</p>
          <p className="game-win-note">You cleared the board in {moves} moves.</p>
          <button type="button" className="game-primary" onClick={reset}>
            Play again
          </button>
        </div>
      )}
    </div>
  )
}
