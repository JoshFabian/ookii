
const getScale = (width, height) => {
  const data = { width: 1, height: 1 };
  if (width > height) {
    data.width = width / height;
  } else if (width < height) {
    data.height = height / width;
  }

  return data;
};


class Rectangle {
  constructor(left = 0, top = 0, width = 0, height = 0) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;

    this.right = this.left + this.width;
    this.bottom = this.top + this.height;
  }

  set = (left, top, width, height) => {
    this.left = left;
    this.top = top;
    this.width = width || this.width;
    this.height = height || this.height;
    this.right = (this.left + this.width);
    this.bottom = (this.top + this.height);
  };

  within = (r) => {
    return (
      r.left <= this.left &&
      r.right >= this.right &&
      r.top <= this.top &&
      r.bottom >= this.bottom
    );
  };

  overlaps = (r) => {
    return (
      this.left < r.right &&
      r.left < this.right &&
      this.top < r.bottom &&
      r.top < this.bottom
    );
  }
}


// possibles axis to move the camera
const AXIS = {
  NONE: 'none',
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  BOTH: 'both',
};

class Camera {
  constructor(xView = 0, yView = 0, canvasWidth, canvasHeight, worldWidth, worldHeight) {
    // position of camera (left-top coordinate)
    this.xView = xView;
    this.yView = yView;

    // distance from followed object to border before camera starts move
    this.xDeadZone = 0; // min distance to horizontal borders
    this.yDeadZone = 0; // min distance to vertical borders

    // viewport dimensions
    this.wView = canvasWidth;
    this.hView = canvasHeight;

    // allow camera to move in vertical and horizontal axis
    this.axis = AXIS.BOTH;

    // object that should be followed
    this.followed = null;

    // rectangle that represents the viewport
    this.viewportRect = new Rectangle(this.xView, this.yView, this.wView, this.hView);

    // rectangle that represents the world's boundary (room's boundary)
    this.worldRect = new Rectangle(0, 0, worldWidth, worldHeight);
  }

  // gameObject needs to have "x" and "y" properties (as world(or room) position)
  follow = (gameObject, xDeadZone, yDeadZone) => {
    this.followed = gameObject;
    this.xDeadZone = xDeadZone;
    this.yDeadZone = yDeadZone;
  };

  update = () => {
    // keep following the player (or other desired object)
    if (this.followed !== null) {
      if (this.axis === AXIS.HORIZONTAL || this.axis === AXIS.BOTH) {
        // moves camera on horizontal axis based on followed object position
        if (this.followed.x - this.xView + this.xDeadZone > this.wView) {
          this.xView = this.followed.x - (this.wView - this.xDeadZone);
        } else if (this.followed.x - this.xDeadZone < this.xView) {
          this.xView = this.followed.x - this.xDeadZone;
        }
      }

      if (this.axis === AXIS.VERTICAL || this.axis === AXIS.BOTH) {
        // moves camera on vertical axis based on followed object position
        if (this.followed.y - this.yView + this.yDeadZone > this.hView) {
          this.yView = this.followed.y - (this.hView - this.yDeadZone);
        } else if (this.followed.y - this.yDeadZone < this.yView) {
          this.yView = this.followed.y - this.yDeadZone;
        }
      }
    }

    // update viewportRect
    this.viewportRect.set(this.xView, this.yView);

    // don't let camera leaves the world's boundary
    if (!this.viewportRect.within(this.worldRect)) {
      if (this.viewportRect.left < this.worldRect.left) {
        this.xView = this.worldRect.left;
      }

      if (this.viewportRect.top < this.worldRect.top) {
        this.yView = this.worldRect.top;
      }

      if (this.viewportRect.right > this.worldRect.right) {
        this.xView = this.worldRect.right - this.wView;
      }

      if (this.viewportRect.bottom > this.worldRect.bottom) {
        this.yView = this.worldRect.bottom - this.hView;
      }
    }
  };
}


class Player {
  constructor(x, y, width, height) {
    // (x, y) = center of object
    // ATTENTION:
    // it represents the player position on the world(room), not the canvas position
    this.x = x;
    this.y = y;

    // move speed in pixels per second
    this.speed = 400;

    // render properties
    this.width = width;
    this.height = height;

    this.onMove = () => {};
  }

