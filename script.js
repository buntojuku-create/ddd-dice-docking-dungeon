const boardEl=document.getElementById("board");
const stageNameEl=document.getElementById("stageName");
const moveCountEl=document.getElementById("moveCount");
const selectedInfoEl=document.getElementById("selectedInfo");
const messageEl=document.getElementById("message");
const resetButton=document.getElementById("resetButton");
const modalResetButton=document.getElementById("modalResetButton");
const clearModal=document.getElementById("clearModal");
const clearText=document.getElementById("clearText");

const DIRS={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};

const FACES={
  2:{top:2,bottom:5,north:1,south:6,west:3,east:4},
  3:{top:3,bottom:4,north:1,south:6,west:2,east:5},
  4:{top:4,bottom:3,north:1,south:6,west:5,east:2},
  5:{top:5,bottom:2,north:1,south:6,west:4,east:3}
};

const STAGES=[{
  name:"入口の間",
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
  dice:[
    {id:"A",x:1,y:1,faces:{...FACES[2]}},
    {id:"B",x:5,y:1,faces:{...FACES[2]}},
    {id:"C",x:1,y:5,faces:{...FACES[3]}},
    {id:"D",x:3,y:5,faces:{...FACES[3]}},
    {id:"E",x:5,y:5,faces:{...FACES[3]}}
  ]
}];

let currentStageIndex=0;
let grid=[];
let dice=[];
let selectedDiceId=null;
let moveCount=0;
let pointerStart=null;
let movingIds=new Map();
let isAnimating=false;

function initGame(){
  const stage=STAGES[currentStageIndex];
  grid=stage.grid.map(row=>row.map(type=>({type})));
  dice=stage.dice.map(d=>({id:d.id,x:d.x,y:d.y,faces:{...d.faces}}));
  selectedDiceId=null;
  moveCount=0;
  pointerStart=null;
  movingIds.clear();
  isAnimating=false;
  clearModal.classList.add("hidden");
  stageNameEl.textContent=stage.name;
  boardEl.style.setProperty("--size",stage.size);
  setMessage("ダイスを単独で転がそう。同じ上面の目が、その数以上つながると消える。");
  render();
}

function render(){
  boardEl.innerHTML="";
  moveCountEl.textContent=moveCount;
  const selected=dice.find(d=>d.id===selectedDiceId);
  selectedInfoEl.textContent=selected?`上面${selected.faces.top}`:"なし";

  for(let y=0;y<grid.length;y++){
    for(let x=0;x<grid[y].length;x++){
      const cellData=grid[y][x];
      const cell=document.createElement("div");
      cell.classList.add("cell");
      if(cellData.type==="void")cell.classList.add("void");
      if(cellData.type==="floor")cell.classList.add("floor");
      if(cellData.type==="wall"){cell.classList.add("wall");cell.textContent="■";}

      const die=dice.find(d=>d.x===x&&d.y===y);
      if(die){
        const dieEl=document.createElement("div");
        dieEl.classList.add("dice");
        dieEl.dataset.id=die.id;

        const movingDir=movingIds.get(die.id);
        if(movingDir)dieEl.classList.add("moving",`move-${movingDir}`);
        if(die.id===selectedDiceId)dieEl.classList.add("selected");

        dieEl.appendChild(createDiceCube(die.faces));
        dieEl.addEventListener("pointerdown",onDicePointerDown);
        dieEl.addEventListener("click",()=>selectDice(die.id));
        cell.appendChild(dieEl);
      }

      boardEl.appendChild(cell);
    }
  }
}

function createDiceCube(faces){
  const cube=document.createElement("div");
  cube.classList.add("dice-cube");
  [
    {className:"cube-top",value:faces.top},
    {className:"cube-bottom",value:faces.bottom},
    {className:"cube-front",value:faces.south},
    {className:"cube-back",value:faces.north},
    {className:"cube-left",value:faces.west},
    {className:"cube-right",value:faces.east}
  ].forEach(data=>{
    const face=document.createElement("div");
    face.classList.add("cube-face",data.className);
    createPips(data.value).forEach(pip=>face.appendChild(pip));
    cube.appendChild(face);
  });
  return cube;
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
  return(pipMap[value]||["mc"]).map(pos=>{
    const pip=document.createElement("span");
    pip.classList.add("pip",pos);
    return pip;
  });
}

