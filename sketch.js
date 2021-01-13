let wind_dir = 'N';
let wind_power = 0;
let extinct_time = 1;

let wind_dir_value = ["N","NW","W","SW","S","SE","E","NE"]

let fire_map;
let drawOnce = false

let wind_dir_map;
let fps = 20;
let tempFps;
let heightOn;
let density;

let resolution = 10;

let cols = 100
let rows = 80
let width  = cols*resolution
let height = rows*resolution

let autoMode = false
let pBurnFromNothin = 0.00001
let pRegenerate = 0.02
let time2Able2Regenerate = 20
let readyToRegenerateMap;

let pden = {1:-0.3,
            10:0,
            11:0.3,
}

let heightMap;
let pause = false;
const WATER = 0 , VEGETATION1 = 1, VEGETATION2 = 10, VEGETATION3 = 11, FIRE = 2, BURNED = 3;
      
function make2DArray(cols, rows) {
  let arr = new Array(Math.floor(cols));
  for (let i = 0; i < arr.length; i++) {
    arr[i] = new Array(rows);
  }
  return arr;
}

function change_settings() {
  // Get settings
  wind_dir_slider = document.getElementById("wind_dir").value;
  wind_dir = wind_dir_value[wind_dir_slider]
  wind_power = document.getElementById("wind_power").value;
  fps = document.getElementById("fps").value;
  heightOn = document.getElementById("height").checked;
  density = document.getElementById("density").checked;
  autoMode = document.getElementById("autoMode").checked;
}

function change_slider(coord) {
  document.getElementById("wind_dir").value = coord
}

function setup() {
  // Reset de ambos mapas y del botón de pause/resume
  pause = false
  canvasHeightMap.setup()
  canvasForest.setup()
  document.getElementById("pause_resume").innerHTML = "<i class=\"fas fa-pause\"></i>"
  
}

function pause_resume() {
  // Pausa y reactiva el fuego
  if (pause) {
    pause = false
    document.getElementById("pause_resume").innerHTML = "<i class=\"fas fa-pause\"></i>"
    document.getElementById("next").disabled = true;
  } else {
    pause = true
    document.getElementById("pause_resume").innerHTML = "<i class=\"fas fa-play\"></i>"
    document.getElementById("next").disabled = false;
  }
}
function stop() {
  canvasForest.stop()
  if(pause){
    pause_resume() 
  }
  
}
function nextTimeStep() {
  if(pause && !drawOnce ){
    tempFps = fps
    fps = 20
    drawOnce = true
    pause = false
  }
  
}


/**
 * 
 * MAPA DE ALTURAS 
 * 
 */
let canvasHeightMap = new p5(( sketch ) => {

  let noiseScale = 0.015;
  let colorPicker = {
                      0: [255, 255, 255], 
                      1: [255, 200, 200],
                      2: [255, 145, 145],
                      3: [255, 91, 91],
                      4: [255, 36, 36] ,
                      5: [255, 18, 0],
                      6: [255, 73, 0] ,
                      7: [255, 128, 0],
                      8: [255, 182, 0],
                      9: [255, 237, 0],
                      10: [219, 255, 0]
                    }

  sketch.setup = () => {
    

    let rand = Math.random().toFixed(3) * 100;
    sketch.createCanvas(Math.floor(width/2),Math.floor(height/2)).parent('canvasHolder2');
    heightMap = make2DArray(cols, rows);
    sketch.background(0);
    let resolutionHeightMap = resolution/2
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = i * resolutionHeightMap;
        let y = j * resolutionHeightMap;

        //sketch.noiseDetail(2, 1);
        noise = sketch.noise(x*noiseScale + rand ,y*noiseScale + rand)
    
        heightMap[i][j] = noise * 500

        // Print
        cellColor = colorPicker[sketch.floor(noise*10)]
        sketch.fill(cellColor);
        sketch.noStroke();
        sketch.rect(x, y, resolutionHeightMap , resolutionHeightMap );
      }
    }
  };


});


