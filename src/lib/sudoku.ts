export type SudokuGrid = number[][]

export type SudokuSave = {
  puzzle: SudokuGrid
  board: SudokuGrid
}

const STORAGE_KEY = 'officeil-sudoku-v1'
const SIZE = 9
const BOX = 3

function emptyGrid(): SudokuGrid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function cloneGrid(grid: SudokuGrid): SudokuGrid {
  return grid.map((row) => [...row])
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function isValid(grid: SudokuGrid, row: number, col: number, num: number): boolean {
  for (let i = 0; i < SIZE; i += 1) {
    if (grid[row][i] === num || grid[i][col] === num) return false
  }

  const boxRow = Math.floor(row / BOX) * BOX
  const boxCol = Math.floor(col / BOX) * BOX
  for (let r = 0; r < BOX; r += 1) {
    for (let c = 0; c < BOX; c += 1) {
      if (grid[boxRow + r][boxCol + c] === num) return false
    }
  }
  return true
}

function fillGrid(grid: SudokuGrid): boolean {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (grid[row][col] !== 0) continue

      for (const num of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (!isValid(grid, row, col, num)) continue
        grid[row][col] = num
        if (fillGrid(grid)) return true
        grid[row][col] = 0
      }
      return false
    }
  }
  return true
}

function countSolutions(grid: SudokuGrid, limit = 2): number {
  let count = 0

  function solve(): boolean {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (grid[row][col] !== 0) continue

        for (let num = 1; num <= SIZE; num += 1) {
          if (!isValid(grid, row, col, num)) continue
          grid[row][col] = num
          if (solve()) return true
          grid[row][col] = 0
        }
        return false
      }
    }
    count += 1
    return count >= limit
  }

  solve()
  return count
}

/** Create a fresh medium-difficulty puzzle. Board is shuffled each time. */
export function generateSudoku(clueTarget = 38): SudokuGrid {
  const solution = emptyGrid()
  fillGrid(solution)

  const puzzle = cloneGrid(solution)
  const cells = shuffle(
    Array.from({ length: SIZE * SIZE }, (_, i) => ({
      row: Math.floor(i / SIZE),
      col: i % SIZE,
    })),
  )

  let clues = SIZE * SIZE
  for (const { row, col } of cells) {
    if (clues <= clueTarget) break
    const backup = puzzle[row][col]
    puzzle[row][col] = 0

    // Cheap uniqueness probe — skip expensive full searches most of the time
    if (clues <= clueTarget + 12) {
      const probe = cloneGrid(puzzle)
      if (countSolutions(probe) !== 1) {
        puzzle[row][col] = backup
        continue
      }
    }
    clues -= 1
  }

  return puzzle
}

export function isComplete(board: SudokuGrid): boolean {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = board[row][col]
      if (value < 1 || value > 9) return false
      board[row][col] = 0
      const ok = isValid(board, row, col, value)
      board[row][col] = value
      if (!ok) return false
    }
  }
  return true
}

export function hasConflict(
  board: SudokuGrid,
  row: number,
  col: number,
): boolean {
  const value = board[row][col]
  if (value === 0) return false
  board[row][col] = 0
  const ok = isValid(board, row, col, value)
  board[row][col] = value
  return !ok
}

export function loadSudokuSave(): SudokuSave | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SudokuSave
    if (
      !Array.isArray(parsed.puzzle) ||
      !Array.isArray(parsed.board) ||
      parsed.puzzle.length !== SIZE ||
      parsed.board.length !== SIZE
    ) {
      return null
    }
    return {
      puzzle: parsed.puzzle.map((row) => [...row]),
      board: parsed.board.map((row) => [...row]),
    }
  } catch {
    return null
  }
}

export function saveSudokuProgress(save: SudokuSave): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
}

export function clearSudokuSave(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function startSudoku(): SudokuSave {
  const puzzle = generateSudoku()
  return { puzzle, board: cloneGrid(puzzle) }
}
