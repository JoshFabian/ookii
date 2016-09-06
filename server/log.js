// const emojic = require('emojic');
/* eslint-disable no-console */
const colorIt = require('color-it');

const otherArgs = function(args) {
  return Array.from(args).slice(1);
};

const logByColor = function(color) {
  return function() {
    if (arguments.length > 0) {
      if (arguments.length === 1) {
        console.log(colorIt(arguments[0])[color]() + '');
      } else {
        console.log.apply(this, [colorIt(arguments[0])[color]() + '', ...otherArgs(arguments)]);
      }
    }
  };
};

module.exports = {
  log: logByColor('green'),
  info: logByColor('blue'),
  err: logByColor('red'),
};
