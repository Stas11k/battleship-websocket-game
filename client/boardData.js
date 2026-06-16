const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function createEmptyBoard() {
  const data = [];

  for (const row of ROWS) {
    const rowItem = {
      row: row
    };

    for (const col of COLS) {
      rowItem[`col${col}`] = "empty";
    }

    data.push(rowItem);
  }

  return data;
}

function getCellState(value) {
  switch (value) {
    case "ship":
      return "ship";

    case "hit":
      return "hit";

    case "miss":
      return "miss";

    default:
      return "empty";
  }
}