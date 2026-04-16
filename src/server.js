'use strict';

const http = require('node:http');
const { Server } = require('socket.io');

function resolvePort(value = process.env.PORT) {
  const parsed = Number.parseInt(value ?? '3000', 10);

  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
  }

  return parsed;
}

function createServer(options = {}) {
  const port = resolvePort(options.port);
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
      message: 'Connected to Socket.IO server'
    });

    socket.on('message', (payload) => {
      io.emit('message', {
        id: socket.id,
        payload
      });
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
    io.close(() => {
      server.close(() => {
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
