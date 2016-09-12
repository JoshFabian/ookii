/* global io, Promise, Phaser */
import 'babel-polyfill';

import { randOf } from './utils.js';

let GAME;
let SOCKET;
let CURRENT_USER;
let TILES;
let CSV;
let MAP;
let LAYER;

const SIZE = 200;
const UNIT = 32;

const UP = 'up';
const DOWN = 'down';
const LEFT = 'left';
const RIGHT = 'right';

class Player {
  constructor(user) {
    this.user = user;
    this.color = user.color;
    this.x = user.x;
    this.y = user.y;
    this.group = GAME.add.group();
    this.tail = GAME.add.group();
    this.group.add(this.tail);
    this.sprite = GAME.add.tileSprite(this.x * UNIT, this.y * UNIT, UNIT, UNIT, 'player', 5, this.group);
    GAME.camera.follow(this.sprite);
    GAME.physics.arcade.enable(this.sprite);
    this.sprite.body.collideWorldBounds = true;
    this.timer = null;
    this.moveingX = false;
    this.moveingY = false;
    this.hasTimer = false;
    this.direction = UP;
  }

  bringToTop() {
    GAME.world.bringToTop(this.group);
  }

  setDirection(dir) {
    this.hasTimer = false;
    this.direction = dir;
  }

  update() {
    if (!this.hasTimer) {
      this.hasTimer = true;
      if (this.direction === UP) {
        this.timer = this.moveY.bind(this, -1);
      } else if (this.direction === DOWN) {
        this.timer = this.moveY.bind(this, 1);
      } else if (this.direction === LEFT) {
        this.timer = this.moveX.bind(this, -1);
      } else if (this.direction === RIGHT) {
        this.timer = this.moveX.bind(this, 1);
      }
    }
    this.timer();
  }

  sendUpdate() {
    new Promise(() => {
      this.user.x = this.x;
      this.user.y = this.y;
      SOCKET.emit('move_user', this.user);
    });
  }

  addTailSection(x, y, dir) {
    let tail;
    if (dir === UP) {
      tail = GAME.add.tileSprite((x + 1) * UNIT, (y + 1) * UNIT, UNIT, UNIT, 'verTails', 0, this.tail);
      tail.rotation = Math.PI;
    }
    if (dir === DOWN) {
      tail = GAME.add.tileSprite(x * UNIT, y * UNIT, UNIT, UNIT, 'verTails', 0, this.tail);
    }
    if (dir === LEFT) {
      tail = GAME.add.tileSprite((x + 1) * UNIT, (y + 1) * UNIT, UNIT, UNIT, 'horTails', 0, this.tail);
      tail.rotation = Math.PI;
    }
    if (dir === RIGHT) {
      tail = GAME.add.tileSprite(x * UNIT, y * UNIT, UNIT, UNIT, 'horTails', 0, this.tail);
    }
    tail.animations.add('move');
    tail.animations.play('move', 20, true);
  }

  clearTail() {
    this.tail.removeAll();
  }

  userTile(x, y) {
    if (typeof TILES === 'undefined') { return false; }
    if (TILES[y][x].user === null) { return false; }
    if (TILES[y][x].user === this.user._id) { return true; }
    return false;
  }

  moveX(change) {
    if (typeof TILES === 'undefined') { return null; }
    const dir = this.direction;
    return setTimeout(() => {
      if (!this.moveingX) {
        this.moveingX = true;
        const oldX = this.x;
        let madeChange = false;
        if (oldX + change >= 0 && oldX + change < SIZE) {
          madeChange = true;
          this.x += change;
          this.sprite.x = this.x * UNIT;
          this.sendUpdate();
        }
        setTimeout(() => {
          if (madeChange) {
            if (!this.userTile(oldX, this.y)) {
              this.addTailSection(oldX, this.y, dir);
            }
            if (this.userTile(this.x, this.y)) {
              this.clearTail();
            }
          }
          this.moveingX = false;
        }, 100);
      }
    }, 20);
  }

