import { useEffect, useId, useRef, useState } from 'react'
import { trackEvent } from '../../lib/analytics'

type Game2048Props = {
  onBack: () => void
}

const SIZE = 4

function emptyBoard(): number[][] {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row])
}

function emptyCells(board: number[][]): [number, number][] {
  const cells: [number, number][] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c])
    }
  }
  return cells
}

function addRandomTile(board: number[][]): number[][] {
  const next = cloneBoard(board)
  const cells = emptyCells(next)
  if (cells.length === 0) return next
  const [r, c] = cells[Math.floor(Math.random() * cells.length)]
  next[r][c] = Math.random() < 0.9 ? 2 : 4
  return next
}

function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const filtered = row.filter((n) => n !== 0)
  const merged: number[] = []
  let gained = 0
  let i = 0
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const value = filtered[i] * 2
      merged.push(value)
      gained += value
      i += 2
    } else {
      merged.push(filtered[i])
      i += 1
    }
  }
  while (merged.length < SIZE) merged.push(0)
  return { row: merged, gained }
}

function boardsEqual(a: number[][], b: number[][]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false
    }
  }
  return true
}

function rotate(board: number[][]): number[][] {
  const next = emptyBoard()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      next[c][SIZE - 1 - r] = board[r][c]
    }
  }
  return next
}

function move(
  board: number[][],
  direction: 'left' | 'right' | 'up' | 'down',
): { board: number[][]; gained: number; moved: boolean } {
  let working = cloneBoard(board)
  let rotations = 0
  if (direction === 'up') rotations = 3
  else if (direction === 'right') rotations = 2
  else if (direction === 'down') rotations = 1

  for (let i = 0; i < rotations; i++) working = rotate(working)

  let gained = 0
  const slid = working.map((row) => {
    const result = slideRowLeft(row)
    gained += result.gained
    return result.row
  })

  let restored = slid
  for (let i = 0; i < (4 - rotations) % 4; i++) restored = rotate(restored)

  return {
    board: restored,
    gained,
    moved: !boardsEqual(board, restored),
  }
}

function canMove(board: number[][]): boolean {
  if (emptyCells(board).length > 0) return true
  for (const dir of ['left', 'right', 'up', 'down'] as const) {
    if (move(board, dir).moved) return true
  }
  return false
}

function freshGame(): { board: number[][]; score: number } {
  let board = emptyBoard()
  board = addRandomTile(board)
  board = addRandomTile(board)
  return { board, score: 0 }
}

export function Game2048({ onBack }: Game2048Props) {
  const titleId = useId()
  const [{ board, score }, setGame] = useState(freshGame)
  const [won, setWon] = useState(false)
  const [over, setOver] = useState(false)
  const trackedWin = useRef(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  function applyMove(direction: 'left' | 'right' | 'up' | 'down') {
    if (over) return
    setGame((prev) => {
      const result = move(prev.board, direction)
      if (!result.moved) return prev
      const withTile = addRandomTile(result.board)
      const nextScore = prev.score + result.gained
      const hit2048 = withTile.some((row) => row.some((n) => n >= 2048))
      if (hit2048) setWon(true)
      if (!canMove(withTile)) setOver(true)
      return { board: withTile, score: nextScore }
    })
  }

  useEffect(() => {
    if (!won || trackedWin.current) return
    trackedWin.current = true
    trackEvent('game_complete', { game: '2048', score })
  }, [won, score])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const map: Record<string, 'left' | 'right' | 'up' | 'down'> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      }
      const dir = map[event.key]
      if (!dir) return
      event.preventDefault()
      applyMove(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function restart() {
    trackedWin.current = false
    setWon(false)
    setOver(false)
    setGame(freshGame())
    trackEvent('new_game', { game: '2048' })
  }

  return (
    <div className="game-2048">
      <header className="games-header">
        <button type="button" className="settings-close" onClick={onBack}>
          Back
        </button>
        <h2 id={titleId}>2048</h2>
        <button type="button" className="settings-close" onClick={restart}>
          New
        </button>
      </header>

      <p className="game-2048-score">Score: {score}</p>
      <p className="games-help">
        Use arrow keys or swipe. Merge tiles to reach 2048.
      </p>

      {(won || over) && (
        <p className={`game-2048-banner${over && !won ? ' lose' : ''}`}>
          {won ? 'You reached 2048!' : 'No moves left'}
        </p>
      )}

      <div
        className="game-2048-board"
        role="grid"
        aria-labelledby={titleId}
        onTouchStart={(e) => {
          const t = e.changedTouches[0]
          touchStart.current = { x: t.clientX, y: t.clientY }
        }}
        onTouchEnd={(e) => {
          if (!touchStart.current) return
          const t = e.changedTouches[0]
          const dx = t.clientX - touchStart.current.x
          const dy = t.clientY - touchStart.current.y
          touchStart.current = null
          if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return
          if (Math.abs(dx) > Math.abs(dy)) {
            applyMove(dx > 0 ? 'right' : 'left')
          } else {
            applyMove(dy > 0 ? 'down' : 'up')
          }
        }}
      >
        {board.map((row, r) =>
          row.map((value, c) => (
            <div
              key={`${r}-${c}`}
              className={`game-2048-tile tile-${value > 2048 ? 'max' : value}`}
              role="gridcell"
            >
              {value || ''}
            </div>
          )),
        )}
      </div>
    </div>
  )
}
