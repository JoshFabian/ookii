/* global io, Promise, Phaser */
import 'babel-polyfill';
import inside from 'point-in-polygon';
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

const createSprit = (x, y, data, frame, group) => {
  return GAME.add.tileSprite(x * UNIT, y * UNIT, UNIT, UNIT, data, frame, group);
};

const bringToTop = (groupOrSprite) => {
  GAME.world.bringToTop(groupOrSprite);
};

class Player {
  constructor(user) {
    this.user = user;
    this.color = user.color;
    this.x = user.x;
    this.y = user.y;
    this.polyPoints = [];
    this.top = null;
    this.left = null;
    this.right = null;
    this.bottom = null;

    this.group = GAME.add.group();
    this.tail = GAME.add.group();
    this.group.add(this.tail);

    this.sprite = createSprit(this.x, this.y, 'player', 5, this.group);
    GAME.camera.follow(this.sprite);
    GAME.physics.arcade.enable(this.sprite);
    this.sprite.body.collideWorldBounds = true;

    this.timer = null;
    this.moveingX = false;
    this.moveingY = false;
    this.hasTimer = false;
    this.direction = UP;

    this.bringToTop = bringToTop.bind(this, this.group);
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
    return new Promise(() => {
      this.user.x = this.x;
      this.user.y = this.y;
      SOCKET.emit('move_user', this.user);
    });
  }

  addTailSection(x, y, dir) {
    let tail;
    if (dir === UP || dir === LEFT) {
      const set = (dir === UP ? 'verTails' : 'horTails');
      tail = createSprit((x + 1), (y + 1), set, 0, this.tail);
      tail.rotation = Math.PI;
    }
    if (dir === DOWN || dir === RIGHT) {
      const set = (dir === DOWN ? 'verTails' : 'horTails');
      tail = createSprit(x, y, set, 0, this.tail);
    }
    tail.animations.add('move');
    tail.animations.play('move', 20, true);
    this.polyPoints.push([ x, y ]);

    if (this.top === null || y < this.top) { this.top = y; }
    if (this.bottom === null || y > this.bottom) { this.bottom = y; }
    if (this.left === null || x < this.left) { this.left = x; }
    if (this.right === null || x > this.right) { this.right = x; }
  }

  flipTiles() {
    if (this.top !== null && this.bottom !== null && this.left !== null && this.right !== null) {
      const pointsInPoly = [];
      for (let y = this.top; y <= this.bottom; y++) {
        for (let x = this.left; x <= this.right; x++) {
          if (!this.userTile(x, y) && inside([x, y], this.polyPoints)) {
            pointsInPoly.push([x, y]);
          }
        }
      }
      SOCKET.emit('flip_tiles', { user: this.user, tiles: pointsInPoly });
    }
    this.top = null;
    this.left = null;
    this.right = null;
    this.bottom = null;
    this.polyPoints = [];
  }

  clearTail() {
    this.tail.removeAll();
    this.flipTiles();
  }

  userTile(x, y) {
    if (typeof TILES === 'undefined') { return false; }
    if (TILES[y][x].user === null) { return false; }
    if (TILES[y][x].user === this.user._id) { return true; }
    return false;
  }

  _moveAttr(baseAttr, change) {
    if (typeof TILES === 'undefined') { return null; }
    const attr = baseAttr.toString().toLowerCase();
    const moveing = `moveing${attr.toUpperCase()}`;
    const dir = this.direction;

    return setTimeout(() => {
      if (!this[moveing]) {
        this[moveing] = true;
        const old = {
          x: this.x,
          y: this.y,
        };
        let madeChange = false;
        if (old[attr] + change >= 0 && old[attr] + change < SIZE) {
          madeChange = true;
          this[attr] += change;
          this.sprite[attr] = this[attr] * UNIT;
          this.sendUpdate();
        }

        setTimeout(() => {
          if (madeChange) {
            if (!this.userTile(old.x, old.y)) {
              this.addTailSection(old.x, old.y, dir);
            }
            if (this.userTile(this.x, this.y)) {
              this.clearTail();
            }
          }
          this[moveing] = false;
        }, 100);
      }
    }, 20);
  }

  moveX(change) {
    return this._moveAttr('x', change);
  }

  moveY(change) {
    return this._moveAttr('y', change);
  }
}

class Enemy {
  constructor({ x, y, user }) {
    this.user = user;
    this.x = x;
    this.y = y;
    this.group = GAME.add.group();
    this.sprite = createSprit(x, y, 'player', 1, this.group);

    this.bringToTop = bringToTop.bind(this, this.group);
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
        // console.log('current map');
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

      SOCKET.on(`update_map_${roomId}`, ({ tiles, newTiles }) => {
        TILES = tiles;
        new Promise(() => {
          for (const tile of newTiles) {
            MAP.putTile(tile.color, tile.x, tile.y);
          }
        });
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
