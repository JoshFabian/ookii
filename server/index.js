const logger = require('./log.js');
const dbUtils = require('./db.js');
const {
  setupDb, getRoomId, updateRoomCount, logErr, flip3x3,
} = dbUtils;

const scope = {};

const autBind = function(sp, funcs, db, io) {
  for (const func of funcs) {
    scope[func] = dbUtils[func].bind(sp, db, io);
  }
};

const handleSocketConnection = function(io, db, socket) {
  let user;
  let room;

  /*
   * Join (move_user)
   *
   * Handle join. Get room, add user to room and update users.
   */
  socket.on('join', function(userData) {
    scope.getRoom()
      .then(function(data) {
        room = data;
        logger.log('Joining room.', room);
        scope.addUser(room, userData)
          .then(function({ ops }) {
            user = ops[0];
            scope.updateMap(room, user, flip3x3(room.map, user))
              .then(function() {
                logger.info('Added a user.', user, getRoomId(room));
                socket.emit('me', user, getRoomId(room));
                setTimeout(() => {
                  scope.updateUsers(room);
                  scope.updateMapData(room);
                }, 1000);
              })
              .catch(logErr.bind(null, 'Update Map Err'));
          })
          .catch(logErr.bind(null, 'Join Err'));
      })
      .catch(logErr.bind(null, 'Room Get Err'));
  });

  /*
   * Move User (move_user)
   *
   * Handle move of a user
   */
  socket.on('move_user', function(userData) {
    logger.log('Move user.', userData._id, getRoomId(room));
    scope.updateUser(room, userData)
      .then(function(res) { scope.updateUsers(room); })
      .catch(logErr.bind(null, 'Move User Err'));
  });

  /*
   * Disconnect
   *
   * Handle removal of user and clean up
   */
  socket.on('disconnect', function() {
    logger.log('Disconnect.', room, user);
    updateRoomCount(db, room, -1)
      .catch(logErr.bind(null, 'Could not decrement count.'));
    scope.removeUser(room, user)
      .then(function() { scope.updateUsers(room); })
      .catch(logErr.bind(null, 'Remove User Err'));
  });
};

const handleDbConnection = function(io, db) {
  logger.info('Connected');
  autBind(this, [
    'addUser', 'removeUser', 'updateUser', 'updateUsers', 'getRoom', 'updateMap',
    'updateMapData',
  ], db, io);
db.dropDatabase();
  io.sockets.on('connection', handleSocketConnection.bind(this, io, db));
};

module.exports = function(io) {
  logger.log('Starting db connection.');

  /*
   * Setup Database
   */
  setupDb(
    handleDbConnection.bind(this, io),
    logErr.bind(null, 'Conenction Err')
  );
};
