var config = require('./webpack.config.base');

const NODE_ENV = 'production';

module.exports = config({ env: NODE_ENV });
