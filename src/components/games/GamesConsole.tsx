import { GameController } from '@phosphor-icons/react'
import { useEffect, useId, useState } from 'react'
import { SudokuGame } from './SudokuGame'
import { MemoryGame } from './MemoryGame'

type GameId = 'sudoku' | 'memory'

type GamesConsoleProps = {
  open: boolean
  onToggle: () => void
  onClose: () => void
}

const GAMES: { id: GameId; title: string; blurb: string }[] = [
  {
    id: 'sudoku',
    title: 'Sudoku',
    blurb: 'Fill the grid. Unfinished boards save on this device.',
  },
  {
    id: 'memory',
    title: 'Memory Match',
    blurb: 'Find every pair. A quick break between meetings.',
  },
]

export function GamesFab({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`games-fab${open ? ' open' : ''}`}
      onClick={onToggle}
      aria-label={open ? 'Close game console' : 'Open game console'}
      aria-expanded={open}
    >
      <GameController size={22} weight="fill" aria-hidden />
    </button>
  )
}

export function GamesConsole({ open, onToggle, onClose }: GamesConsoleProps) {
  const titleId = useId()
  const [activeGame, setActiveGame] = useState<GameId | null>(null)

  useEffect(() => {
    if (!open) {
      setActiveGame(null)
      return
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (activeGame) setActiveGame(null)
        else onClose()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, activeGame])

  return (
    <>
      <GamesFab open={open} onToggle={onToggle} />

      {open && (
        <div className="games-root">
          <button
            type="button"
            className="games-backdrop"
            aria-label="Close game console"
            onClick={onClose}
          />
          <aside
            className="games-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            {activeGame === 'sudoku' ? (
              <SudokuGame onBack={() => setActiveGame(null)} />
            ) : activeGame === 'memory' ? (
              <MemoryGame onBack={() => setActiveGame(null)} />
            ) : (
              <>
                <header className="games-header">
                  <h2 id={titleId}>Game console</h2>
                  <button type="button" className="settings-close" onClick={onClose}>
                    Close
                  </button>
                </header>
                <p className="games-intro">
                  Pick a quick game for a break. Sudoku keeps your spot if you
                  leave mid-puzzle.
                </p>
                <ul className="games-list">
                  {GAMES.map((game) => (
                    <li key={game.id}>
                      <button
                        type="button"
                        className="games-pick"
                        onClick={() => setActiveGame(game.id)}
                      >
                        <span className="games-pick-title">{game.title}</span>
                        <span className="games-pick-blurb">{game.blurb}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
