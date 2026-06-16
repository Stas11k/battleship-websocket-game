let myBoardPivot = null;
let enemyBoardPivot = null;

let myBoardData = createEmptyBoard();
let enemyBoardData = createEmptyBoard();

const CELL_SIZE = 34;
const BOARD_WIDTH = 551;
const BOARD_HEIGHT = 400;
const VISIBLE_COLUMNS_COUNT = 11;
const VISIBLE_ROWS_COUNT = 12;

window.addEventListener("DOMContentLoaded", function () {
  initBoards();
});

function prepareBoardContainer(selector) {
  const board = document.querySelector(selector);

  if (!board) {
    return;
  }

  board.style.width = `${BOARD_WIDTH}px`;
  board.style.height = `${BOARD_HEIGHT}px`;
  board.style.overflow = "hidden";
  board.style.cursor = "pointer";
}

function initBoards() {
  prepareBoardContainer("#myBoard");
  prepareBoardContainer("#enemyBoard");

  myBoardPivot = new WebDataRocks({
    container: "#myBoard",
    toolbar: false,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    report: createBoardReport(myBoardData),
    customizeCell: customizeBoardCell,
    reportcomplete: function () {
      addMyBoardClickHandler();
    }
  });

  enemyBoardPivot = new WebDataRocks({
    container: "#enemyBoard",
    toolbar: false,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    report: createBoardReport(enemyBoardData),
    customizeCell: customizeBoardCell,
    reportcomplete: function () {
      addEnemyBoardClickHandler();
    }
  });
}

function createBoardReport(data) {
  return {
    dataSource: {
      data: cloneBoardData(data)
    },
    slice: {
      rows: [
        { uniqueName: "row", caption: " " },
        { uniqueName: "col1", caption: "1" },
        { uniqueName: "col2", caption: "2" },
        { uniqueName: "col3", caption: "3" },
        { uniqueName: "col4", caption: "4" },
        { uniqueName: "col5", caption: "5" },
        { uniqueName: "col6", caption: "6" },
        { uniqueName: "col7", caption: "7" },
        { uniqueName: "col8", caption: "8" },
        { uniqueName: "col9", caption: "9" },
        { uniqueName: "col10", caption: "10" }
      ]
    },
    tableSizes: createBoardTableSizes(),
    options: {
      configuratorButton: false,
      configuratorActive: false,
      sorting: "off",
      drillThrough: false,
      grid: {
        type: "flat",
        showTotals: "off",
        showGrandTotals: "off",
        showFilter: false,
        showHeaders: false
      }
    }
  };
}

function createBoardTableSizes() {
  return {
    columns: Array.from({ length: VISIBLE_COLUMNS_COUNT }, function (_, index) {
      return {
        idx: index,
        width: CELL_SIZE
      };
    }),
    rows: Array.from({ length: VISIBLE_ROWS_COUNT }, function (_, index) {
      return {
        idx: index,
        height: CELL_SIZE
      };
    })
  };
}

function customizeBoardCell(cellBuilder, cellData) {
  const value = String(cellData.label || "").trim();

  if (value === "empty") {
    cellBuilder.text = "";
    cellBuilder.addClass("battle-cell");
    cellBuilder.addClass("battle-cell-empty");
  }

  if (value === "ship") {
    cellBuilder.text = "";
    cellBuilder.addClass("battle-cell");
    cellBuilder.addClass("battle-cell-ship");
  }

  if (value === "hit") {
    cellBuilder.text = "";
    cellBuilder.addClass("battle-cell");
    cellBuilder.addClass("battle-cell-hit");
  }

  if (value === "miss") {
    cellBuilder.text = "";
    cellBuilder.addClass("battle-cell");
    cellBuilder.addClass("battle-cell-miss");
  }
}

function cloneBoardData(data) {
  return data.map(function (rowItem) {
    return Object.assign({}, rowItem);
  });
}

function getBoardCellValue(boardType, row, col) {
  const boardData = boardType === "me" ? myBoardData : enemyBoardData;

  const rowItem = boardData.find(function (item) {
    return item.row === row;
  });

  if (!rowItem) {
    return "empty";
  }

  return rowItem[`col${col}`] || "empty";
}

function updateBoardCell(boardType, row, col, value, shouldRefresh = true) {
  const boardData = boardType === "me" ? myBoardData : enemyBoardData;

  const rowItem = boardData.find(function (item) {
    return item.row === row;
  });

  if (!rowItem) {
    return;
  }

  rowItem[`col${col}`] = getCellState(value);

  if (shouldRefresh) {
    refreshBoard(boardType);
  }
}

function refreshBoard(boardType) {
  if (boardType === "me") {
    myBoardPivot.setReport(createBoardReport(myBoardData));
  } else {
    enemyBoardPivot.setReport(createBoardReport(enemyBoardData));
  }
}

function getCoordinateFromCell(cell) {
  const rowIndex = Number(cell.rowIndex);
  const columnIndex = Number(cell.columnIndex);

  const row = ROWS[rowIndex - 1];
  const col = columnIndex;

  if (!row) {
    return null;
  }

  if (col < 1 || col > 10) {
    return null;
  }

  return {
    row: row,
    col: col
  };
}

function addMyBoardClickHandler() {
  if (!myBoardPivot) {
    return;
  }

  myBoardPivot.off("cellclick");

  myBoardPivot.on("cellclick", function (cell) {
    const coordinate = getCoordinateFromCell(cell);

    if (!coordinate) {
      return;
    }

    handleMyBoardCellClick(coordinate.row, coordinate.col);
  });
}

function addEnemyBoardClickHandler() {
  if (!enemyBoardPivot) {
    return;
  }

  enemyBoardPivot.off("cellclick");

  enemyBoardPivot.on("cellclick", function (cell) {
    const coordinate = getCoordinateFromCell(cell);

    if (!coordinate) {
      return;
    }

    handleEnemyBoardCellClick(coordinate.row, coordinate.col);
  });
}