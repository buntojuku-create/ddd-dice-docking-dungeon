const boardEl=document.getElementById("board");
const stageNameEl=document.getElementById("stageName");
const moveCountEl=document.getElementById("moveCount");
const selectedInfoEl=document.getElementById("selectedInfo");
const remainCountEl=document.getElementById("remainCount");
const messageEl=document.getElementById("message");
const resetButton=document.getElementById("resetButton");
const modalResetButton=document.getElementById("modalResetButton");
const clearModal=document.getElementById("clearModal");
const clearText=document.getElementById("clearText");

const DIRS={
  up:{x:0,y:-1},
  down:{x:0,y:1},
  left:{x:-1,y:0},
  right:{x:1,y:0}
};

const MIN_CLEAR_VALUE=2;

const FACE_PRESETS={
  2:{top:2,bottom:5,north:1,south:6,west:3,east:4},
  3:{top:3,bottom:4,north:1,south:6,west:2,east:5},
  4:{top:4,bottom:3,north:1,south:6,west:5,east:2},
  5:{top:5,bottom:2,north:1,south:6,west:4,east:3},
  6:{top:6,bottom:1,north:2,south:5,west:3,east:4}
};

const STAGES=[
  {
    name:"1-入口の間",
    size:7,
    grid:[
      ["void","void","floor","floor","floor","void","void"],
      ["void","floor","floor","floor","floor","floor","void"],
      ["floor","floor","floor","floor","floor","floor","floor"],
      ["floor","floor","floor","floor","floor","floor","floor"],
      ["floor","floor","floor","floor","floor","floor","floor"],
      ["void","floor","floor","floor","floor","floor","void"],
      ["void","void","floor","floor","floor","void","void"]
    ],
    diceValues:[2,2,3,3,3]
  },
  {
    name:"2-十字回廊",
    size:7,
    grid:[
      ["void","void","void","floor","void","void","void"],
      ["void","void","floor","floor","floor","void","void"],
      ["void","floor","floor","floor","floor","floor","void"],
      ["floor","floor","floor","floor","floor","floor","floor"],
      ["void","floor","floor","floor","floor","floor","void"],
      ["void","void","floor","floor","floor","void","void"],
      ["void","void","void","floor","void","void","void"]
    ],
    diceValues:[2,2,3,3,4,4]
  },
  {
    name:"3-欠けた広間",
    size:7,
    grid:[
      ["void","floor","floor","floor","floor","floor","void"],
      ["floor","floor","floor","void","floor","floor","floor"],
      ["floor","floor","floor","floor","floor","floor","floor"],
      ["floor","void","floor","floor","floor","void","floor"],
      ["floor","floor","floor","floor","floor","floor","floor"],
      ["floor","floor","floor","void","floor","floor","floor"],
      ["void","floor","floor","floor","floor","floor","void"]
    ],
    diceValues:[2,2,3,3,3,4,4]
  },
  {
    name:"4-輪の祭壇",
    size:7,
    grid:[
      ["void","floor","floor","floor","floor","floor","void"],
      ["floor","floor","floor","void","floor","floor","floor"],
      ["floor","floor","void","void","void","floor","floor"],
      ["floor","void","void","void","void","void","floor"],
      ["floor","floor","void","void","void","floor","floor"],
      ["floor","floor","floor","void","floor","floor","floor"],
      ["void","floor","floor","floor","floor","floor","void"]
    ],
    diceValues:[2,2,3,3,4,4,5]
  },
  {
    name:"5-深層の盤",
    size:8,
    grid:[
      ["void","void","floor","floor","floor","floor","void","void"],
      ["void","floor","floor","floor","floor","floor","floor","void"],
      ["floor","floor","floor","void","floor","floor","floor","floor"],
      ["floor","floor","void","floor","floor","void","floor","floor"],
      ["floor","floor","floor","floor","void","floor","floor","floor"],
      ["floor","floor","floor","void","floor","floor","floor","floor"],
      ["void","floor","floor","floor","floor","floor","floor","void"],
      ["void","void","floor","floor","floor","floor","void","void"]
    ],
    diceValues:[2,2,3,3,3,4,4,5,5]
  }
];

let currentStageIndex=0;
let grid=[];
let dice=[];
let selectedDiceId=null;
let moveCount=0;
let pointerStart=null;
let movingIds=new Map();
let removingIds=new Set();
let flashCells=[];
let isAnimating=false;

function initGame(){
  const stage=STAGES[currentStageIndex];

  grid=stage.grid.map(row=>row.map(type=>({type})));
  dice=createRandomDice(stage);

  selectedDiceId=null;
  moveCount=0;
  pointerStart=null;
  movingIds.clear();
  removingIds.clear();
  flashCells=[];
  isAnimating=false;

  clearModal.classList.add("hidden");
  boardEl.style.setProperty("--size",stage.size);
  stageNameEl.textContent=stage.name;

  setMessage("ダイスを選んで転がそう。同じ上面の目が、その目の数以上つながると消える。");
  render();
}

