const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SHIP_STATUSES = new Set(["ship", "hit"]);

function createBoard() {
  const board = [];

  for (const row of ROWS) {
    for (const col of COLS) {
      board.push({
        row: row,
        col: col,
        status: "empty"
      });
    }
  }

  return board;
}

function placeShip(board, row, col, size, direction) {
  const shipCells = calculateShipCells(row, Number(col), Number(size), direction);

  if (!shipCells.length) {
    return {
      success: false,
      message: "Неможливо визначити клітинки корабля"
    };
  }

  for (const shipCell of shipCells) {
    const cell = findCell(board, shipCell.row, shipCell.col);

    if (!cell) {
      return {
        success: false,
        message: "Корабель виходить за межі поля"
      };
    }

    if (cell.status !== "empty") {
      return {
        success: false,
        message: "Корабель перетинається з іншим кораблем"
      };
    }
  }

  for (const shipCell of shipCells) {
    if (hasShipNearby(board, shipCell.row, shipCell.col, shipCells)) {
      return {
        success: false,
        message: "Кораблі не можуть торкатися один одного навіть кутами"
      };
    }
  }

  for (const shipCell of shipCells) {
    const cell = findCell(board, shipCell.row, shipCell.col);
    cell.status = "ship";
  }

  return {
    success: true,
    cells: shipCells
  };
}

function removeShip(board, row, col) {
  const cell = findCell(board, row, Number(col));

  if (!cell || cell.status !== "ship") {
    return {
      success: false,
      message: "На цій клітинці немає корабля"
    };
  }

  const shipCells = findWholeShip(board, row, Number(col));

  for (const shipCell of shipCells) {
    const boardCell = findCell(board, shipCell.row, shipCell.col);

    if (boardCell) {
      boardCell.status = "empty";
    }
  }

  return {
    success: true,
    cells: shipCells,
    size: shipCells.length
  };
}

function calculateShipCells(row, col, size, direction) {
  const rowIndex = ROWS.indexOf(row);

  if (rowIndex === -1 || col < 1 || col > 10 || size < 1 || size > 4) {
    return [];
  }

  const cells = [];

  for (let i = 0; i < size; i++) {
    const nextRowIndex = direction === "vertical" ? rowIndex + i : rowIndex;
    const nextCol = direction === "vertical" ? col : col + i;
    const nextRow = ROWS[nextRowIndex];

    cells.push({
      row: nextRow,
      col: nextCol
    });
  }

  return cells;
}

function hasShipNearby(board, row, col, currentShipCells) {
  const rowIndex = ROWS.indexOf(row);
  const currentShipKeys = new Set(currentShipCells.map(function (cell) {
    return createCellKey(cell.row, cell.col);
  }));

  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      const neighborRow = ROWS[rowIndex + rowOffset];
      const neighborCol = Number(col) + colOffset;

      if (!neighborRow || neighborCol < 1 || neighborCol > 10) {
        continue;
      }

      if (currentShipKeys.has(createCellKey(neighborRow, neighborCol))) {
        continue;
      }

      const neighborCell = findCell(board, neighborRow, neighborCol);

      if (neighborCell && neighborCell.status === "ship") {
        return true;
      }
    }
  }

  return false;
}

function createCellKey(row, col) {
  return `${row}-${col}`;
}

function checkShot(board, row, col) {
  const cell = findCell(board, row, col);

  if (!cell) {
    return {
      result: "miss",
      sunkCells: [],
      zoneCells: []
    };
  }

  if (cell.status === "hit" || cell.status === "sunk" || cell.status === "miss" || cell.status === "sunk-zone") {
    return {
      result: "already",
      sunkCells: [],
      zoneCells: []
    };
  }

  if (cell.status === "ship") {
    cell.status = "hit";

    const shipCells = findWholeShip(board, row, Number(col));
    const isSunk = shipCells.every(function (shipCell) {
      const boardCell = findCell(board, shipCell.row, shipCell.col);
      return boardCell && boardCell.status === "hit";
    });

    if (!isSunk) {
      return {
        result: "hit",
        sunkCells: [],
        zoneCells: []
      };
    }

    markShipAsSunk(board, shipCells);
    const zoneCells = markSunkShipZone(board, shipCells);

    return {
      result: "sunk",
      sunkCells: shipCells,
      zoneCells: zoneCells
    };
  }

  cell.status = "miss";

  return {
    result: "miss",
    sunkCells: [],
    zoneCells: []
  };
}

