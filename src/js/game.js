/***********************************************************************************
* Retro Racing game for RatRodz
*
* @author		Jon C. Wretlind
* @copyright	2021 Jon C. Wretlind
* @website		https://jonwretlind.com
*
/***********************************************************************************/

(function() { // private module pattern

    'use strict'
  
    //===================================
    // CONSTANTS
    //===================================
  
    const FPS    = 60,
          WIDTH  = 1920,
          HEIGHT = 1080;
  
    //screen center
    const SCR_CX = WIDTH/2,
          SCR_CY = HEIGHT/2;
  
    var FPSMETER = new FPSMeter({ decimals: 0, graph: true, theme: 'dark', left: '5px' });
  
    //game states
    const   STATE_INIT = 1,
            STATE_RESTART = 2,
            STATE_PLAY = 3,
            STATE_GAMEOVER = 4;
  
    // sprites
    const PLAYER = 0;
    var   ratrod;
  
    // Level: map variable is array
    var levelMap = [];
  
  
    //===================================
    // INITIAL VARIABLES
    //===================================
  
    var now,
        dt   = 0,
        last = timestamp(),
        step = 1/FPS,
        time = 0,
        output = "";
  
    //const ObjectsArr = [];
  
    var circuit, camera, player, gameprops;
  
    var state = STATE_INIT;
  
    var newCamDistance;
  
    //set flags
    var initFlag = false;
    var pedalFlag = false;
  
    //===================================
    // GAME - UTILIY FUNCTIONS
    //===================================
  
    // ... keep game loop consistent with system time
    function timestamp() {
      return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
    }
  
    function updateDuration(now) {
      time = (now - last) / 1000;
      dt = Math.min(1, time);    // duration in seconds
      return dt;
    }
  
    const EasingUtil = {
      easeIn:    function(a,b,percent) { return a + (b-a)*Math.pow(percent,2);                           },
      easeOut:   function(a,b,percent) { return a + (b-a)*(1-Math.pow(1-percent,2));                     },
      easeInOut: function(a,b,percent) { return a + (b-a)*((-Math.cos(percent*Math.PI)/2) + 0.5);        }
    };
  
    // rotaton function from
    // https://stackoverflow.com/questions/34050929/3d-point-rotation-algorithm
    // ***
    // points = {x: 0, y: 0, z: 0}
    // ***
    function rotate(pitch, roll, yaw) {
      var cosa = Math.cos(yaw);
      var sina = Math.sin(yaw);
  
      var cosb = Math.cos(pitch);
      var sinb = Math.sin(pitch);
  
      var cosc = Math.cos(roll);
      var sinc = Math.sin(roll);
  
      var Axx = cosa*cosb;
      var Axy = cosa*sinb*sinc - sina*cosc;
      var Axz = cosa*sinb*cosc + sina*sinc;
  
      var Ayx = sina*cosb;
      var Ayy = sina*sinb*sinc + cosa*cosc;
      var Ayz = sina*sinb*cosc - cosa*sinc;
  
      var Azx = -sinb;
      var Azy = cosb*sinc;
      var Azz = cosb*cosc;
  
      for (var i = 0; i < points.length; i++) {
          var px = points[i].x;
          var py = points[i].y;
          var pz = points[i].z;
  
          points[i].x = Axx*px + Axy*py + Axz*pz;
          points[i].y = Ayx*px + Ayy*py + Ayz*pz;
          points[i].z = Azx*px + Azy*py + Azz*pz;
      }
  }
  
  
    // Misc Settings
    class Settings
    {
        constructor(scene){
            // reference to the game scene
            this.scene = scene;
  
            var font = {font: '32px Arial', fill: '#000000'};
            this.txtPause= scene.add.text(1720, 5, '', font);
  
            this.show();
        }
  
        /**
        * Shows all settings.
        */
        show(){
            this.txtPause.text = "[P] Pause";
        }
    }
  
    class SetGameProperties
    {
      constructor(scene) {
        this.scene = scene;
        this.camDistField = document.getElementById("CamDistance");
        this.playerSpeedField = document.getElementById("PlayerSpeed");
        this.playerZField = document.getElementById("PlayerZ");
        this.playerTimeField = document.getElementById("Time");
        this.outputField = document.getElementById("OutputField");
        this.camDistance = this.camDistField.value; // set initial value
        /*this.camDistField.addEventListener("change", function() {
          //change the value of the camera distance on change to field
          newCamDistance = this.camDistance;
          console.log("distToPlayer = " + camera.distToPlayer);
        })*/
      }
      init() {
        newCamDistance = this.camDistance;
      }
      update() {
        camera.distToPlayer = newCamDistance;
        this.playerSpeedField.value = player.speed;
        this.playerZField.value = player.z;
        this.playerTimeField.value = time;
        this.outputField.value = output;
      }
    }
  
    // ==================================
    // ROAD CIRCUIT
    // ==================================
  
    class Circuit extends Phaser.Scene
    {
      constructor(scene) {
        super({key: 'CircuitGraphics'});
  
        //reference to the game scene
        this.scene = scene;
        // graphics for road polygons
        this.graphics = scene.add.graphics(0, 0);
        //texture to drawe sprites on it
        this.texture = scene.add.renderTexture(0,0,WIDTH, HEIGHT);
        //array of road segments
        this.segments = [];
        //single segment length
        this.segmentLength = 100;
        //total num of road segments
        this.total_segments = null;
        //number of visible segments
        this.visible_segments = 200;
        //num of segments that form rumble strips
        this.rumble_segments = 5;
        //number of road lanes
        this.roadLanes = 3;
        //road width (1/2 the road)
        this.roadWidth = 1000;
        // total road length
        this.roadLength = null;
        // use for checking player's location on levelMap
        this.mapCounter = 0;
        // the size of each road section size
        this.sectionSize = 0;
        // the size of each map unit
        this.mapSectionSize = 100000;
  
        this.c = 0;
        this.enter = 0;
        this.hold = 0;
        this.leave = 0;
        this.curve = 0;
        this.cv = 0;
  
        //Holds values that define road curving sections
        this.ROAD = {
          LENGTH: { NONE: 0, SHORT:  500/3, MEDIUM:  2500/3, LONG:  5000/3 }, // num segments / 3 to use for ENTER, HOLD and LEAVE values
          CURVE:  { NONE: 0, EASY:    50, MEDIUM:   75, HARD:    100 }
        };
  
        /* ========== */
        /*  LEVEL MAP */
        /* ========== */
  
        // first number is whether straight 0, right 1, or left -1
        //                   ENTER                    HOLD                      LEAVE                    CURVE
        this.levelMap = [ 0, this.ROAD.LENGTH.NONE,   this.ROAD.LENGTH.NONE,    this.ROAD.LENGTH.NONE,    this.ROAD.CURVE.NONE,
                         -1, this.ROAD.LENGTH.SHORT,  this.ROAD.LENGTH.MEDIUM,  this.ROAD.LENGTH.SHORT,   this.ROAD.CURVE.MEDIUM,
                          1, this.ROAD.LENGTH.SHORT,  this.ROAD.LENGTH.SHORT,   this.ROAD.LENGTH.SHORT,   this.ROAD.CURVE.EASY,
                         -1, this.ROAD.LENGTH.LONG,   this.ROAD.LENGTH.SHORT,   this.ROAD.LENGTH.LONG,    this.ROAD.CURVE.MEDIUM,
                          0, this.ROAD.LENGTH.NONE,   this.ROAD.LENGTH.NONE,    this.ROAD.LENGTH.NONE,    this.ROAD.CURVE.NONE,
                          1, this.ROAD.LENGTH.SHORT,  this.ROAD.LENGTH.MEDIUM,  this.ROAD.LENGTH.LONG,    this.ROAD.CURVE.MEDIUM,
                         -1, this.ROAD.LENGTH.LONG,   this.ROAD.LENGTH.MEDIUM,  this.ROAD.LENGTH.SHORT,   this.ROAD.CURVE.MEDIUM,
                         -1, this.ROAD.LENGTH.LONG,   this.ROAD.LENGTH.LONG,    this.ROAD.LENGTH.LONG,    this.ROAD.CURVE.HARD,
                          1, this.ROAD.LENGTH.SHORT,  this.ROAD.LENGTH.SHORT,   this.ROAD.LENGTH.SHORT,   this.ROAD.CURVE.EASY,
                          0, this.ROAD.LENGTH.NONE,   this.ROAD.LENGTH.NONE,    this.ROAD.LENGTH.NONE,    this.ROAD.CURVE.NONE
                        ];
  
  
      }
  
      retrieveMapValues(idx) {
          this.c = this.levelMap[idx]; // c = is curve left or right?
          this.enter = this.levelMap[idx+1];
          this.hold = this.levelMap[idx+2];
          this.leave = this.levelMap[idx+3];
          this.curve = this.levelMap[idx+4] * this.c;
      };
  
      create(scene) {
        //clear arrays
        this.segments = [];
        // create a road
        for (var i = 0; i < this.levelMap.length/5; i += 5) {
          this.retrieveMapValues(i);
          this.sectionSize = this.enter + this.hold + this.leave;
          //this.segments.push(this.sectionSize);
        };
  
        this.createSection(this.sectionSize, this.enter, this.hold, this.leave, this.curve);
        // colorize first segments in a starting color, and last segments in a finishing color
        for (var n=0; n<this.rumble_segments; n++){
          this.segments[n].color.road = '0xFFFFFF';							// start
          this.segments[this.segments.length-1-n].color.road = '0x222222';	// finish
        }
        //store the total num of segments
        this.total_segments = this.segments.length;
        //calc road length
        this.roadLength = this.total_segments * this.segmentLength;
  
        initFlag = true;
      }
  
      createSection(nSegments, enter, hold, leave, curve) {
        for (var i=0; i < nSegments; i++) {
          curve += curve; // add curve value to itself
          this.addCurves(enter, hold, leave, curve);
        }
      }
  
      // ease in, hold, and then ease out of a curved road
      addCurves(enter, hold, leave, curve) {
        var n;
        for(n = 0 ; n < enter ; n++)
          this.makeRoad(EasingUtil.easeIn(0, curve, n/enter));
        for(n = 0 ; n < hold  ; n++)
          this.makeRoad(curve);
        for(n = 0 ; n < leave ; n++)
          this.makeRoad(EasingUtil.easeInOut(curve, 0, n/leave));
      }
  
      makeRoad(curve) {
        //define road colors
        const COLORS = {
          LIGHT: { road: '0x888888', grass: '0x429352', rumble: '0xb8312e'},
          DARK:  { road: '0x666666', grass: '0x397d46', rumble: '0xdddddd', lane: '0xffffff'}
        }
        // get current # of segments
        var n = this.segments.length;
  
        //add new segment to array of segments
        this.segments.push({
          index: n,
          point: {
            world:  { x: 0, y: 0, z: n * this.segmentLength},
            screen: { x: 0, y: 0, w: 0},
            scale: -1
          },
          curve: curve,
          color: Math.floor(n/this.rumble_segments)%2 ? COLORS.DARK : COLORS.LIGHT
        });
      }
  
      //returns a segment at the Z position
      getSegment(positionZ) {
        if ( positionZ < 0 ) {
          positionZ += this.roadLength;
        }
        var index = Math.floor(positionZ / this.segmentLength) % this.total_segments;
        return this.segments[index];
      }
  
      // projects 3D
      project3D(point, cameraX, cameraY, cameraZ, cameraDepth, curve) {
        //translate world coords to camera coordinates
        output = cameraX;
        var transX = point.world.x - cameraX;
        var transY = point.world.y - cameraY;
        var transZ = point.world.z - cameraZ;
  
        //scaling factor based on similar triangles
        point.scale = cameraDepth/transZ; // Zero division !!!
  
        //projecting camera coords onto normalized projection plane
        var projectedX = point.scale * transX;
        var projectedY = point.scale * transY;
        var projectedW = point.scale * this.roadWidth;
  
        //scaling projected coords to the screen coords
        // if curve is positive then it goes right
        // if neg, then left
        // if zero then straight
        point.screen.x = Math.round((1 + projectedX) * SCR_CX + curve); // curve
  
        point.screen.y = Math.round((1 - projectedY) * SCR_CY);
        point.screen.w = Math.round(projectedW * SCR_CX);
      }
  
      // render 3D road view
      render3D(scene) {
        this.graphics.clear();
  
        // define the clipping bottom line to render only segments above it
        var clipBottomLine = HEIGHT;
  
        //get base segment
        var baseSegment = this.getSegment(camera.z);
        var baseIndex = baseSegment.index;
        for ( var n = 0; n < this.visible_segments; n++) {
          //get current segment
          var currIndex = (baseIndex + n) % this.total_segments;
          var currSegment = this.segments[currIndex];
  
          // get the camera offset-Z to loop back the road
                var offsetZ = (currIndex < baseIndex) ? this.roadLength : 0;
  
          //get curve value of current segment
          this.cv = currSegment.curve;
  
          //project current segment to screen
          this.project3D(currSegment.point, camera.x, camera.y, camera.z-offsetZ, camera.distToPlane, this.cv);
          // draw this segment only if it is above the clipping bottom line
          var currBottomLine = currSegment.point.screen.y;
  
          if (n>0 && currBottomLine < clipBottomLine){
            var prevIndex = (currIndex>0) ? currIndex-1 : this.total_segments-1;
            var prevSegment = this.segments[prevIndex];
  
            var p1 = prevSegment.point.screen;
            var p2 = currSegment.point.screen;
  
            this.drawSegment(
              p1.x, p1.y, p1.w,
              p2.x, p2.y, p2.w,
              currSegment.color
            );
          }//endif
        }//endfor
  
        //draw all visible objects on rendering texture
        this.texture.clear();
  
        //draw player sprite
        this.texture.draw(player.sprite, player.screen.x, player.screen.y);
      }
  
      drawSegment(x1, y1, w1, x2, y2, w2, color) {
        //grass
        this.graphics.fillStyle(color.grass, 1);
        this.graphics.fillRect(0, y2, WIDTH, y1-y2);
  
        //draw road
        this.drawPolygon(x1-w1, y1,	x1+w1, y1, x2+w2, y2, x2-w2, y2, color.road);
  
        //draw rumble strips
        var rumble_w1 = w1/5;
        var rumble_w2 = w2/5;
        this.drawPolygon(x1-w1-rumble_w1, y1, x1-w1, y1, x2-w2, y2, x2-w2-rumble_w2, y2, color.rumble);
            this.drawPolygon(x1+w1+rumble_w1, y1, x1+w1, y1, x2+w2, y2, x2+w2+rumble_w2, y2, color.rumble);
  
        // draw lanes
        if (color.lane) {
          var line_w1 = (w1/20) / 2;
          var line_w2 = (w2/20) / 2;
  
          var lane_w1 = (w1*2) / this.roadLanes;
          var lane_w2 = (w2*2) / this.roadLanes;
  
          var lane_x1 = x1 - w1;
          var lane_x2 = x2 - w2;
  
          for(var i=1; i<this.roadLanes; i++){
            lane_x1 += lane_w1;
            lane_x2 += lane_w2;
  
            this.drawPolygon(
              lane_x1-line_w1, y1,
              lane_x1+line_w1, y1,
              lane_x2+line_w2, y2,
              lane_x2-line_w2, y2,
              color.lane
            );
          }
        }
      }
  
      drawPolygon(x1, y1, x2, y2, x3, y3, x4, y4, color) {
        this.graphics.fillStyle(color, 1);
        this.graphics.beginPath();
  
        this.graphics.moveTo(x1, y1);
        this.graphics.lineTo(x2, y2);
        this.graphics.lineTo(x3, y3);
        this.graphics.lineTo(x4, y4);
  
        this.graphics.closePath();
        this.graphics.fill();
        //console.log("Draw Poly");
      }
    }// Circuit
  
  
    class Player {
      constructor(scene) {
        this.scene = scene;
  
        // reference to the player sprite
        ratrod = scene.add.sprite(0, 0).setVisible(false);
        this.sprite = ratrod.play('idle');
  
        // player world coordinates
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.w = (this.sprite.width/WIDTH)*2;
  
        // player screen coordinates
        this.screen = {x:0, y:0, w:0, h:0};
  
        // max speed (to avoid moving for more than 1 road segment, assuming fps=60)
        this.maxSpeed = ((circuit.segmentLength) / step)/FPS;
        console.log(this.maxSpeed);
  
        // driving control parameters
        this.speed = 0;	 // current speed
        this.easing = 1;
  
      }
  
      init() {
        // set the player screen size
        this.screen.w = this.sprite.width/2;
        this.screen.h = this.sprite.height;
  
        // set the player screen position
        this.screen.x = SCR_CX;
        this.screen.y = HEIGHT - this.screen.h/2;
      }
  
      /**
        * Restarts player.
        */
        restart(){
            this.x = 0;
            this.y = 0;
            this.z = 0;
  
            if (this.speed >= this.maxSpeed) this.speed = this.maxSpeed;
        }
  
        /**
        * Updates player position.
        */
        update(scene){
        this.scene = scene;
        this.easing -= .01;
  
        if ( this.easing <= 0 ) this.easing = 1;
        // Acceleration
        if ( pedalFlag ) {
            this.speed += scene.accel;
            //check for rumble-strip, slow down
            // uses camera.x to determine position
            // road width is 1000
            if ( camera.x >= 640 || camera.x <= -640 ) this.speed *= .95; //slow down by 5% each cycle
            if (this.speed >= this.maxSpeed) this.speed = this.maxSpeed;
        }
        // Slowing down when coasting and accelerator is not pressed
        if ( !pedalFlag && (player.speed > 0)) {
            this.speed -= this.easing;
            if (this.speed <= 0) {
              this.speed = 0;
              this.sprite = ratrod.play('idle');
            }
        }
            // ---------------------------------------------------------------------------------
            // Moving in Z-direction
            // ---------------------------------------------------------------------------------
            this.z += this.speed;
            if (this.z >= circuit.roadLength) this.z -= circuit.roadLength;
        }
    }
  
  
  
      class Camera
      {
        constructor(scene) {
          //ref to main Scene
          this.scene = scene;
  
          //camera world coordinates
          this.x = 0;
          this.y = SCR_CY;
          this.z = 0;
  
          this.distToPlayer = null;
  
          //define camera depth
          this.distToPlane = null;
        }
  
        //initialze camera to be called when init game or changing Settings
        init() {
          //Z distance between camera and player, to avoid div by zero console.error
          this.distToPlayer = newCamDistance;
          console.log(this.distToPlayer);
  
          this.distToPlane = 1 / (this.y / this.distToPlayer); //calculate tangent
        }
  
        //update camera position
        update() {
  
          // place the camera behind the player at the desired distance
          this.z = player.z - this.distToPlayer;
  
          // don't let camera Z to go negative
          if (this.z<0) this.z += circuit.roadLength;
        }
      }
  
  
  
    //===========================================================================
    //===========================================================================
    // MAIN GAME LOOP CLASS
    //===========================================================================
    //===========================================================================
    class Game extends Phaser.Scene {
      constructor() {
        super({key: 'Scene'});
  
        this.accel = 1; //acceleration factor
        this.spacebar = null;
        this.turn = 15; //f the amount the car moves when turning
        this.centrifugal = .5; // apply force when player goes around curves
      }
  
      // =============================================================================
      // =============================================================================
      // GAME CONTROLS AND LISTENERS
      // =============================================================================
      // =============================================================================
  
      init() {
          FPSMETER.tickStart();
  
          // LISTENERS
          // listener to pause game
                this.input.keyboard.on('keydown-P', function(){
              console.log("Game is Paused. Press [P] to resume.");
                    this.settings.txtPause.text = "[P] Resume";
                    this.scene.pause();
                    this.scene.launch('Pause');
              }, this);
  
              // listener on resume event
              this.events.on('resume', function(){
                  this.settings.show();
              }, this);
  
          // LISTENERS FOR GAME CONTROLS
          this.up = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
  
          // up-arrow pressed = accelerator
          this.input.keyboard.on('keydown-UP', function(){
              if ( player.speed <= player.maxSpeed ) {
                pedalFlag = true;
                this.sprite = ratrod.play('drive');
              }
          }, this);
          // up-arrow not pressed = decelleration
          this.input.keyboard.on('keyup-UP', function(){
                pedalFlag = false;
          }, this);
          // left-arrow - turn left
  
          this.input.keyboard.on('keydown-A', function(){
            var phys = this.centrifugal * player.speed/100; //physics for centrifugal force multiplier
            // allow turning only if player is moving forward
            if (player.speed > 0)  {
                player.screen.x -= this.turn*phys;
                this.sprBack2.x -= this.turn*phys*.15; //move landscape parallax
                this.sprBack3.x -= this.turn*phys*.35;
                camera.x -= this.turn*phys*3; // move camera in parallax to player
              }
          }, this);
          // right-arrow = turn right
          this.input.keyboard.on('keydown-D', function(){
            var phys = this.centrifugal * player.speed/100;
            if (player.speed > 0)  {
                player.screen.x += this.turn*phys;
                this.sprBack2.x += this.turn*phys*.15;
                this.sprBack3.x += this.turn*phys*.35;
                camera.x += this.turn*phys*3;
              }
          }, this);
  
          }// init()
        // =============================================================================
        // =============================================================================
  
  
      //load assets
      preload() {
        this.load.image('imgBg1', '/assets/background1.png');
        this.load.image('imgBg2', '/assets/mountains.png');
        this.load.image('imgBg3', '/assets/foothills.png');
        this.load.spritesheet('imgPlayer', '/assets/ratrod_sprite.png', {frameWidth: 600, frameHeight: 228});
      }
  
  
  
      // ************************************************************************
      // ************************************************************************
      // CREATE OBJECTS
      // ************************************************************************
      // ************************************************************************
      create() {
        // backgrounds
        this.sprBack = this.add.image(SCR_CX, SCR_CY, 'imgBg1');
        //landscape backgrounds
        this.sprBack2 = this.add.image(SCR_CX, SCR_CY-100, 'imgBg2');
        this.sprBack3 = this.add.image(SCR_CX, SCR_CY-30, 'imgBg3');
  
  
        // array of sprites that will be "manually" drawn on a rendering texture
        // (that's why they must be invisible after creation)
        this.sprites = [
          this.add.sprite(0, 0,'imgPlayer', '__BASE').setVisible(false)
        ]
  
        //sprite animations
        this.anims.create({
          key: "drive",
          frames: this.anims.generateFrameNumbers('imgPlayer', { frames: [0, 1] }),
          frameRate: 8,
          repeat: -1
        });
        this.anims.create({
          key: "idle",
          frames: this.anims.generateFrameNumbers('imgPlayer', { frames: [2] }),
          frameRate: 8,
          repeat: 0
        });
  
        const keys = [ 'drive', 'idle' ];
  
        //instances -- the order of these determines rendering layers
        gameprops = new SetGameProperties(this); //set properties that can be adjusted in real time
        circuit = new Circuit(this); //circuit is global
        player = new Player(this); // global player
        camera = new Camera(this); // global camera to be able access varS
        this.settings = new Settings(this);
      }
      // ************************************************************************
      // ************************************************************************
  
  
  
  
      // ************************************************************************
      // ************************************************************************
      // MAIN GAME LOOP
      // ************************************************************************
      // ************************************************************************
      update(dt) {
        FPSMETER.tick();
              switch(state) {
                   case STATE_INIT :
                     //console.log("Init Game...");
                     gameprops.init();
                     camera.init();
                     player.init();
                     state = STATE_RESTART;
                     break;
  
                   case STATE_RESTART :
                     //console.log("Restart Game...");
                     circuit.create();
                     player.restart();
                     state = STATE_PLAY;
                     break;
  
                   case STATE_PLAY :
                     //console.log("Playing Game...");
                     gameprops.update();
                     player.update(this);
                     camera.update();
                     circuit.render3D(this);
                     //state = STATE_GAMEOVER;
                     break;
  
                   case STATE_GAMEOVER :
                     //console.log("Game Over.");
                     break;
                   }
              //console.log(state);
        }// update()
        // ************************************************************************
        // ************************************************************************
  
    }
    // END Game Loop Class
    //===========================================================================
  
  
  
    // PAUSE
    class GamePause extends Phaser.Scene
    {
      constructor() {
        super({key: 'Pause'});
      }
      create(){
        // listener to resume game
        this.input.keyboard.on('keydown-P', function(){
          console.log("Game is Resumed.");
          this.scene.resume('Scene');
          this.scene.stop();
        }, this);
      }
    } // Pause
  
  
  // ==================================
  // INIT
  // ==================================
  
  function phaserInit() {
      var config = {
        type: Phaser.AUTO,
        width: WIDTH,
        height: HEIGHT,
        pixelArt: false,
  
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
  
        scene: [Game, GamePause],
      }
      const gameEng = new Phaser.Game(config);
      return gameEng;
    }
  
    const game = new Game(phaserInit());
  
  
    //===================================
    // LET'S GO!
    //===================================
  
    function run() {
      now   = timestamp();
  
      if (initFlag) {
        game.update(updateDuration(now));
      }
      requestAnimationFrame(run); // request the next frame
    }
    run();
  
    requestAnimationFrame(run); // start the first frame
  
  
  })();
  