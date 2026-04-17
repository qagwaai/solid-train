'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');
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
      registerMessageHandler.handle(socket, payload);
    });

    socket.on(LOGIN_EVENT, (payload) => {
      loginMessageHandler.handle(socket, payload);
    });

    socket.on(CHARACTER_LIST_REQUEST_EVENT, (payload) => {
      characterListMessageHandler.handle(socket, payload);
    });

    socket.on(CHARACTER_ADD_REQUEST_EVENT, (payload) => {
      characterAddMessageHandler.handle(socket, payload);
    });

    socket.on(CHARACTER_DELETE_REQUEST_EVENT, (payload) => {
      characterDeleteMessageHandler.handle(socket, payload);
    });

    socket.on(CHARACTER_EDIT_REQUEST_EVENT, (payload) => {
      characterEditMessageHandler.handle(socket, payload);
    });

    socket.on(GAME_JOIN_REQUEST_EVENT, (payload) => {
      gameJoinMessageHandler.handle(socket, payload);
    });
  });

  return { port, server, io };
}

function startServer(options = {}) {
  const { port, server, io } = createServer(options);

  server.listen(port, () => {
    process.stdout.write(`Stellar Socket.IO server listening on port ${port}\n`);
  });

  const shutdown = () => {
    const fallbackTimer = setTimeout(() => {
      process.stderr.write('Graceful shutdown timed out; forcing exit.\n');
      process.exit(1);
    }, 5000);
    fallbackTimer.unref();

    io.close(() => {
      server.close((error) => {
        clearTimeout(fallbackTimer);
        if (error) {
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

  return { port, server, io, shutdown };
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  resolvePort,
  startServer
};