  moveTo = (x, y) => {
    this.x = x;
    this.y = y;
  };

  setInputManager = (inputManager, step) => {
    inputManager.setChangeHandler((controls) => {
      // check controls and move the player accordingly
      if (controls.left) {
        this.x -= this.speed * step;
      }
      if (controls.up) {
        this.y -= this.speed * step;
      }
      if (controls.right) {
        this.x += this.speed * step;
      }
      if (controls.down) {
        this.y += this.speed * step;
      }
    });
    return this;
  }

  update = (step, worldWidth, worldHeight, controls) => {
    // parameter step is the time between frames ( in seconds )

    // don't let player leaves the world's boundary
    if ((this.x - (this.width / 2)) < 0) {
      this.x = this.width / 2;
    }
    if ((this.y - (this.height / 2)) < 0) {
      this.y = this.height / 2;
    }
    if ((this.x + (this.width / 2)) > worldWidth) {
      this.x = worldWidth - (this.width / 2);
    }
    if ((this.y + (this.height / 2)) > worldHeight) {
      this.y = worldHeight - (this.height / 2);
    }
  };

  draw = (context, xView, yView) => {
    // draw a simple rectangle shape as our player model
    context.save();
    context.fillStyle = 'black';
    // before draw we need to convert player world's position to canvas position
    const scale = getScale(this.width, this.height);
    console.log((this.x - ((this.width * scale.width) / 2)) - xView,
    (this.y - ((this.height * scale.height) / 2)) - yView,
    this.width * scale.width,
    this.height * scale.height);
    context.fillRect(
      (this.x - ((this.width * scale.width) / 2)) - xView,
      (this.y - ((this.height * scale.height) / 2)) - yView,
      this.width * scale.width,
      ((this.height * scale.height) / 2)
    );
    context.restore();
  };
}

class Map {
  constructor(width, height, element) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('style', `
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1000;
    `);
    element.appendChild(this.canvas);
    // map dimensions
    this.width = width;
    this.height = height;

    // map texture
    this.image = null;
    this.hasChanged = true;
  }

  // generate an example of a large map
  generate = () => {
    var ctx = this.canvas.getContext('2d');
    ctx.canvas.width = this.width;
    ctx.canvas.height = this.height;

    var rows = ~~(this.width / 32) + 1;
    var columns = ~~(this.height / 32) + 1;

    var color = 'red';
    ctx.save();
    ctx.fillStyle = 'red';
    for (var x = 0, i = 0; i < rows; x += 16, i++) {
      ctx.beginPath();
      for (var y = 0, j = 0; j < columns; y += 16, j++) {
        ctx.rect(x, y, 15, 15);
      }
      color = (color === 'red' ? 'blue' : 'red');
      ctx.fillStyle = color;
      ctx.fill();
      ctx.closePath();
    }
    ctx.restore();

    // store the generate map as this image texture
    this.image = new Image();
    this.image.src = ctx.canvas.toDataURL('image/png');

    // clear context
    ctx = null;
  }

  // draw the map adjusted to camera
  draw = (context, xView, yView) => {
    if (this.hasChanged) {
      this.hasChanged = false;
      // easiest way: draw the entire map changing only the destination coordinate in canvas
      // canvas will cull the image by itself (no performance gaps -> in hardware accelerated environments, at least)
      //context.drawImage(this.image, 0, 0, this.image.width, this.image.height, -xView, -yView, this.image.width, this.image.height);
      context = this.canvas.getContext('2d');

      // didactic way:
      var sx, sy, dx, dy;
      var sWidth, sHeight, dWidth, dHeight;

      // offset point to crop the image
      sx = xView;
      sy = yView;

      // dimensions of cropped image
      sWidth = context.canvas.width;
      sHeight = context.canvas.height;

      // if cropped image is smaller than canvas we need to change the source dimensions
      if (this.image.width - sx < sWidth) {
        sWidth = this.image.width - sx;
      }
      if (this.image.height - sy < sHeight) {
        sHeight = this.image.height - sy;
      }

      // location on canvas to draw the croped image
      dx = 0;
      dy = 0;
      // match destination with source to not scale the image
      const scale = getScale(sWidth, sHeight);
      dWidth = sWidth * scale.width;
      dHeight = sHeight * scale.height;

      context.drawImage(this.image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
    }
  }
}

