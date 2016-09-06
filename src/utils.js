export const spritIndexOffest = function(x, y, newX, newY) { // Index diffrence for sprite
  if (x < newX) {
    return 18;
  } else if (x > newX) {
    return 9;
  } else if (y > newY) {
    return 27;
  }
  return 0;
};

export const randOf = function(num) {
  return Math.floor(Math.random() * num);
};

export const numDiff = function(a, b) {
  if (a === b) { return 0; }
  if (a > b) { return Math.abs(a - b); }
  return Math.abs(b - a);
};
