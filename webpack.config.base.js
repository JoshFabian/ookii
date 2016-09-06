var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var postcssImport = require('postcss-import');
var precss = require('precss');
var styleVars = require('./globalStyleVars');
var emojic = require('emojic');
var colorIt = require('color-it');

module.exports = function(options) {

  var msg = colorIt(emojic.greyExclamation).gray() + '  ';
  msg += colorIt('Running in').gray() + ' ';
  msg += colorIt(options.env).blue();
  msg += ' ' + colorIt('mode.').gray();
  console.log(msg); // eslint-disable-line

  return {
    devtool: 'source-map',
    entry: [
      './src/app.js',
    ],
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'bundle.js',
      publicPath: '/dist/',
    },
    resolve: {
      modulesDirectories: [
        'node_modules',
      ],
    },
    plugins: [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.DefinePlugin({
        'process.env': {
          'NODE_ENV': JSON.stringify(options.env),
        },
      }),
      (options.env === 'production' &&
      new webpack.optimize.UglifyJsPlugin({
        compressor: {
          warnings: false,
        },
      })),
      (options.env === 'production' && new ExtractTextPlugin('styles.css')),
    ],
    module: {
      loaders: [
        { test: /\.css$/,
          loader: options.env === 'production' ?
            ExtractTextPlugin.extract('style', 'css?importLoaders=1!postcss') :
            'style!css?importLoaders=1!postcss',
        },
        {test: /\.json$/, loader: 'json'},
        {test: /\.jsx?$/,
          exclude: /(node_modules)/,
          loaders: ['babel'],
        },
      ],
    },
    postcss: (webpackInner) => {
      return [
        postcssImport({
          addDependencyTo: webpackInner,
        }),
        precss({
          variables: { variables: styleVars },
        }),
      ];
    },
  };
};