/**
 * 
 * MAPA DEL BOSQUE
 * 
 */
let canvasForest = new p5(( sketch ) => {
  let grid;
  let lastGrid;
  let initial_state;
  

  sketch.stop = () => {
    grid = initial_state
    fire_map = new Map();
    readyToRegenerateMap = new Map();
  }

  function add2FireMap(i,j){
      fire_map.set([i,j], extinct_time);

  }

  function add2ReadyToRegenerateMap(i,j){
    readyToRegenerateMap.set(i.toString() + j.toString(), time2Able2Regenerate);

  }

  
  function propagationProbability(grid, i, j, nx, ny) {
    let dx = nx-i;
    let dy = ny-j;
    let prop_dir = sketch.createVector(dx,dy)
    let win_dir_vector = wind_dir_map[wind_dir];
    θ = prop_dir.angleBetween(win_dir_vector);
    
    p0= 0.58; as= 8.5; c1= 0.045; c2= 0.131; // Valores obtenidos a partir de la experimentación
    v = wind_power/3.6; // Se convierte de km/h a m/s
    pw= sketch.exp(v*(c1+c2*(sketch.cos(θ)-1)));
    

    if (heightOn){
      let D;
      if (Math.abs(i-nx) + Math.abs(j-ny) > 1) // Vecino en diagonal
        D = Math.sqrt(2)*resolution*10
      else
        D = resolution*10
      θs = sketch.atan((heightMap[i][j] -  heightMap[nx][ny])  / D)
      ps = sketch.exp(as*θs)
    } else
        ps = 1

    let actual_pDen;
    if(density)
      actual_pDen = pden[grid[i][j]]
    else
      actual_pDen = 0              

    pburn=p0*(1 + actual_pDen)*pw*ps;
    return pburn;
  }
  
  sketch.mouseClicked = () => {

    var x = sketch.floor(sketch.mouseX/resolution);
    var y = sketch.floor(sketch.mouseY/resolution);
    
    if (0 <= x && x <= cols && 0 <= y && y <= rows){
      state = grid[x][y]
      if (state == VEGETATION1 || state == VEGETATION2 || state == VEGETATION3) {
        add2FireMap(x,y)
        lastGrid[x][y] = FIRE
        grid[x][y] = FIRE
        drawLast();
      }
    }
    
  }

  function getBurningNeighbors(grid, x, y) {
    var burning_neighbors = []
    for (let i = -1; i < 2; i++) {
      for (let j = -1; j < 2; j++) {
        if(0<= x+i && x+i < cols && 0<= y+j && y+j < rows ){
        let col = (x + i + cols) % cols;
        let row = (y + j + rows) % rows;
        
        if (grid[col][row] == FIRE && !(x==col && y==row))
          burning_neighbors.push([col,row])
        }
      }
    }
    return burning_neighbors;
  }

  function getVegetationType(i,j){
    let h = heightMap[i][j]/500
    if (h > 0.2 && h <= 0.3)
      type = VEGETATION3
    else if (h > 0.3 && h <= 0.60)
      type = VEGETATION2
    else if (h > 0.6)
      type = VEGETATION1
    else
      type = WATER
    return type
  }
  
  sketch.setup = () => {

    fire_map = new Map();
    readyToRegenerateMap = new Map();
    sketch.frameRate(fps);
    wind_dir_map = {
                    N: sketch.createVector(0,  1),
                    NE: sketch.createVector(-1, 1),
                    NW: sketch.createVector(1, 1),
                    E: sketch.createVector(-1, 0),
                    S: sketch.createVector(0, -1),
                    SE: sketch.createVector(-1, -1),
                    SW: sketch.createVector(1, -1),
                    W: sketch.createVector(1, 0)
                  };

    sketch.createCanvas(width, height).parent('canvasHolder');
    grid = make2DArray(cols, rows);
    
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        
        grid[i][j] = getVegetationType(i,j)
      }
    }
    initial_state = grid
  };

  function drawLast(){


    sketch.background(0);
    sketch.frameRate(Math.floor(fps));
    
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = i * resolution;
        let y = j * resolution;
        
        switch(lastGrid[i][j]) {
          // Vegetación densidad baja
          case VEGETATION1:
            cellColor ="#96a832";
            break;
            // Vegetación densidad media
          case VEGETATION2:
            cellColor = "#002700";
            break;
            // Vegetación densidad alta
          case VEGETATION3:
            cellColor = "#001400";
            break;
          // Fuego
          case FIRE:
            cellColor = "red";
            break;
          // Quemado
          case BURNED:
            cellColor = "gray";
            break;
          // Agua
          default:
            cellColor = "darkblue"//"#6b2f10 "; //brown
        }
        sketch.fill(cellColor);
        sketch.noStroke();
        sketch.rect(x, y, resolution , resolution  );

      }
    }

  }

  function drawGrid(){
    sketch.background(0);
    sketch.frameRate(Math.floor(fps));
    
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = i * resolution;
        let y = j * resolution;
        
        switch(grid[i][j]) {
          // Vegetación densidad baja
          case VEGETATION1:
            cellColor ="#96a832";
            break;
            // Vegetación densidad media
          case VEGETATION2:
            cellColor = "#002700";
            break;
            // Vegetación densidad alta
          case VEGETATION3:
            cellColor = "#001400";
            break;
          // Fuego
          case FIRE:
            cellColor = "red";
            break;
          // Quemado
          case BURNED:
            cellColor = "gray";
            break;
          // Agua
          default:
            cellColor = "darkblue"//"#6b2f10 "; //brown
        }
        sketch.fill(cellColor);
        sketch.noStroke();
        sketch.rect(x, y, resolution  , resolution  );

      }
    }
  }

  sketch.draw = () => {
    
    if (!pause) {
      
      drawGrid();
      let next = make2DArray(cols, rows);

      // Calcula el siguiente grid basándose en los settings 
      // y en el estado del grid actualmente
      
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          let state = grid[i][j];
          next[i][j] = state
          
          if (state == VEGETATION1 || state == VEGETATION2 || state == VEGETATION3 ){
            let burning_neighbors = getBurningNeighbors(grid, i, j);
            if(Math.random()<pBurnFromNothin && autoMode){
              next[i][j] = 2;
              add2FireMap(i,j)
            }
            else{
              for (const [nx, ny] of burning_neighbors) {
                let p = propagationProbability(grid, i, j , nx,ny);
                if(Math.random()<p){
                  next[i][j] = 2;
                  add2FireMap(i,j)
                  break;
              }
              }
            }
          }
          else if ((state == BURNED) && autoMode && !(readyToRegenerateMap.has(i.toString()+j.toString()))){
            
            if(Math.random()<pRegenerate){

              next[i][j] = getVegetationType(i,j)
            }
          }
       
        }
      }
 


      //Fire extintion logic
      for (const [fireCell, extinct_time] of fire_map.entries()){
        if (extinct_time == 0) {
          fire_map.delete(fireCell);
          i = fireCell[0];
          j = fireCell[1]; 
          next[i][j] = BURNED;
          add2ReadyToRegenerateMap(i,j)
          
        } else {
          fire_map.set(fireCell, extinct_time - 1);
        }
      }

     //Regenerate Logic
     for (const [burnedCell, timeToRegenerate] of readyToRegenerateMap.entries()){
      if (timeToRegenerate == 0) {
        readyToRegenerateMap.delete(burnedCell);
      } else {
        readyToRegenerateMap.set(burnedCell, timeToRegenerate - 1);
      }
    }

      lastGrid = grid
      grid = next;
      if (drawOnce){
        drawOnce = false
        fps = tempFps
        pause = true
      }

  };
  }

});
