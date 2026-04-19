'use strict';

require('dotenv').config();

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');
const { MongoConnection } = require('./db/connection');
const { DatabaseService } = require('./db/service');
const {
  REGISTER_EVENT
} = require('./model/register');
const {
  LOGIN_EVENT
} = require('./model/login');
const {
  CHARACTER_LIST_REQUEST_EVENT
} = require('./model/character-list');
const {
  CHARACTER_ADD_REQUEST_EVENT
} = require('./model/character-add');
const {
  CHARACTER_DELETE_REQUEST_EVENT
} = require('./model/character-delete');
const {
  CHARACTER_EDIT_REQUEST_EVENT
} = require('./model/character-edit');
const {
  DRONE_LIST_REQUEST_EVENT
} = require('./model/drone-list');
const {
  GAME_JOIN_REQUEST_EVENT
} = require('./model/game-join');
const {
  MessageHandlerContext
} = require('./handlers/message-handler-context');
const {
  RegisterMessageHandler
} = require('./handlers/register-message-handler');
const {
  LoginMessageHandler
} = require('./handlers/login-message-handler');
const {
  CharacterListMessageHandler
} = require('./handlers/character-list-message-handler');
const {
  CharacterAddMessageHandler
} = require('./handlers/character-add-message-handler');
const {
  CharacterDeleteMessageHandler
} = require('./handlers/character-delete-message-handler');
const {
  CharacterEditMessageHandler
} = require('./handlers/character-edit-message-handler');
const {
  DroneListMessageHandler
} = require('./handlers/drone-list-message-handler');
const {
  GameJoinMessageHandler
} = require('./handlers/game-join-message-handler');

function resolvePort(value = process.env.PORT) {
  const parsed = Number.parseInt(value ?? '3000', 10);

  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
  }

  return parsed;
}

function createServer(options = {}) {
  const port = resolvePort(options.port);
  const registeredPlayers = new Map();
  const charactersByPlayer = new Map();
  const messageHandlerContext = new MessageHandlerContext({
    registeredPlayers,
    charactersByPlayer,
    databaseService: options.databaseService || null,
    createId: randomUUID
  });
  const registerMessageHandler = new RegisterMessageHandler(messageHandlerContext);
  const loginMessageHandler = new LoginMessageHandler(messageHandlerContext);
  const characterListMessageHandler = new CharacterListMessageHandler(
    messageHandlerContext
  );
  const characterAddMessageHandler = new CharacterAddMessageHandler(
    messageHandlerContext
  );
  const characterDeleteMessageHandler = new CharacterDeleteMessageHandler(
    messageHandlerContext
  );
  const characterEditMessageHandler = new CharacterEditMessageHandler(
    messageHandlerContext
  );
  const droneListMessageHandler = new DroneListMessageHandler(
    messageHandlerContext
  );
  const gameJoinMessageHandler = new GameJoinMessageHandler(
    messageHandlerContext
  );

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Stellar Socket.IO server is running.');
  });

  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    socket.emit('welcome', {
      id: socket.id,
      message: 'Connected to Stellar Socket.IO server'
    });

    socket.on('message', (payload) => {
      io.emit('message', {
        id: socket.id,
        payload
      });
    });

    socket.on(REGISTER_EVENT, (payload) => {
      registerMessageHandler.handle(socket, payload).catch((error) => {
        process.stderr.write(`[socket] Register handler error: ${error.message}\n`);
      });
    });

    socket.on(LOGIN_EVENT, (payload) => {
      loginMessageHandler.handle(socket, payload).catch((error) => {
        process.stderr.write(`[socket] Login handler error: ${error.message}\n`);
      });
    });

    socket.on(CHARACTER_LIST_REQUEST_EVENT, (payload) => {
      characterListMessageHandler.handle(socket, payload).catch((error) => {
        process.stderr.write(`[socket] Character list handler error: ${error.message}\n`);
      });
    });

    socket.on(CHARACTER_ADD_REQUEST_EVENT, (payload) => {
      characterAddMessageHandler.handle(socket, payload).catch((error) => {
        process.stderr.write(`[socket] Character add handler error: ${error.message}\n`);
      });
    });

    socket.on(CHARACTER_DELETE_REQUEST_EVENT, (payload) => {
      characterDeleteMessageHandler.handle(socket, payload).catch((error) => {
        process.stderr.write(`[socket] Character delete handler error: ${error.message}\n`);
      });
    });

    socket.on(CHARACTER_EDIT_REQUEST_EVENT, (payload) => {
      characterEditMessageHandler.handle(socket, payload).catch((error) => {
        process.stderr.write(`[socket] Character edit handler error: ${error.message}\n`);
      });
    });

    socket.on(DRONE_LIST_REQUEST_EVENT, (payload) => {
      droneListMessageHandler.handle(socket, payload).catch((error) => {
        process.stderr.write(`[socket] Drone list handler error: ${error.message}\n`);
      });
    });

    socket.on(GAME_JOIN_REQUEST_EVENT, (payload) => {
      gameJoinMessageHandler.handle(socket, payload).catch((error) => {
        process.stderr.write(`[socket] Game join handler error: ${error.message}\n`);
      });
    });
  });

  return { port, server, io };
}

async function startServer(options = {}) {
  const mongoConnection = new MongoConnection({
    mongoUri: process.env.MONGODB_URI
  });
  let databaseService = null;

  // Connect to MongoDB if URI is configured; otherwise run in-memory.
  if (process.env.MONGODB_URI) {
    try {
      await mongoConnection.connect();
      databaseService = new DatabaseService();
      process.stdout.write('[server] MongoDB connection established\n');
    } catch (error) {
      process.stderr.write(
        `[server] Failed to connect to MongoDB, using in-memory storage: ${error.message}\n`
      );
    }
  } else {
    process.stdout.write('[server] MONGODB_URI not configured; running with in-memory storage\n');
  }

  const { port, server, io } = createServer({
    ...options,
    databaseService
  });

  server.listen(port, () => {
    process.stdout.write(`Stellar Socket.IO server listening on port ${port}\n`);
  });

  const shutdown = async () => {
    const fallbackTimer = setTimeout(() => {
      process.stderr.write('Graceful shutdown timed out; forcing exit.\n');
      process.exit(1);
    }, 5000);
    fallbackTimer.unref();

    io.close(async () => {
      server.close(async (error) => {
        clearTimeout(fallbackTimer);
        try {
          if (mongoConnection.getConnectionStatus()) {
            await mongoConnection.disconnect();
          }
        } catch (dbError) {
          process.stderr.write(`[server] Error disconnecting from MongoDB: ${dbError.message}\n`);
        }
        if (error && error.message !== 'Server is not running.') {
          process.stderr.write(`Shutdown error: ${error.message}\n`);
          process.exit(1);
          return;
        }
        process.exit(0);
      });
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return { port, server, io, shutdown, mongoConnection, databaseService };
}

if (require.main === module) {
  startServer().catch((error) => {
    process.stderr.write(`[server] Startup failed: ${error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  createServer,
  resolvePort,
  startServer
};
