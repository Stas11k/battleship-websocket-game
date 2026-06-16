const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const SHIPS_CONFIG = {
  4: 1,
  3: 2,
  2: 3,
  1: 4
};

function createBoard() {
  const board = {};

  for (const row of ROWS) {
    board[row] = {};

    for (const col of COLS) {
      board[row][col] = {
        hasShip: false,
        hit: false,
        shipId: null
      };
    }
  }

  return board;
}

function createPlayerState() {
  return {
    board: createBoard(),
    ships: [],
    shipsPlaced: {
      4: 0,
      3: 0,
      2: 0,
      1: 0
    },
    ready: false
  };
}

function placeShip(playerState, row, col, size, direction) {
  if (!SHIPS_CONFIG[size]) {
    return {
      success: false,
      message: "Invalid ship size"
    };
  }

  if (playerState.shipsPlaced[size] >= SHIPS_CONFIG[size]) {
    return {
      success: false,
      message: "No ships of this size left"
    };
  }

  const cells = calculateShipCells(row, col, size, direction);

  if (!cells) {
    return {
      success: false,
      message: "Invalid ship position"
    };
  }

  if (!canPlaceShip(playerState.board, cells)) {
    return {
      success: false,
      message: "Ship cannot be placed here"
    };
  }

  const shipId = `ship-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  for (const cell of cells) {
    playerState.board[cell.row][cell.col].hasShip = true;
    playerState.board[cell.row][cell.col].shipId = shipId;
  }

  playerState.ships.push({
    id: shipId,
    size: size,
    cells: cells,
    sunk: false
  });

  playerState.shipsPlaced[size] += 1;
  playerState.ready = isFleetComplete(playerState);

  return {
    success: true,
    shipId: shipId,
    cells: cells,
    ready: playerState.ready
  };
}

function calculateShipCells(row, col, size, direction) {
  const rowIndex = ROWS.indexOf(row);
  const colIndex = COLS.indexOf(Number(col));

  if (rowIndex === -1 || colIndex === -1) {
    return null;
  }

  const cells = [];

  for (let i = 0; i < size; i++) {
    let nextRowIndex = rowIndex;
    let nextColIndex = colIndex;

    if (direction === "horizontal") {
      nextColIndex += i;
    } else if (direction === "vertical") {
      nextRowIndex += i;
    } else {
      return null;
    }

    if (nextRowIndex < 0 || nextRowIndex >= ROWS.length) {
      return null;
    }

    if (nextColIndex < 0 || nextColIndex >= COLS.length) {
      return null;
    }

    cells.push({
      row: ROWS[nextRowIndex],
      col: COLS[nextColIndex]
    });
  }

  return cells;
}

function canPlaceShip(board, cells) {
  for (const cell of cells) {
    if (board[cell.row][cell.col].hasShip) {
      return false;
    }

    const neighbours = getNeighbourCells(cell.row, cell.col);

    for (const neighbour of neighbours) {
      if (board[neighbour.row][neighbour.col].hasShip) {
        return false;
      }
    }
  }

  return true;
}

function getNeighbourCells(row, col) {
  const rowIndex = ROWS.indexOf(row);
  const colIndex = COLS.indexOf(Number(col));

  const neighbours = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      const nextRowIndex = rowIndex + rowOffset;
      const nextColIndex = colIndex + colOffset;

      if (nextRowIndex < 0 || nextRowIndex >= ROWS.length) {
        continue;
      }

      if (nextColIndex < 0 || nextColIndex >= COLS.length) {
        continue;
      }

      neighbours.push({
        row: ROWS[nextRowIndex],
        col: COLS[nextColIndex]
      });
    }
  }

  return neighbours;
}

function isFleetComplete(playerState) {
  return Object.keys(SHIPS_CONFIG).every(function (size) {
    return playerState.shipsPlaced[size] === SHIPS_CONFIG[size];
  });
}

module.exports = {
  ROWS,
  COLS,
  SHIPS_CONFIG,
  createPlayerState,
  placeShip,
  calculateShipCells,
  isFleetComplete
};