const express = require('express');
const Server = require('http').Server;
const socketio = require('socket.io');
const emojic = require('emojic');
const colorIt = require('color-it');
const path = require('path');
const serverApp = require('./server/index.js');

const app = express();
const server = Server(app); // eslint-disable-line babel/new-cap
const io = socketio(server);

const PORT = process.env.NODE_ENV !== 'production' ? 4000 : process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'production') {
  const webpack = require('webpack');
  const config = require('./webpack.config.' + process.env.NODE_ENV);

  const compiler = webpack(config);

  app.use(require('webpack-dev-middleware')(compiler, {
    noInfo: true,
    publicPath: config.output.publicPath,
  }));

  app.use(require('webpack-hot-middleware')(compiler));
}

app.use('/dist', express.static('dist'));
app.use('/public', express.static('public'));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, function(err) {
  if (err) {
    console.log(colorIt(emojic.x).red() + '  ' + colorIt(JSON.stringify(err)).red()); // eslint-disable-line
    return;
  }

  var msg = colorIt(emojic.smiley).green() + '  ';
  msg += colorIt('Listening at http://localhost:').green();
  msg += colorIt(PORT).blue() + colorIt('.').green();
  console.log(msg); // eslint-disable-line

  serverApp(io);
});
