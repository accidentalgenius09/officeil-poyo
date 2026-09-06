import { GameController } from '@phosphor-icons/react'
import { useEffect, useId, useState } from 'react'
import { trackEvent } from '../../lib/analytics'
import {
  gameRewardThemeLabel,
  type GameRewardTheme,
} from '../../lib/rewards'
import { SudokuGame } from './SudokuGame'
import { MemoryGame } from './MemoryGame'
import { Game2048 } from './Game2048'

type GameId = 'sudoku' | 'memory' | '2048'

type GamesConsoleProps = {
  open: boolean
  onToggle: () => void
  onClose: () => void
  rewardTheme?: GameRewardTheme
  rewardCount?: number
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
  {
    id: '2048',
    title: '2048',
    blurb: 'Swipe or use arrows. Merge tiles up to 2048.',
  },
]

export function GamesFab({
  open,
  onToggle,
  rewardTheme = 'default',
}: {
  open: boolean
  onToggle: () => void
  rewardTheme?: GameRewardTheme
}) {
  return (
    <button
      type="button"
      className={`games-fab${open ? ' open' : ''}${rewardTheme !== 'default' ? ` theme-${rewardTheme}` : ''}`}
      onClick={onToggle}
      aria-label={open ? 'Close game console' : 'Open game console'}
      aria-expanded={open}
    >
      <GameController size={22} weight="fill" aria-hidden />
    </button>
  )
}

export function GamesConsole({
  open,
  onToggle,
  onClose,
  rewardTheme = 'default',
  rewardCount = 0,
}: GamesConsoleProps) {
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
      <GamesFab open={open} onToggle={onToggle} rewardTheme={rewardTheme} />

      {open && (
        <div className="games-root">
          <button
            type="button"
            className="games-backdrop"
            aria-label="Close game console"
            onClick={onClose}
          />
          <aside
            className={`games-panel${rewardTheme !== 'default' ? ` theme-${rewardTheme}` : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            {activeGame === 'sudoku' ? (
              <SudokuGame onBack={() => setActiveGame(null)} />
            ) : activeGame === 'memory' ? (
              <MemoryGame onBack={() => setActiveGame(null)} />
            ) : activeGame === '2048' ? (
              <Game2048 onBack={() => setActiveGame(null)} />
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
                {rewardCount > 0 ? (
                  <p className="games-reward-note">
                    Reward unlocked: {gameRewardThemeLabel(rewardTheme)}
                    {rewardCount >= 3
                      ? ' (3+ badges this year)'
                      : ' (from this year’s goal badges)'}
                  </p>
                ) : (
                  <p className="games-reward-note muted">
                    Hit a monthly office goal this year to unlock a gold console
                    theme. Themes reset each calendar year.
                  </p>
                )}
                <ul className="games-list">
                  {GAMES.map((game) => (
                    <li key={game.id}>
                      <button
                        type="button"
                        className="games-pick"
                        onClick={() => {
                          setActiveGame(game.id)
                          trackEvent('play_game', { game: game.id })
                        }}
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
