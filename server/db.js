const { MongoClient } = require('mongodb');

const DB_URL = 'mongodb://localhost:27017/db';

module.exports = function(resolve, reject) {
  MongoClient.connect(DB_URL, function(err, db) {
    if (err !== null) {
      reject(err);
    } else {
      resolve(db);
    }
  });
};
