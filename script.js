const boardEl = document.getElementById("board");
const stageNameEl = document.getElementById("stageName");
const moveCountEl = document.getElementById("moveCount");
const selectedInfoEl = document.getElementById("selectedInfo");
const messageEl = document.getElementById("message");
const resetButton = document.getElementById("resetButton");
const modalResetButton = document.getElementById("modalResetButton");
const clearModal = document.getElementById("clearModal");
const clearText = document.getElementById("clearText");

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const STAGES = [
  {
    name: "十字の入口",
    size: 7,
    grid: [
      ["void", "void", "floor", "floor", "floor", "void", "void"],
      ["void", "floor", "floor", "floor", "floor", "floor", "void"],
      ["floor", "floor", "floor", "floor", "floor", "floor", "floor"],
      ["floor", "floor", "floor", "core3", "floor", "floor", "floor"],
      ["floor", "floor", "floor", "floor", "floor", "floor", "floor"],
      ["void", "floor", "floor", "floor", "floor", "floor", "void"],
      ["void", "void", "floor", "floor", "floor", "void", "void"]
    ],
    dice: [
      { id: "A", x: 0, y: 2 },
      { id: "B", x: 6, y: 2 },
      { id: "C", x: 3, y: 6 }
    ]
  }
];

let currentStageIndex = 0;
let grid = [];
let dice = [];
let selectedDiceId = null;
let moveCount = 0;
let pointerStart = null;

function cloneStage(stage) {
  grid = stage.grid.map(row => row.map(cell => {
    if (typeof cell === "string" && cell.startsWith("core")) {
      return {
        type: "core",
        value: Number(cell.replace("core", "")),
        active: false,
        perfect: false
      };
    }

    return { type: cell };
  }));

  dice = stage.dice.map(d => ({ ...d }));
}

function initGame() {
  const stage = STAGES[currentStageIndex];
  cloneStage(stage);
  selectedDiceId = null;
  moveCount = 0;
  clearModal.classList.add("hidden");
  stageNameEl.textContent = stage.name;
  boardEl.style.setProperty("--size", stage.size);
  setMessage("ダイスをタップして選択。スワイプか十字キーで転がそう。");
  render();
}

function render() {
  boardEl.innerHTML = "";
  moveCountEl.textContent = moveCount;

  const selectedCluster = selectedDiceId ? getCluster(selectedDiceId) : [];
  const selectedIds = new Set(selectedCluster.map(d => d.id));

  if (!selectedDiceId) {
    selectedInfoEl.textContent = "なし";
  } else {
    selectedInfoEl.textContent = `${selectedCluster.length}個`;
  }

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const cellData = grid[y][x];
      const cell = document.createElement("div");

      cell.classList.add("cell");
      cell.dataset.x = x;
      cell.dataset.y = y;

      if (cellData.type === "void") {
        cell.classList.add("void");
      }

      if (cellData.type === "floor") {
        cell.classList.add("floor");
      }

      if (cellData.type === "wall") {
        cell.classList.add("wall");
        cell.textContent = "■";
      }

      if (cellData.type === "core") {
        cell.classList.add("core");
        cell.textContent = cellData.value;

        if (cellData.active && cellData.perfect) {
          cell.classList.add("active-perfect");
        } else if (cellData.active) {
          cell.classList.add("active-clear");
        }
      }

      const die = dice.find(d => d.x === x && d.y === y);
      if (die) {
        const dieEl = document.createElement("div");
        dieEl.classList.add("dice");
        dieEl.textContent = "⚂";
        dieEl.dataset.id = die.id;

        if (die.id === selectedDiceId) {
          dieEl.classList.add("selected");
        } else if (selectedIds.has(die.id)) {
          dieEl.classList.add("cluster");
        }

        dieEl.addEventListener("pointerdown", onDicePointerDown);
        dieEl.addEventListener("click", () => selectDice(die.id));

        cell.appendChild(dieEl);
      }

      boardEl.appendChild(cell);
    }
  }
}

function onDicePointerDown(event) {
  const id = event.currentTarget.dataset.id;
  selectDice(id);

  pointerStart = {
    x: event.clientX,
    y: event.clientY
  };

  event.currentTarget.setPointerCapture(event.pointerId);

  event.currentTarget.addEventListener("pointerup", onDicePointerUp, { once: true });
}

