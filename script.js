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

const STAGES=[{
  name:"十字の入口",
  size:7,
  grid:[
    ["void","void","floor","floor","floor","void","void"],
    ["void","floor","floor","floor","floor","floor","void"],
    ["floor","floor","floor","floor","floor","floor","floor"],
    ["floor","floor","floor","core3","floor","floor","floor"],
    ["floor","floor","floor","floor","floor","floor","floor"],
    ["void","floor","floor","floor","floor","floor","void"],
    ["void","void","floor","floor","floor","void","void"]
  ],
  dice:[
    {id:"A",x:0,y:2},
    {id:"B",x:6,y:2},
    {id:"C",x:3,y:6}
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

function createDefaultFaces(index){
  const presets=[
    {top:1,bottom:6,north:2,south:5,west:3,east:4},
    {top:2,bottom:5,north:6,south:1,west:3,east:4},
    {top:3,bottom:4,north:2,south:5,west:6,east:1},
    {top:4,bottom:3,north:2,south:5,west:1,east:6},
    {top:5,bottom:2,north:1,south:6,west:3,east:4},
    {top:6,bottom:1,north:5,south:2,west:3,east:4}
  ];
  return {...presets[index%presets.length]};
}

function cloneStage(stage){
  grid=stage.grid.map(row=>row.map(cell=>{
    if(typeof cell==="string"&&cell.startsWith("core")){
      return{type:"core",value:Number(cell.replace("core","")),active:false,perfect:false};
    }
    return{type:cell};
  }));
  dice=stage.dice.map((d,index)=>({...d,faces:createDefaultFaces(index)}));
}

function initGame(){
  const stage=STAGES[currentStageIndex];
  cloneStage(stage);
  selectedDiceId=null;
  moveCount=0;
  pointerStart=null;
  movingIds.clear();
  isAnimating=false;
  clearModal.classList.add("hidden");
  stageNameEl.textContent=stage.name;
  boardEl.style.setProperty("--size",stage.size);
  setMessage("ダイスをタップして選択。スワイプか十字キーで転がそう。");
  updateCores();
  render();
}

function render(){
  boardEl.innerHTML="";
  moveCountEl.textContent=moveCount;
  const selectedCluster=selectedDiceId?getCluster(selectedDiceId):[];
  const selectedIds=new Set(selectedCluster.map(d=>d.id));
  selectedInfoEl.textContent=selectedDiceId?`${selectedCluster.length}個`:"なし";

  for(let y=0;y<grid.length;y++){
    for(let x=0;x<grid[y].length;x++){
      const cellData=grid[y][x];
      const cell=document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.x=x;
      cell.dataset.y=y;

      if(cellData.type==="void")cell.classList.add("void");
      if(cellData.type==="floor")cell.classList.add("floor");
      if(cellData.type==="wall"){cell.classList.add("wall");cell.textContent="■";}
      if(cellData.type==="core"){
        cell.classList.add("core");
        cell.textContent=cellData.value;
        if(cellData.active&&cellData.perfect)cell.classList.add("active-perfect");
        else if(cellData.active)cell.classList.add("active-clear");
      }

      const die=dice.find(d=>d.x===x&&d.y===y);
      if(die){
        const dieEl=document.createElement("div");
        dieEl.classList.add("dice");
        dieEl.dataset.id=die.id;

        const movingDir=movingIds.get(die.id);
        if(movingDir)dieEl.classList.add("moving",`move-${movingDir}`);
        if(die.id===selectedDiceId)dieEl.classList.add("selected");
        else if(selectedIds.has(die.id))dieEl.classList.add("cluster");

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
  const cluster=getCluster(id);
  setMessage(`ダイス${id}を選択中。ドッキング塊：${cluster.length}個`);
  render();
}

function getCluster(startId){
  const start=dice.find(d=>d.id===startId);
  if(!start)return[];
  const visited=new Set([start.id]);
  const queue=[start];

  while(queue.length){
    const current=queue.shift();
    for(const other of dice){
      if(visited.has(other.id))continue;
      const adjacent=Math.abs(current.x-other.x)+Math.abs(current.y-other.y)===1;
      if(adjacent){
        visited.add(other.id);
        queue.push(other);
      }
    }
  }
  return dice.filter(d=>visited.has(d.id));
}

function moveSelected(dirName){
  if(isAnimating)return;
  if(!selectedDiceId){
    setMessage("先にダイスをタップして選択してね。");
    shakeBoard();
    return;
  }

  const dir=DIRS[dirName];
  const cluster=getCluster(selectedDiceId);
  const clusterIds=new Set(cluster.map(d=>d.id));

  const canMove=cluster.every(d=>{
    const nx=d.x+dir.x;
    const ny=d.y+dir.y;
    if(!isInside(nx,ny))return false;
    const targetCell=grid[ny][nx];
    if(targetCell.type==="void"||targetCell.type==="wall"||targetCell.type==="core")return false;
    const otherDice=dice.find(other=>other.x===nx&&other.y===ny);
    if(otherDice&&!clusterIds.has(otherDice.id))return false;
    return true;
  });

  if(!canMove){
    setMessage("そこには転がせない！");
    shakeBoard();
    return;
  }

  isAnimating=true;
  movingIds.clear();

  for(const d of cluster){
    rollDiceFaces(d.faces,dirName);
    d.x+=dir.x;
    d.y+=dir.y;
    movingIds.set(d.id,dirName);
  }

  moveCount++;
  updateCores();
  render();

  setTimeout(()=>{
    movingIds.clear();
    isAnimating=false;
    updateCores();
    render();
    checkClear();
  },270);
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

function updateCores(){
  for(let y=0;y<grid.length;y++){
    for(let x=0;x<grid[y].length;x++){
      const cell=grid[y][x];
      if(cell.type!=="core")continue;
      const count=countAdjacentDice(x,y);
      cell.active=count>=cell.value;
      cell.perfect=count===cell.value;
    }
  }
}

function countAdjacentDice(x,y){
  return[
    {x,y:y-1},
    {x,y:y+1},
    {x:x-1,y},
    {x:x+1,y}
  ].filter(pos=>dice.some(d=>d.x===pos.x&&d.y===pos.y)).length;
}

function checkClear(){
  const cores=[];
  for(const row of grid){
    for(const cell of row){
      if(cell.type==="core")cores.push(cell);
    }
  }

  const allActive=cores.every(core=>core.active);
  if(!allActive){
    setMessage("いい感じ。数字コアの周囲にダイスを集めよう。");
    return;
  }

  const allPerfect=cores.every(core=>core.perfect);
  clearText.textContent=allPerfect
    ?`全コアPERFECT！ 移動回数：${moveCount}`
    :`クリア！ 移動回数：${moveCount}`;
  clearModal.classList.remove("hidden");
}

function isInside(x,y){
  return y>=0&&y<grid.length&&x>=0&&x<grid[y].length;
}

function setMessage(text){messageEl.textContent=text}

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
