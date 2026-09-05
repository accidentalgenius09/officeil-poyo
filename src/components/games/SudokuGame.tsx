import { useEffect, useId, useRef, useState } from 'react'
import {
  clearSudokuSave,
  hasConflict,
  isComplete,
  loadSudokuSave,
  saveSudokuProgress,
  startSudoku,
} from '../../lib/sudoku'
import { trackEvent } from '../../lib/analytics'

type SudokuGameProps = {
  onBack: () => void
}

function createInitialState() {
  const saved = loadSudokuSave()
  if (saved) return { ...saved, won: false }
  const fresh = startSudoku()
  saveSudokuProgress(fresh)
  return { ...fresh, won: false }
}

export function SudokuGame({ onBack }: SudokuGameProps) {
  const titleId = useId()
  const [state, setState] = useState(createInitialState)
  const { puzzle, board, won } = state
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(
    null,
  )

  const trackedWin = useRef(false)

  useEffect(() => {
    if (won) return
    saveSudokuProgress({ puzzle, board })
  }, [puzzle, board, won])

  useEffect(() => {
    if (!won || trackedWin.current) return
    trackedWin.current = true
    trackEvent('game_complete', { game: 'sudoku' })
  }, [won])

  function placeNumber(num: number) {
    if (!selected || won) return
    const { row, col } = selected
    if (puzzle[row][col] !== 0) return

    setState((prev) => {
      const nextBoard = prev.board.map((r) => [...r])
      nextBoard[row][col] = num
      if (isComplete(nextBoard)) {
        clearSudokuSave()
        return { ...prev, board: nextBoard, won: true }
      }
      return { ...prev, board: nextBoard }
    })
  }

  function clearCell() {
    if (!selected || won) return
    const { row, col } = selected
    if (puzzle[row][col] !== 0) return
    setState((prev) => {
      const nextBoard = prev.board.map((r) => [...r])
      nextBoard[row][col] = 0
      return { ...prev, board: nextBoard }
    })
  }

  function newGame() {
    clearSudokuSave()
    const fresh = startSudoku()
    setSelected(null)
    trackedWin.current = false
    setState({ ...fresh, won: false })
    saveSudokuProgress(fresh)
    trackEvent('new_game', { game: 'sudoku' })
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key >= '1' && event.key <= '9') {
        placeNumber(Number(event.key))
      } else if (
        event.key === 'Backspace' ||
        event.key === 'Delete' ||
        event.key === '0'
      ) {
        clearCell()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game-view" role="region" aria-labelledby={titleId}>
      <header className="game-view-header">
        <button type="button" className="game-back" onClick={onBack}>
          Games
        </button>
        <h3 id={titleId}>Sudoku</h3>
        <button type="button" className="game-action" onClick={newGame}>
          New
        </button>
      </header>

      {won ? (
        <div className="game-win" role="status">
          <p className="game-win-title">Puzzle complete</p>
          <p className="game-win-note">
            Progress cleared. Start a fresh board whenever you like.
          </p>
          <button type="button" className="game-primary" onClick={newGame}>
            Play again
          </button>
        </div>
      ) : (
        <p className="game-help">
          Progress saves on this device until you finish. Tap a cell, then a
          number.
        </p>
      )}

      <div className="sudoku-board" role="grid" aria-label="Sudoku board">
        {board.map((row, rowIndex) => (
          <div className="sudoku-row" role="row" key={rowIndex}>
            {row.map((value, colIndex) => {
              const clue = puzzle[rowIndex][colIndex] !== 0
              const isSelected =
                selected?.row === rowIndex && selected?.col === colIndex
              const conflict =
                !clue && value !== 0 && hasConflict(board, rowIndex, colIndex)
              const boxEdgeRight = colIndex % 3 === 2 && colIndex !== 8
              const boxEdgeBottom = rowIndex % 3 === 2 && rowIndex !== 8

              return (
                <button
                  type="button"
                  role="gridcell"
                  key={`${rowIndex}-${colIndex}`}
                  className={[
                    'sudoku-cell',
                    clue ? 'clue' : '',
                    isSelected ? 'selected' : '',
                    conflict ? 'conflict' : '',
                    boxEdgeRight ? 'box-right' : '',
                    boxEdgeBottom ? 'box-bottom' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelected({ row: rowIndex, col: colIndex })}
                  disabled={won}
                  aria-label={`Row ${rowIndex + 1} column ${colIndex + 1}${
                    value ? `, ${value}` : ', empty'
                  }`}
                >
                  {value || ''}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {!won && (
        <div className="sudoku-pad" aria-label="Number pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              type="button"
              key={num}
              className="sudoku-pad-btn"
              onClick={() => placeNumber(num)}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className="sudoku-pad-btn clear"
            onClick={clearCell}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
