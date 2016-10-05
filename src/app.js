/* global io, Promise, Phaser */
import 'babel-polyfill';
import inside from 'point-in-polygon';
import { randOf } from './utils.js';
import { isUndefined, find } from 'lodash';

let GAME;
let SOCKET;
let CURRENT_USER;
let TILES;
let CSV;
let MAP;
let LAYER;

let TAIL_DATA = [];

const SIZE = 200;
const UNIT = 32;

const UP = 'up';
const DOWN = 'down';
const LEFT = 'left';
const RIGHT = 'right';

const addClass = (elm, klass) => {
  elm.className += ` ${klass}`;
};

const removeClass = (elm, klass) => {
  elm.className = elm.className.replace(klass, '').trim();
};

const killPlayer = (player, byPlayer) => {
  SOCKET.emit('kill_user', { player, byPlayer });
};

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
    this.user.tailData = '';

    this.group = GAME.add.group();
    this.tail = GAME.add.group();
    this.group.add(this.tail);

    this.sprite = createSprit(this.x, this.y, 'player', 5, this.group);
    GAME.camera.follow(this.sprite);
    GAME.physics.arcade.enable(this.sprite);
    this.sprite.body.collideWorldBounds = true;

    let style = { font: 'bold 12px Arial', fill: '#ffffff', align: 'center' };
    this.label = GAME.add.text(0, -10, this.user.name, style);
    this.label.anchor.set(0);
    this.label.x = (UNIT / 2) - (this.label.width / 2);
    this.sprite.addChild(this.label);

    this.timer = null;
    this.moveingX = false;
    this.moveingY = false;
    this.hasTimer = false;
    this.direction = UP;
    this.directionOld = UP;

    this.bringToTop = bringToTop.bind(this, this.group);
  }

  isMe(player) {
    return this.user._id === player._id;
  }

  setDirection(dir) {
    this.hasTimer = false;
    const oldDir = this.directionOld;
    if ((oldDir === LEFT && dir === RIGHT) || (oldDir === RIGHT && dir === LEFT)) {
      return;
    }
    if ((oldDir === UP && dir === DOWN) || (oldDir === DOWN && dir === UP)) {
      return;
    }
    this.directionOld = this.direction;
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
      SOCKET.emit('update_user', this.user);
    });
  }

  addTailSection(x, y, dir, oldDir) {
    let set = 'verTails';
    let tail;
    if (dir !== oldDir) {
      set = 'corTails';
      let angle = 0;
      let xp = x;
      let yp = y;
      if ((dir === LEFT && oldDir === DOWN) || (dir === UP && oldDir === RIGHT)) {
        angle = 90;
        xp = x + 1;
      } else if ((dir === RIGHT && oldDir === DOWN) || (dir === UP && oldDir === LEFT)) {
        angle = -180;
        yp = y + 1;
        xp = x + 1;
      } else if ((dir === RIGHT && oldDir === UP) || (dir === DOWN && oldDir === LEFT)) {
        angle = -90;
        yp = y + 1;
      }
      tail = createSprit(xp, yp, set, this.color - 1, this.tail);
      tail.angle = angle;
    } else {
      tail = createSprit((dir === LEFT || dir === RIGHT) ? x + 1 : x, y, set, this.color - 1, this.tail);
      if (dir === LEFT || dir === RIGHT) {
        tail.angle = 90;
      }
    }
    this.user.tailData += [ x, y ].join(',') + ';';
    this.sendUpdate();
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
    this.user.tailData = '';
    this.sendUpdate();
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
    const oldDir = this.directionOld;

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
            const tailHit = find(TAIL_DATA, { x: this.x, y: this.y });
            if (!isUndefined(tailHit)) {
              killPlayer(tailHit.user, this.user);
            }
            if (!this.userTile(old.x, old.y)) {
              this.addTailSection(old.x, old.y, dir, oldDir);
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
  constructor(user) {
    this.user = user;
    this.x = user.x;
    this.y = user.y;
    this.group = GAME.add.group();
    this.sprite = createSprit(this.x, this.y, 'player', 1, this.group);

    let style = { font: 'bold 12px Arial', fill: '#ffffff', align: 'center' };
    this.label = GAME.add.text(0, -10, this.user.name, style);
    this.label.anchor.set(0);
    this.label.x = (UNIT / 2) - (this.label.width / 2);
    this.sprite.addChild(this.label);

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
  constructor(name) {
    this.enemies = {};
    this.userName = name;
  }

  preload() {
    GAME.stage.backgroundColor = '#2c3e50';

    GAME.load.spritesheet('player', '/public/chara0.png', UNIT, UNIT, 36);
    GAME.load.spritesheet('colors', '/public/colors.png', UNIT, UNIT, 51);
    GAME.load.spritesheet('tails', '/public/tails.png', UNIT, UNIT, 51);
    GAME.load.spritesheet('horTails', '/public/hor.png', UNIT, UNIT, 3);
    GAME.load.spritesheet('verTails', '/public/verTail.png', UNIT, UNIT, 6);
    GAME.load.spritesheet('corTails', '/public/corTail.png', UNIT, UNIT, 6);

    SOCKET = io.connect('http://localhost:4000');
  }

  create() {

    //  Modify the world and camera bounds
    GAME.world.resize(SIZE * UNIT, SIZE * UNIT);

    SOCKET.emit('join', {
      name: this.userName,
      color: randOf(6) + 1,
      tailData: '',
      x: randOf(SIZE),
      y: randOf(SIZE),
    });

    SOCKET.on('me', (user, roomId) => {
      CURRENT_USER = user;
      this.player = new Player(CURRENT_USER);

      SOCKET.on(`tails_${roomId}`, (tailData) => {
        TAIL_DATA = tailData;
      });

      SOCKET.on(`killed_player_${roomId}`, (player) => {
        if (this.player.isMe(player)) {
          SOCKET.disconnect();
          GAME.destroy();
          GAME = null;
          removeClass(document.querySelector('.body'), 'hidden');
          alert('You were killed');
        }
      });

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

window.onload = () => {
  document.getElementById('startButton').addEventListener('click', () => {
    addClass(document.querySelector('.body'), 'hidden');
    GAME = new Phaser.Game('100%', '100%', Phaser.CANVAS, 'phaser-example', new Game(document.getElementById('name').value));
  });
};
