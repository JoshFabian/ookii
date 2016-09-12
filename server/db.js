/* global Promise */
const logger = require('./log.js');
const { MongoClient, ObjectId } = require('mongodb');
const { isUndefined, isString } = require('lodash');

const DB_URL = 'mongodb://localhost:27017/db';

const doPromise = function(resolve, reject, err, res) {
  if (err !== null) {
    reject(err);
  } else {
    resolve(res);
  }
};

const logErr = function(baseMsg, err) { logger.err(baseMsg, err); };

const getId = function(room) {
  if (isUndefined(room)) { logger.err('Object undefined.'); return ''; }
  return isString(room._id) ? room._id : room._id.valueOf();
};

/*
 * DB connection setup
 */
const setupDb = function(resolve, reject) {
  MongoClient.connect(DB_URL, doPromise.bind(null, resolve, reject));
};

/*
 * Add one user in a room
 */
const addUser = function(db, io, room, data) {
  const roomId = getId(room);
  const users = db.collection(`users_${roomId}`);
  return new Promise(function(resolve, reject) {
    users.insertOne(
      data,
      doPromise.bind(null, resolve, reject)
    );
  });
};

/*
 * Remove one user in a room based on its id
 */
const removeUser = function(db, io, room, data) {
  const roomId = getId(room);
  const users = db.collection(`users_${roomId}`);
  return new Promise(function(resolve, reject) {
    users.deleteOne(
      { _id: { $eq: ObjectId(data._id) } }, // eslint-disable-line babel/new-cap
      doPromise.bind(null, resolve, reject)
    );
  });
};

/*
 * Update one user in a room based on its id
 */
const updateUser = function(db, io, room, data) {
  const roomId = getId(room);
  const users = db.collection(`users_${roomId}`);
  return new Promise(function(resolve, reject) {
    users.findAndModify(
      { _id: { $eq: ObjectId(data._id) } }, // eslint-disable-line babel/new-cap
      [['_id', 'asc']],
      { $set: { x: data.x, y: data.y } },
      doPromise.bind(null, resolve, reject)
    );
  });
};

/*
 * Get all users for a room
 */
const getUsers = function(db, roomId) {
  const users = db.collection(`users_${roomId}`);
  return new Promise(function(resolve, reject) {
    users.find({}).toArray(doPromise.bind(null, resolve, reject));
  });
};

/*
 * Update room with current users
 */
const updateUsers = function(db, io, room) {
  logger.info('Getting users.');
  getUsers(db, getId(room))
    .then(function(res) { io.emit(`users_${getId(room)}`, res); })
    .catch(logErr.bind(null, 'Update Users Err'));
};

/*
 * Get a room with less then 100 users
 */
const getValidRooms = function(db) {
  const rooms = db.collection('rooms');
  return new Promise(function(resolve, reject) {
    rooms
      .find({ count: { $lt: 100 } })
      .toArray(doPromise.bind(null, resolve, reject));
  });
};

/*
 * Get one map
 */
const getMap = function(db, roomId) {
  const maps = db.collection('maps');
  return new Promise(function(resolve, reject) {
    maps
      .find({ room: { $eq: ObjectId(roomId) } }) // eslint-disable-line babel/new-cap
      .toArray(doPromise.bind(null, resolve, reject));
  });
};

/*
 * Create one room
 */
const createRoom = function(db) {
  const rooms = db.collection('rooms');
  return new Promise(function(resolve, reject) {
    rooms.insertOne(
      { count: 1 },
      doPromise.bind(null, resolve, reject)
    );
  });
};

/*
 * Build Tiles for Map
 */
const buildTiles = function(width, height, createTile) {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = createTile(x, y);
    }
  }
  return tiles;
};

/*
 * Create one map
 */
const createMap = function(db, room) {
  const maps = db.collection('maps');
  return new Promise(function(resolve, reject) {
    maps.insertOne(
      { room: getId(room), tiles: buildTiles(200, 200, (x, y) => ({
        user: null,
        color: 0,
        x, y,
      })) },
      doPromise.bind(null, resolve, reject)
    );
  });
};