function createRandomDice(stage){
  const floorCells=[];

  for(let y=0;y<stage.grid.length;y++){
    for(let x=0;x<stage.grid[y].length;x++){
      if(stage.grid[y][x]==="floor"){
        floorCells.push({x,y});
      }
    }
  }

  for(let attempt=0;attempt<400;attempt++){
    const cells=shuffleArray([...floorCells]);

    const result=stage.diceValues.map((value,index)=>({
      id:String.fromCharCode(65+index),
      x:cells[index].x,
      y:cells[index].y,
      faces:{...FACE_PRESETS[value]}
    }));

    if(!hasInitialClearGroup(result)){
      return result;
    }
  }

  const cells=shuffleArray([...floorCells]);

  return stage.diceValues.map((value,index)=>({
    id:String.fromCharCode(65+index),
    x:cells[index].x,
    y:cells[index].y,
    faces:{...FACE_PRESETS[value]}
  }));
}

function shuffleArray(array){
  for(let i=array.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
  return array;
}

function hasInitialClearGroup(diceList){
  const visited=new Set();

  for(const start of diceList){
    if(visited.has(start.id)) continue;

    const value=start.faces.top;
    const group=[];
    const queue=[start];

    visited.add(start.id);

    while(queue.length){
      const current=queue.shift();
      group.push(current);

      for(const other of diceList){
        if(visited.has(other.id)) continue;
        if(other.faces.top!==value) continue;

        const adjacent=Math.abs(current.x-other.x)+Math.abs(current.y-other.y)===1;

        if(adjacent){
          visited.add(other.id);
          queue.push(other);
        }
      }
    }

    if(value>=MIN_CLEAR_VALUE&&group.length>=value){
      return true;
    }
  }

  return false;
}

function render(){
  boardEl.innerHTML="";
  moveCountEl.textContent=moveCount;
  remainCountEl.textContent=dice.length;

  const selected=dice.find(d=>d.id===selectedDiceId);
  selectedInfoEl.textContent=selected?`上面${selected.faces.top}`:"なし";

  for(let y=0;y<grid.length;y++){
    for(let x=0;x<grid[y].length;x++){
      const cellData=grid[y][x];
      const cell=document.createElement("div");
      cell.classList.add("cell");

      if(cellData.type==="void") cell.classList.add("void");
      if(cellData.type==="floor") cell.classList.add("floor");
      if(cellData.type==="wall") cell.classList.add("wall");

      if(flashCells.some(p=>p.x===x&&p.y===y)){
        cell.classList.add("match-flash");
      }

      const die=dice.find(d=>d.x===x&&d.y===y);

      if(die){
        const dieEl=document.createElement("div");
        dieEl.classList.add("dice");
        dieEl.dataset.id=die.id;

        if(die.id===selectedDiceId) dieEl.classList.add("selected");
        if(movingIds.has(die.id)) dieEl.classList.add("moving",`move-${movingIds.get(die.id)}`);
        if(removingIds.has(die.id)) dieEl.classList.add("removing");

        dieEl.appendChild(createDie(die.faces));
        dieEl.addEventListener("click",()=>selectDice(die.id));
        dieEl.addEventListener("pointerdown",onDicePointerDown);

        cell.appendChild(dieEl);
      }

      boardEl.appendChild(cell);
    }
  }
}

function createDie(faces){
  const body=document.createElement("div");
  body.classList.add("die-body");

  const top=document.createElement("div");
  top.classList.add("die-top");
  createPips(faces.top).forEach(pip=>top.appendChild(pip));

  const front=document.createElement("div");
  front.classList.add("die-front");
  createPips(faces.south).forEach(pip=>{
    const p=pip.cloneNode(true);
    front.appendChild(p);
  });

  const right=document.createElement("div");
  right.classList.add("die-right");
  createPips(faces.east).forEach(pip=>{
    const p=pip.cloneNode(true);
    right.appendChild(p);
  });

  body.appendChild(right);
  body.appendChild(front);
  body.appendChild(top);

  return body;
}

function createPips(value){
  const pipMap={
    1:["mc"],
    2:["tl","br"],
    3:["tl","mc","br"],
    4:["tl","tr","bl","br"],
    5:["tl","tr","mc","bl","br"],
    6:["tl","ml","bl","tr","mr","br"]
  };

  return (pipMap[value]||["mc"]).map(pos=>{
    const pip=document.createElement("span");
    pip.classList.add("pip",pos);
    return pip;
  });
}

function onDicePointerDown(event){
  if(isAnimating) return;

  const id=event.currentTarget.dataset.id;
  selectDice(id);

  pointerStart={
    x:event.clientX,
    y:event.clientY
  };

  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.addEventListener("pointerup",onDicePointerUp,{once:true});
}

function onDicePointerUp(event){
  if(isAnimating||!pointerStart||!selectedDiceId) return;

  const dx=event.clientX-pointerStart.x;
  const dy=event.clientY-pointerStart.y;
  const distance=Math.hypot(dx,dy);

  pointerStart=null;

  if(distance<26) return;

  const dirName=Math.abs(dx)>Math.abs(dy)
    ? (dx>0?"right":"left")
    : (dy>0?"down":"up");

  moveSelected(dirName);
}

function selectDice(id){
  if(isAnimating) return;

  selectedDiceId=id;

  const die=dice.find(d=>d.id===id);
  if(die){
    setMessage(`ダイス${die.id}を選択中。現在の上面は ${die.faces.top}。`);
  }

  render();
}

function moveSelected(dirName){
  if(isAnimating) return;

  const die=dice.find(d=>d.id===selectedDiceId);

  if(!die){
    setMessage("先にダイスをタップして選択してね。");
    shakeBoard();
    return;
  }

  const dir=DIRS[dirName];
  const nx=die.x+dir.x;
  const ny=die.y+dir.y;

  if(!isInside(nx,ny)){
    blockMove();
    return;
  }

  const targetCell=grid[ny][nx];

  if(targetCell.type==="void"||targetCell.type==="wall"){
    blockMove();
    return;
  }

  const other=dice.find(d=>d.x===nx&&d.y===ny);
  if(other){
    setMessage("そのマスには別のダイスがある。");
    shakeBoard();
    return;
  }

  isAnimating=true;
  movingIds.clear();
  flashCells=[];

  rollDiceFaces(die.faces,dirName);

  die.x=nx;
  die.y=ny;
  movingIds.set(die.id,dirName);
  moveCount++;

  render();

  setTimeout(()=>{
    movingIds.clear();

    const result=resolveMatchesFrom(die.id);

    if(result.removedIds.length>0){
      removingIds=new Set(result.removedIds);
      flashCells=result.positions;

      setMessage(`${result.removedIds.length}個のダイスが消える！`);
      render();

      setTimeout(()=>{
        dice=dice.filter(d=>!removingIds.has(d.id));

        if(selectedDiceId&&removingIds.has(selectedDiceId)){
          selectedDiceId=null;
        }

        removingIds.clear();
        flashCells=[];
        finishTurn();
      },280);
    }else{
      finishTurn();
    }
  },240);
}

function finishTurn(){
  isAnimating=false;
  render();

  if(dice.length===0){
    const isLastStage=currentStageIndex===STAGES.length-1;

    clearText.textContent=isLastStage
      ?`全5ステージクリア！ 移動回数：${moveCount}`
      :`ステージクリア！ 移動回数：${moveCount}`;

    modalResetButton.textContent=isLastStage
      ?"最初から遊ぶ"
      :"次のステージへ";

    clearModal.classList.remove("hidden");
    return;
  }

  setMessage("次の一手を考えよう。1は消えない。");
}

function nextStage(){
  if(currentStageIndex>=STAGES.length-1){
    currentStageIndex=0;
  }else{
    currentStageIndex++;
  }

  initGame();
}

function blockMove(){
  setMessage("そこには転がせない。");
  shakeBoard();
}

function resolveMatchesFrom(startId){
  const start=dice.find(d=>d.id===startId);

  if(!start){
    return {removedIds:[],positions:[]};
  }

  const value=start.faces.top;

  if(value<MIN_CLEAR_VALUE){
    return {removedIds:[],positions:[]};
  }

  const visited=new Set([start.id]);
  const queue=[start];
  const group=[];

  while(queue.length){
    const current=queue.shift();
    group.push(current);

    for(const other of dice){
      if(visited.has(other.id)) continue;
      if(other.faces.top!==value) continue;

      const adjacent=Math.abs(current.x-other.x)+Math.abs(current.y-other.y)===1;

      if(adjacent){
        visited.add(other.id);
        queue.push(other);
      }
    }
  }

  if(group.length<value){
    return {removedIds:[],positions:[]};
  }

  return {
    removedIds:group.map(d=>d.id),
    positions:group.map(d=>({x:d.x,y:d.y}))
  };
}

function rollDiceFaces(faces,dirName){
  const old={...faces};

  if(dirName==="right"){
    faces.top=old.west;
    faces.bottom=old.east;
    faces.east=old.top;
    faces.west=old.bottom;
    faces.north=old.north;
    faces.south=old.south;
  }

  if(dirName==="left"){
    faces.top=old.east;
    faces.bottom=old.west;
    faces.west=old.top;
    faces.east=old.bottom;
    faces.north=old.north;
    faces.south=old.south;
  }

  if(dirName==="up"){
    faces.top=old.south;
    faces.bottom=old.north;
    faces.north=old.top;
    faces.south=old.bottom;
    faces.east=old.east;
    faces.west=old.west;
  }

  if(dirName==="down"){
    faces.top=old.north;
    faces.bottom=old.south;
    faces.south=old.top;
    faces.north=old.bottom;
    faces.east=old.east;
    faces.west=old.west;
  }
}

function isInside(x,y){
  return y>=0&&y<grid.length&&x>=0&&x<grid[y].length;
}

function setMessage(text){
  messageEl.textContent=text;
}

function shakeBoard(){
  boardEl.classList.remove("shake");
  void boardEl.offsetWidth;
  boardEl.classList.add("shake");
}

document.querySelectorAll(".move-button").forEach(button=>{
  button.addEventListener("click",()=>moveSelected(button.dataset.dir));
});

resetButton.addEventListener("click",initGame);
modalResetButton.addEventListener("click",nextStage);

initGame();
