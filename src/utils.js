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

export const spritIndexOffestDir = function(dir) { // Index diffrence for sprite
  if (dir === 2) {
    return 18;
  } else if (dir === 1) {
    return 9;
  } else if (dir === 3) {
    return 27;
  }
  return 0;
};

export const randOf = function(num) {
  return Math.floor(Math.random() * num);
};

export const numDiff = function(a, b) {
  return a - b;
};

export const adjustX = function(baseX, realX, pix, base) {
  return realX === baseX ? base : (base + ((realX - baseX) * pix));
};

export const adjustY = function(baseY, realY, pix, base) {
  return realY === baseY ? base : (base + ((realY - baseY) * pix));
};

export const dataURItoBlob = function(dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  const byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], {type: mimeString});
  return blob;
};

export const saveData = function(blob, fileName) {
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style = 'display: none';
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const downloadCanvasAsImage = function(canvas, fileName = 'canvasImage.png') {
  saveData(dataURItoBlob(canvas.toDataURL('image/png')), fileName);
};
