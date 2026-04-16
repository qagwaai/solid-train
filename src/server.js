'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');
const {
  REGISTER_EVENT,
  REGISTER_RESPONSE_EVENT
} = require('./model/register');
const {
  LOGIN_EVENT,
  LOGIN_RESPONSE_EVENT,
  LOGIN_FAILURE_REASONS
} = require('./model/login');
const {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT
} = require('./model/character-list');

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

  function toNonEmptyString(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  function buildRegisterResponse(payload) {
    const playerName = toNonEmptyString(payload?.playerName);
    const email = toNonEmptyString(payload?.email);
    const password = toNonEmptyString(payload?.password);

    if (!playerName || !email || !password) {
      return {
        success: false,
        message: 'playerName, email, and password are required'
      };
    }

    const normalizedPlayerName = playerName.toLowerCase();
    if (registeredPlayers.has(normalizedPlayerName)) {
      return {
        success: false,
        message: 'playerName already exists'
      };
    }

    const playerId = randomUUID();
    registeredPlayers.set(normalizedPlayerName, {
      playerId,
      playerName,
      email,
      password,
      socketId: null
    });
    charactersByPlayer.set(normalizedPlayerName, []);

    return {
      success: true,
      message: 'Registration successful',
      playerId
    };
  }

  function buildLoginResponse(payload) {
    const playerName = toNonEmptyString(payload?.playerName);
    const password = toNonEmptyString(payload?.password);

    if (!playerName || !password) {
      return {
        success: false,
        message: 'playerName and password are required',
        reason: LOGIN_FAILURE_REASONS.UNKNOWN
      };
    }

    const normalizedPlayerName = playerName.toLowerCase();
    const player = registeredPlayers.get(normalizedPlayerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        reason: LOGIN_FAILURE_REASONS.PLAYER_NOT_REGISTERED
      };
    }

    if (player.password !== password) {
      return {
        success: false,
        message: 'Password does not match',
        reason: LOGIN_FAILURE_REASONS.PASSWORD_MISMATCH
      };
    }

    return {
      success: true,
      message: 'Login successful',
      playerId: player.playerId
    };
  }

  function buildCharacterListResponse(payload) {
    const playerName = toNonEmptyString(payload?.playerName);

    if (!playerName) {
      return {
        success: false,
        message: 'playerName is required',
        playerName: '',
        characters: []
      };
    }

    const normalizedPlayerName = playerName.toLowerCase();
    const player = registeredPlayers.get(normalizedPlayerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characters: []
      };
    }

    const characters = charactersByPlayer.get(normalizedPlayerName) || [];

    return {
      success: true,
      message: 'Character list retrieved successfully',
      playerName: player.playerName,
      characters: characters.map((character) => ({ ...character }))
    };
  }

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Socket.IO server is running.');
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
      const response = buildRegisterResponse(payload);

      if (response.success) {
        const normalizedPlayerName = payload.playerName.trim().toLowerCase();
        const existingPlayer = registeredPlayers.get(normalizedPlayerName);
        if (existingPlayer) {
          existingPlayer.socketId = socket.id;
        }
      }

      socket.emit(REGISTER_RESPONSE_EVENT, response);
    });

    socket.on(LOGIN_EVENT, (payload) => {
      const response = buildLoginResponse(payload);

      if (response.success) {
        const normalizedPlayerName = payload.playerName.trim().toLowerCase();
        const existingPlayer = registeredPlayers.get(normalizedPlayerName);
        if (existingPlayer) {
          existingPlayer.socketId = socket.id;
        }
      }

      socket.emit(LOGIN_RESPONSE_EVENT, response);
    });

    socket.on(CHARACTER_LIST_REQUEST_EVENT, (payload) => {
      const response = buildCharacterListResponse(payload);
      socket.emit(CHARACTER_LIST_RESPONSE_EVENT, response);
    });
  });

  return { port, server, io };
}

function startServer(options = {}) {
  const { port, server, io } = createServer(options);

  server.listen(port, () => {
    process.stdout.write(`Socket.IO server listening on port ${port}\n`);
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