function onDicePointerUp(event) {
  if (!pointerStart || !selectedDiceId) return;

  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  const distance = Math.hypot(dx, dy);

  pointerStart = null;

  if (distance < 28) return;

  let dir;

  if (Math.abs(dx) > Math.abs(dy)) {
    dir = dx > 0 ? "right" : "left";
  } else {
    dir = dy > 0 ? "down" : "up";
  }

  moveSelected(dir);
}

function selectDice(id) {
  selectedDiceId = id;
  const cluster = getCluster(id);
  setMessage(`ダイス${id}を選択中。ドッキング塊：${cluster.length}個`);
  render();
}

function getCluster(startId) {
  const start = dice.find(d => d.id === startId);
  if (!start) return [];

  const visited = new Set();
  const queue = [start];
  visited.add(start.id);

  while (queue.length > 0) {
    const current = queue.shift();

    for (const other of dice) {
      if (visited.has(other.id)) continue;

      const adjacent =
        Math.abs(current.x - other.x) + Math.abs(current.y - other.y) === 1;

      if (adjacent) {
        visited.add(other.id);
        queue.push(other);
      }
    }
  }

  return dice.filter(d => visited.has(d.id));
}

function moveSelected(dirName) {
  if (!selectedDiceId) {
    setMessage("先にダイスをタップして選択してね。");
    shakeBoard();
    return;
  }

  const dir = DIRS[dirName];
  const cluster = getCluster(selectedDiceId);
  const clusterIds = new Set(cluster.map(d => d.id));

  const canMove = cluster.every(d => {
    const nx = d.x + dir.x;
    const ny = d.y + dir.y;

    if (!isInside(nx, ny)) return false;

    const targetCell = grid[ny][nx];

    if (targetCell.type === "void") return false;
    if (targetCell.type === "wall") return false;
    if (targetCell.type === "core") return false;

    const otherDice = dice.find(other => other.x === nx && other.y === ny);

    if (otherDice && !clusterIds.has(otherDice.id)) {
      return false;
    }

    return true;
  });

  if (!canMove) {
    setMessage("そこには転がせない！");
    shakeBoard();
    return;
  }

  for (const d of cluster) {
    d.x += dir.x;
    d.y += dir.y;
  }

  moveCount++;
  updateCores();
  render();
  checkClear();
}

function updateCores() {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const cell = grid[y][x];

      if (cell.type !== "core") continue;

      const count = countAdjacentDice(x, y);

      if (count >= cell.value) {
        cell.active = true;
        cell.perfect = count === cell.value;
      } else {
        cell.active = false;
        cell.perfect = false;
      }
    }
  }
}

function countAdjacentDice(x, y) {
  const positions = [
    { x: x, y: y - 1 },
    { x: x, y: y + 1 },
    { x: x - 1, y: y },
    { x: x + 1, y: y }
  ];

  let count = 0;

  for (const pos of positions) {
    const found = dice.some(d => d.x === pos.x && d.y === pos.y);
    if (found) count++;
  }

  return count;
}

function checkClear() {
  const cores = [];

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === "core") {
        cores.push(cell);
      }
    }
  }

  const allActive = cores.every(core => core.active);
  if (!allActive) {
    setMessage("いい感じ。数字コアの周囲にダイスを集めよう。");
    return;
  }

  const allPerfect = cores.every(core => core.perfect);

  if (allPerfect) {
    clearText.textContent = `全コアPERFECT！ 移動回数：${moveCount}`;
  } else {
    clearText.textContent = `クリア！ 移動回数：${moveCount}`;
  }

  clearModal.classList.remove("hidden");
}

function isInside(x, y) {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[y].length;
}

function setMessage(text) {
  messageEl.textContent = text;
}

function shakeBoard() {
  boardEl.classList.remove("shake");
  void boardEl.offsetWidth;
  boardEl.classList.add("shake");
}

document.querySelectorAll(".move-button").forEach(button => {
  button.addEventListener("click", () => {
    moveSelected(button.dataset.dir);
  });
});

resetButton.addEventListener("click", initGame);
modalResetButton.addEventListener("click", initGame);

initGame();
