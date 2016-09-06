/* global enchant, Game, io */
import 'babel-polyfill';

const {
  DOWN_BUTTON_DOWN, UP_BUTTON_DOWN, LEFT_BUTTON_DOWN, RIGHT_BUTTON_DOWN,
} = enchant.Event;

import { randOf } from './utils.js';

import Enemy from './enemy.js';
import Player from './player.js';

const DISTANCE_CHANGE = 30;
const TIME = 10;

window.onload = function() {
  var currentUser;
  var socket = io.connect('http://localhost:4000');

  enchant();
  const game = new Game(window.innerWidth, window.innerHeight);
  game.preload('/public/chara0.png');

  game.fps = 30;

  game.onload = function () {
    let player;
    let moveTimer;
    const gameEnemies = {};

    socket.emit('join', {
      name: 'test' + Date.now(),
      x: randOf(window.innerWidth),
      y: randOf(window.innerHeight),
    });

    socket.on('me', function(user, roomId) {
      currentUser = user;
      player = new Player(game, user);

      socket.on(`users_${roomId}`, function(users) {
        for (const enemy of users.filter((u) => (u._id !== user._id))) {
          if (Object.keys(gameEnemies).indexOf(enemy._id) > -1) {
            gameEnemies[enemy._id].animateTo(enemy.x, enemy.y, TIME, DISTANCE_CHANGE);
          } else {
            gameEnemies[enemy._id] = new Enemy(game, enemy);
          }
        }
      });
    });

    const movePlayer = function(attr, change) {
      const clone = { x: currentUser.x, y: currentUser.y };
      clone[attr] = clone[attr] + change;
      if (player.canChange(clone.x, clone.y, DISTANCE_CHANGE)) {
        if (moveTimer !== null && typeof moveTimer !== 'undefined') {
          moveTimer.waitUntil(() => {
            moveTimer.clear();
            moveTimer = null;
            movePlayer(attr, change);
          });
        } else {
          const doMove = () => {
            currentUser[attr] = currentUser[attr] + change;
            socket.emit('move_user', currentUser);
            const action = player.animateTo(currentUser.x, currentUser.y, TIME, DISTANCE_CHANGE, doMove);
            if (action !== null) { moveTimer = action; }
          };

          doMove();
        }
      }
    };

    game.rootScene.on(DOWN_BUTTON_DOWN, movePlayer.bind(this, 'y', DISTANCE_CHANGE));
    game.rootScene.on(UP_BUTTON_DOWN, movePlayer.bind(this, 'y', -DISTANCE_CHANGE));

    game.rootScene.on(RIGHT_BUTTON_DOWN, movePlayer.bind(this, 'x', DISTANCE_CHANGE));
    game.rootScene.on(LEFT_BUTTON_DOWN, movePlayer.bind(this, 'x', -DISTANCE_CHANGE));
  };

  game.start();
};