  moveY(change) {
    if (typeof TILES === 'undefined') { return null; }
    const dir = this.direction;
    return setTimeout(() => {
      if (!this.moveingY) {
        this.moveingY = true;
        const oldY = this.y;
        let madeChange = false;
        if (oldY + change >= 0 && oldY + change < SIZE) {
          madeChange = true;
          this.y += change;
          this.sprite.y = this.y * UNIT;
          this.sendUpdate();
        }
        setTimeout(() => {
          if (madeChange) {
            if (!this.userTile(this.x, oldY)) {
              this.addTailSection(this.x, oldY, dir);
            }
            if (this.userTile(this.x, this.y)) {
              this.clearTail();
            }
          }
          this.moveingY = false;
        }, 100);
      }
    }, 20);
  }
}

class Enemy {
  constructor({ x, y, user }) {
    this.user = user;
    this.x = x;
    this.y = y;
    this.group = GAME.add.group();
    this.sprite = GAME.add.tileSprite(x * UNIT, y * UNIT, UNIT, UNIT, 'player', 1, this.group);
  }

  bringToTop() {
    GAME.world.bringToTop(this.group);
  }

  animateTo(x, y) {
    this.x = x;
    this.y = y;
    this.sprite.x = x * UNIT;
    this.sprite.y = y * UNIT;
  }
}

class Game {
  constructor() {
    this.enemies = {};
  }

  preload() {
    GAME.stage.backgroundColor = '#2c3e50';

    GAME.load.spritesheet('player', '/public/chara0.png', UNIT, UNIT, 36);
    GAME.load.spritesheet('colors', '/public/colors.png', UNIT, UNIT, 51);
    GAME.load.spritesheet('tails', '/public/tails.png', UNIT, UNIT, 51);
    GAME.load.spritesheet('horTails', '/public/hor.png', UNIT, UNIT, 3);
    GAME.load.spritesheet('verTails', '/public/ver.png', UNIT, UNIT, 3);

    SOCKET = io.connect('http://localhost:4000');
  }

  create() {

    //  Modify the world and camera bounds
    GAME.world.resize(SIZE * UNIT, SIZE * UNIT);

    SOCKET.emit('join', {
      name: 'test' + Date.now(),
      color: randOf(48) + 1,
      x: randOf(SIZE),
      y: randOf(SIZE),
    });

    SOCKET.on('me', (user, roomId) => {
      CURRENT_USER = user;
      this.player = new Player(CURRENT_USER);

      SOCKET.on(`users_${roomId}`, (users) => {
        for (const enemy of users.filter((u) => (u._id !== CURRENT_USER._id))) {
          if (Object.keys(this.enemies).indexOf(enemy._id) > -1) {
            this.enemies[enemy._id].animateTo(enemy.x, enemy.y);
          } else {
            this.enemies[enemy._id] = new Enemy(enemy);
          }
          if (typeof MAP !== 'undefined') {
            this.enemies[enemy._id].bringToTop();
          }
        }
      });

      SOCKET.on(`map_${roomId}`, ({ tiles, csv }) => {
        // if (typeof TILES === 'undefined') {
        TILES = tiles;
        CSV = csv;
        GAME.cache.addTilemap('dynamicMap', null, CSV, Phaser.Tilemap.CSV);
        //  Create our map (the 16x16 is the tile size)
        MAP = GAME.add.tilemap('dynamicMap', UNIT, UNIT);

        //  'tiles' = cache image key, UNITxUNIT = tile size
        MAP.addTilesetImage('colors', 'colors');

        //  0 is important
        LAYER = MAP.createLayer(0);

        //  Scroll it
        LAYER.resizeWorld();

        this.player.bringToTop();
        if (Object.keys(this.enemies).length > 0) {
          for (const id of Object.keys(this.enemies)) {
            this.enemies[id].bringToTop();
          }
        }
        // }
      });
    });

    this.cursors = GAME.input.keyboard.createCursorKeys();
  }

  update() {
    if (typeof this.player !== 'undefined') {
      if (this.cursors.up.isDown) {
        this.player.setDirection(UP);
      } else if (this.cursors.down.isDown) {
        this.player.setDirection(DOWN);
      } else if (this.cursors.left.isDown) {
        this.player.setDirection(LEFT);
      } else if (this.cursors.right.isDown) {
        this.player.setDirection(RIGHT);
      }
      this.player.update();
    }
  }

  render() {
    GAME.debug.cameraInfo(GAME.camera, UNIT, UNIT);
  }
}

GAME = new Phaser.Game('100%', '100%', Phaser.CANVAS, 'phaser-example', new Game());