class InputManager {
  constructor() {
    this.controls = {
      left: false,
      up: false,
      right: false,
      down: false,
      pause: false,
    };

    this.handleChange = () => {};

    window.addEventListener('keydown', this.handleKey, false);
    window.addEventListener('keyup', this.handleKey, false);
  }

  handleKey = (e) => {
    switch(e.keyCode) {
    case 37: // left arrow
      this.controls.left = !this.controls.left;
      this.handleChange(this.controls);
      break;
    case 38: // up arrow
      this.controls.up = !this.controls.up;
      this.handleChange(this.controls);
      break;
    case 39: // right arrow
      this.controls.right = !this.controls.right;
      this.handleChange(this.controls);
      break;
    case 40: // down arrow
      this.controls.down = !this.controls.down;
      this.handleChange(this.controls);
      break;
    }
  };

  setChangeHandler = (onChange) => {
    this.handleChange = onChange;
  };
}

class Game {
  constructor(element) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('style', `
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1000;
      width: ${element.clientWidth}px;
      height ${element.clientHeight}px;
    `);
    element.appendChild(this.canvas);
    this.context = this.canvas.getContext('2d');
    this.inputManager = new InputManager();
    this.elements = [];

    // game settings:
    this.runningId = false;
    this.setFPS(30);
  }

  setFPS = (fps) => {
    this.fps = fps;
    this.interval = 1000 / fps; // milliseconds
    this.step = this.interval / 1000; // seconds
  };

  setScene = (width, height, map, focus) => {
    this.width = width;
    this.height = height;
    this.map = map;
    this.focus = focus.setInputManager(this.inputManager, this.step);

    // generate a large image texture for the room
    this.map.generate();

    // setup the magic camera !!!
    this.camera = new Camera(0, 0, this.canvas.clientWidth, this.canvas.clientHeight, this.width, this.height);
    this.camera.follow(this.focus, this.canvas.clientWidth / 2, this.canvas.clientHeight / 2);
  };

  addToScene = (gameObject) => {
    this.elements.push(gameObject);
  };

  // Game update function
  update = () => {
    this.focus.update(this.step, this.width, this.height, this.inputManager.controls);
    this.elements.forEach((e) => {
      e.update(this.step, this.width, this.height, this.inputManager.controls);
    });
    this.camera.update();
  };

  // Game draw function
  draw = () => {
    // clear the entire canvas
    this.context.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

    // redraw all objects
    this.map.draw(this.context, this.camera.xView, this.camera.yView);
    this.focus.draw(this.context, this.camera.xView, this.camera.yView);
    this.elements.forEach((e) => {
      e.draw(this.context, this.camera.xView, this.camera.yView);
    });
  };

  // Game Loop
  loop = () => {
    if (this.runningId) {
      this.update();
      this.draw();
      window.requestAnimationFrame(this.loop);
    }
  }

  // <-- configure play/pause capabilities:
  play = () => {
    this.runningId = true;
    console.log('play');
    window.requestAnimationFrame(this.loop);
  }

  togglePause = () => {
    if (this.runningId === false) {
      this.play();
    } else {
      this.runningId = false;
      console.log('paused');
    }
  }
  // -->
}

// start the game when page is loaded
window.onload = function() {
  const element = document.getElementById('game');
  console.log('first', element.clientWidth, element.clientHeight)
  const sacle = getScale(element.clientWidth, element.clientHeight);
  const size = 200 * 32;
  const player = new Player(32, 32, 32 * sacle.width, 32 * sacle.height);
  const map = new Map(size * 2, size * 2, element);
  const MyGame = new Game(element);
  MyGame.setScene(size, size, map, player);
  MyGame.play();
  window.addEventListener('keyup', (e) => {
    if (e.keyCode === 80) { // key P pauses the game
      MyGame.togglePause();
    }
  }, false);
};
