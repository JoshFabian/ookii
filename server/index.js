/* global Promise */
const logger = require('./log.js');
const setupDb = require('./db.js');

const { ObjectId } = require('mongodb');

const doPromise = function(resolve, reject, err, res) {
  if (err !== null) {
    reject(err);
  } else {
    resolve(res);
  }
};

const getRoomId = function(room) {
  if (typeof room === 'undefined') { logger.err('Room undefined.'); return ''; }
  return typeof room._id === 'string' ? room._id : room._id.valueOf();
};

/*
 * Add one user in a room
 */
let addUser = function(db, io, room, data) {
  const roomId = getRoomId(room);
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
let removeUser = function(db, io, room, data) {
  const roomId = getRoomId(room);
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
let updateUser = function(db, io, room, data) {
  const roomId = getRoomId(room);
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
    users
      .find({})
      .toArray(doPromise.bind(null, resolve, reject));
  });
};

/*
 * Update room with current users
 */
let updateUsers = function(db, io, room) {
  const roomId = getRoomId(room);
  logger.info('Getting users.');
  getUsers(db, roomId)
    .then(function(result) {
      io.emit(`users_${roomId}`, result);
    })
    .catch(function(updateErr) {
      logger.err('update users err', updateErr);
    });
};

/*
 * Get a room with less then 100 users
 */
const getRoomValidRooms = function(db) {
  const rooms = db.collection('rooms');
  return new Promise(function(resolve, reject) {
    rooms
      .find({ count: { $lt: 100 } })
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
 * Update one room based on its id
 */
const updateRoomCount = function(db, room, amount) {
  const roomId = getRoomId(room);
  const rooms = db.collection('rooms');
  return new Promise(function(resolve, reject) {
    rooms.findAndModify(
      { _id: { $eq: ObjectId(roomId) } }, // eslint-disable-line babel/new-cap
      [['_id', 'asc']],
      { $inc: { count: amount } },
      doPromise.bind(null, resolve, reject)
    );
  });
};

/*
 * Get a room with < 100 users or create a new one
 */
let getRoom = function(db, io) {
  return new Promise(function(resolve, reject) {
    getRoomValidRooms(db)
      .then(function(res) {
        if (res.length > 0) {
          updateRoomCount(db, res[0], 1)
            .then(function(rez) {
              resolve(rez.value);
            })
            .catch(function(err) {
              logger.err(err);
            });
        } else {
          createRoom(db)
            .then(function(result) {
              resolve(result.ops[0]);
            })
            .catch(function(err) {
              logger.err(err);
            });
        }
      })
      .catch(function(err) {
        logger.err(err);
      });
  });
};

module.exports = function(io) {
  logger.log('Starting db connection');
  /*
   * Setup Database
   */
  setupDb(
    function(db) {
      logger.info('Connected');
      addUser = addUser.bind(this, db, io);
      removeUser = removeUser.bind(this, db, io);
      updateUser = updateUser.bind(this, db, io);
      updateUsers = updateUsers.bind(this, db, io);
      getRoom = getRoom.bind(this, db, io);

      io.sockets.on('connection', function(socket) {

        let user;
        let room;

        /*
         * Join (move_user)
         *
         * Handle join. Get room, add user to room and update users.
         */
        socket.on('join', function(userData) {
          getRoom()
            .then(function(data) {
              room = data;
              logger.log('Joining room.', room);
              addUser(room, userData)
                .then(function(result) {
                  user = result.ops[0];
                  logger.info('Added a user.', user, getRoomId(room));
                  socket.emit('me', user, getRoomId(room));
                  setTimeout(()=>updateUsers(room), 1000);
                })
                .catch(function(joinErr) {
                  logger.err('join err', joinErr);
                });
            })
            .catch(function(err) {
              logger.err('room get err', err);
            });
        });

        /*
         * Move User (move_user)
         *
         * Handle move of a user
         */
        socket.on('move_user', function(userData) {
          logger.log('Move user.', userData._id, getRoomId(room));
          updateUser(room, userData)
            .then(function(res) {
              logger.info('Moved user.', userData._id, getRoomId(room));
              updateUsers(room);
            })
            .catch(function(moveErr) {
              logger.err('move err', moveErr);
            });
        });

        /*
         * Disconnect
         *
         * Handle removal of user and clean up
         */
        socket.on('disconnect', function() {
          logger.log('Disconnect', room, user);
          updateRoomCount(db, room, -1)
            .catch(function(err) {
              logger.err('could not decrement count', err);
            });
          removeUser(room, user)
            .then(function() {
              updateUsers(room);
            })
            .catch(function(removeErr) {
              logger.err('remove err', removeErr);
            });
        });

      });
    },
    function(err) {
      logger.err('Conenction err', err);
    }
  );
};