const toCSV = function(map) {
  let data = '';

  for (let y = 0; y < map.tiles.length; y++) {
    const tileLine = map.tiles[y];
    for (let x = 0; x < tileLine.length; x++) {
      data += tileLine[x].color;

      if (x < tileLine.length - 1) {
        data += ',';
      }
    }

    if (y < map.tiles.length - 1) {
      data += '\n';
    }
  }
  return data;
};

const updateMapData = function(db, io, room) {
  logger.info('Getting room.');
  getMap(db, getId(room))
    .then(function(res) {
      const map = res[0];
      map.csv = toCSV(map);
      io.emit(`map_${getId(room)}`, res[0]);
    })
    .catch(logErr.bind(null, 'Get Room Err'));
};

const updateMap = function(db, io, room, user, tiles) {
  const maps = db.collection('maps');
  return new Promise(function(resolve, reject) {
    maps.findAndModify(
      { room: { $eq: ObjectId(getId(room)) } }, // eslint-disable-line babel/new-cap
      [['room', 'asc']],
      { $set: { tiles } },
      doPromise.bind(null, resolve, reject)
    );
  });
};

const devPix = function(num) {
  return num / 32;
};

const getTile = function(user, color, x, y) {
  return { user: getId(user), color, x, y };
};

const flip3x3 = function(map, user) {
  const { tiles } = map;
  const { x, y, color } = user;
  console.log(user, color);

  tiles[y][x] = getTile(user, color, x, y);

  tiles[y + 1][x] = getTile(user, color, x, y + 1);
  tiles[y - 1][x] = getTile(user, color, x, y - 1);
  tiles[y][x + 1] = getTile(user, color, x + 1, y);
  tiles[y][x - 1] = getTile(user, color, x - 1, y);

  tiles[y - 1][x + 1] = getTile(user, color, x + 1, y - 1);
  tiles[y + 1][x + 1] = getTile(user, color, x + 1, y + 1);
  tiles[y + 1][x - 1] = getTile(user, color, x - 1, y + 1);
  tiles[y - 1][x - 1] = getTile(user, color, x - 1, y - 1);

  return tiles;
};

/*
 * Update one room based on its id
 */
const updateRoomCount = function(db, room, amount) {
  const rooms = db.collection('rooms');
  return new Promise(function(resolve, reject) {
    rooms.findAndModify(
      { _id: { $eq: ObjectId(getId(room)) } }, // eslint-disable-line babel/new-cap
      [['_id', 'asc']],
      { $inc: { count: amount } },
      doPromise.bind(null, resolve, reject)
    );
  });
};

/*
 * Get a room with < 100 users or create a new one
 */
const getRoom = function(db, io) {
  return new Promise(function(resolve, reject) {
    getValidRooms(db)
      .then(function(result) {
        if (result.length > 0) {
          updateRoomCount(db, result[0], 1)
            .then(function({ value }) {
              getMap(db, getId(value))
                .then(function(res) { value.map = res[0]; resolve(value); })
                .catch(logErr.bind(null, 'Get Map Err'));
            })
            .catch(logErr.bind(null, 'Update Count Err'));
        } else {
          createRoom(db)
            .then(function({ ops }) {
              createMap(db, ops[0])
                .then(function(res) {
                  ops[0].map = res.ops[0];
                  resolve(ops[0]);
                })
                .catch(logErr.bind(null, 'Create Map Err'));
            })
            .catch(logErr.bind(null, 'Create Room Err'));
        }
      })
      .catch(logErr.bind(null, 'Get Valid Rooms Err'));
  });
};

module.exports = {
  logErr,
  addUser,
  getRoom,
  setupDb,
  flip3x3,
  updateMap,
  createMap,
  removeUser,
  updateUser,
  buildTiles,
  createRoom,
  updateUsers,
  updateMapData,
  getValidRooms,
  updateRoomCount,
  getRoomId: getId,
};
