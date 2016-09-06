/* global enchant */

import { spritIndexOffest, numDiff } from './utils.js';

const Player = enchant.Class.create(enchant.Sprite, {
  initialize(game, {x, y}) {
    enchant.Sprite.call(this, 32, 32);
    this.image = game.assets['/public/chara0.png']; // set image
    this.x = x;
    this.y = y;
    this.frame = 7;
    this.baseFrame = 7;
    game.rootScene.addChild(this);
  },

  remove(game) {
    game.rootScene.removeChild(this);
  },

  canChange(x, y, distance) {
    return numDiff(this.x, x) >= distance || numDiff(this.y, y) >= distance;
  },

  animateTo(x, y, time, distance, cb) {
    if (numDiff(this.x, x) >= distance || numDiff(this.y, y) >= distance) {
      const newMid = this.baseFrame + spritIndexOffest(this.x, this.y, x, y);
      this.frame = [newMid - 1, newMid - 1, newMid + 1, newMid + 1];
      // setTimeout(() => { this.frame = newMid; }, time * 100);
      return this.tl.moveTo(x, y, time).then(cb);
    }
    return null;
  },
});


export default Player;