function onDicePointerDown(event){
  if(isAnimating)return;
  const id=event.currentTarget.dataset.id;
  selectDice(id);
  pointerStart={x:event.clientX,y:event.clientY};
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.addEventListener("pointerup",onDicePointerUp,{once:true});
}

function onDicePointerUp(event){
  if(isAnimating||!pointerStart||!selectedDiceId)return;
  const dx=event.clientX-pointerStart.x;
  const dy=event.clientY-pointerStart.y;
  const distance=Math.hypot(dx,dy);
  pointerStart=null;
  if(distance<28)return;
  const dirName=Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up");
  moveSelected(dirName);
}

function selectDice(id){
  if(isAnimating)return;
  selectedDiceId=id;
  const die=dice.find(d=>d.id===id);
  setMessage(`ダイス${id}を選択中。上面：${die.faces.top}`);
  render();
}

function moveSelected(dirName){
  if(isAnimating)return;

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
    setMessage("そこには転がせない！");
    shakeBoard();
    return;
  }

  const targetCell=grid[ny][nx];
  if(targetCell.type==="void"||targetCell.type==="wall"){
    setMessage("そこには転がせない！");
    shakeBoard();
    return;
  }

  const otherDice=dice.find(d=>d.x===nx&&d.y===ny);
  if(otherDice){
    setMessage("他のダイスがあるマスには進めない！");
    shakeBoard();
    return;
  }

  isAnimating=true;
  movingIds.clear();

  rollDiceFaces(die.faces,dirName);
  die.x=nx;
  die.y=ny;
  movingIds.set(die.id,dirName);
  moveCount++;

  render();

  setTimeout(()=>{
    movingIds.clear();
    const removed=resolveMatches();
    isAnimating=false;
    render();

    if(dice.length===0){
      clearText.textContent=`全ダイス消去！ 移動回数：${moveCount}`;
      clearModal.classList.remove("hidden");
      return;
    }

    if(removed>0){
      selectedDiceId=null;
      setMessage(`${removed}個のダイスが消えた！`);
      render();
    }else{
      setMessage("同じ上面のダイスを、その目の数以上つなげよう。");
    }
  },270);
}

function resolveMatches(){
  const visited=new Set();
  const removeIds=new Set();

  for(const start of dice){
    if(visited.has(start.id))continue;

    const value=start.faces.top;
    const group=[];
    const queue=[start];
    visited.add(start.id);

    while(queue.length){
      const current=queue.shift();
      group.push(current);

      for(const other of dice){
        if(visited.has(other.id))continue;
        if(other.faces.top!==value)continue;

        const adjacent=Math.abs(current.x-other.x)+Math.abs(current.y-other.y)===1;
        if(adjacent){
          visited.add(other.id);
          queue.push(other);
        }
      }
    }

    if(group.length>=value){
      group.forEach(d=>removeIds.add(d.id));
    }
  }

  if(removeIds.size===0)return 0;

  dice=dice.filter(d=>!removeIds.has(d.id));
  if(selectedDiceId&&removeIds.has(selectedDiceId))selectedDiceId=null;

  return removeIds.size;
}

function rollDiceFaces(faces,dirName){
  const old={...faces};

  if(dirName==="right"){
    faces.top=old.west;
    faces.bottom=old.east;
    faces.east=old.top;
    faces.west=old.bottom;
  }

  if(dirName==="left"){
    faces.top=old.east;
    faces.bottom=old.west;
    faces.west=old.top;
    faces.east=old.bottom;
  }

  if(dirName==="up"){
    faces.top=old.south;
    faces.bottom=old.north;
    faces.north=old.top;
    faces.south=old.bottom;
  }

  if(dirName==="down"){
    faces.top=old.north;
    faces.bottom=old.south;
    faces.south=old.top;
    faces.north=old.bottom;
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
modalResetButton.addEventListener("click",initGame);

initGame();