function findWholeShip(board, row, col) {
  const horizontalCells = collectLineCells(board, row, col, 0, -1)
    .reverse()
    .concat([{ row: row, col: Number(col) }], collectLineCells(board, row, col, 0, 1));

  if (horizontalCells.length > 1) {
    return horizontalCells;
  }

  const verticalCells = collectLineCells(board, row, col, -1, 0)
    .reverse()
    .concat([{ row: row, col: Number(col) }], collectLineCells(board, row, col, 1, 0));

  return verticalCells;
}

function collectLineCells(board, row, col, rowStep, colStep) {
  const cells = [];
  let rowIndex = ROWS.indexOf(row) + rowStep;
  let nextCol = Number(col) + colStep;

  while (rowIndex >= 0 && rowIndex < ROWS.length && nextCol >= 1 && nextCol <= 10) {
    const nextRow = ROWS[rowIndex];
    const cell = findCell(board, nextRow, nextCol);

    if (!cell || !SHIP_STATUSES.has(cell.status)) {
      break;
    }

    cells.push({
      row: nextRow,
      col: nextCol
    });

    rowIndex += rowStep;
    nextCol += colStep;
  }

  return cells;
}

function markShipAsSunk(board, shipCells) {
  for (const shipCell of shipCells) {
    const boardCell = findCell(board, shipCell.row, shipCell.col);

    if (boardCell) {
      boardCell.status = "sunk";
    }
  }
}

function markSunkShipZone(board, shipCells) {
  const zoneCells = [];
  const shipKeys = new Set(shipCells.map(function (shipCell) {
    return createCellKey(shipCell.row, shipCell.col);
  }));
  const zoneKeys = new Set();

  for (const shipCell of shipCells) {
    const rowIndex = ROWS.indexOf(shipCell.row);

    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        const neighborRow = ROWS[rowIndex + rowOffset];
        const neighborCol = Number(shipCell.col) + colOffset;
        const key = createCellKey(neighborRow, neighborCol);

        if (!neighborRow || neighborCol < 1 || neighborCol > 10) {
          continue;
        }

        if (shipKeys.has(key) || zoneKeys.has(key)) {
          continue;
        }

        const neighborCell = findCell(board, neighborRow, neighborCol);

        if (!neighborCell || neighborCell.status !== "empty") {
          continue;
        }

        neighborCell.status = "sunk-zone";
        zoneKeys.add(key);
        zoneCells.push({
          row: neighborRow,
          col: neighborCol
        });
      }
    }
  }

  return zoneCells;
}


function scanArea(board, row, col) {
  const centerRowIndex = ROWS.indexOf(row);
  const centerCol = Number(col);
  const cells = [];

  if (centerRowIndex === -1 || centerCol < 1 || centerCol > 10) {
    return cells;
  }

  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      const nextRow = ROWS[centerRowIndex + rowOffset];
      const nextCol = centerCol + colOffset;

      if (!nextRow || nextCol < 1 || nextCol > 10) {
        continue;
      }

      const cell = findCell(board, nextRow, nextCol);

      if (cell && cell.status === "ship") {
        cells.push({
          row: nextRow,
          col: nextCol
        });
      }
    }
  }

  return cells;
}

function fireTorpedoBomber(board, row) {
  const pathCells = [];

  if (ROWS.indexOf(row) === -1) {
    return {
      result: "miss",
      pathCells: [],
      sunkCells: [],
      zoneCells: []
    };
  }

  for (const col of COLS) {
    const cell = findCell(board, row, col);

    if (!cell) {
      continue;
    }

    if (cell.status === "ship") {
      const shotResult = checkShot(board, row, col);

      pathCells.push({
        row: row,
        col: col,
        result: shotResult.result
      });

      return {
        result: shotResult.result,
        pathCells: pathCells,
        sunkCells: shotResult.sunkCells || [],
        zoneCells: shotResult.zoneCells || []
      };
    }

    if (cell.status === "empty") {
      cell.status = "miss";
      pathCells.push({
        row: row,
        col: col,
        result: "miss"
      });
    }
  }

  return {
    result: "miss",
    pathCells: pathCells,
    sunkCells: [],
    zoneCells: []
  };
}

function findCell(board, row, col) {
  return board.find(function (cell) {
    return cell.row === row && cell.col === Number(col);
  });
}

function getShipsForClient(board) {
  return board
    .filter(function (cell) {
      return cell.status === "ship";
    })
    .map(function (cell) {
      return {
        row: cell.row,
        col: cell.col
      };
    });
}

function isAllShipsDestroyed(board) {
  return board.every(function (cell) {
    return cell.status !== "ship";
  });
}

module.exports = {
  createBoard,
  placeShip,
  removeShip,
  checkShot,
  scanArea,
  fireTorpedoBomber,
  getShipsForClient,
  isAllShipsDestroyed
};
