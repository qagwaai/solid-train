'use strict';

require('dotenv').config();

const http = require('node:http');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');
const { MongoConnection } = require('./db/connection');
const { DatabaseService } = require('./db/service');
const {
  MISSION_UPSERT_ALIAS_REQUEST_EVENT,
  MISSION_UPSERT_ALIAS_RESPONSE_EVENT,
} = require('./model/mission-upsert');
const { MessageHandlerContext } = require('./handlers/message-handler-context');
const { RegisterMessageHandler } = require('./handlers/register-message-handler');
const { LoginMessageHandler } = require('./handlers/login-message-handler');
const { CharacterListMessageHandler } = require('./handlers/character-list-message-handler');
const { CharacterAddMessageHandler } = require('./handlers/character-add-message-handler');
const { CharacterDeleteMessageHandler } = require('./handlers/character-delete-message-handler');
const { CharacterEditMessageHandler } = require('./handlers/character-edit-message-handler');
const { ShipListMessageHandler } = require('./handlers/ship-list-message-handler');
const { ShipUpsertMessageHandler } = require('./handlers/ship-upsert-message-handler');
const { GameJoinMessageHandler } = require('./handlers/game-join-message-handler');
const { MissionUpsertMessageHandler } = require('./handlers/mission-upsert-message-handler');
const {
  CelestialBodyUpsertMessageHandler,
} = require('./handlers/celestial-body-upsert-message-handler');
const {
  CelestialBodyListMessageHandler,
} = require('./handlers/celestial-body-list-message-handler');
const { MissionListMessageHandler } = require('./handlers/mission-list-message-handler');
const { ItemUpsertMessageHandler } = require('./handlers/item-upsert-message-handler');
const {
  ItemListByContainerMessageHandler,
} = require('./handlers/item-list-by-container-message-handler');
const {
  ItemListByLocationMessageHandler,
} = require('./handlers/item-list-by-location-message-handler');
const { LaunchItemMessageHandler } = require('./handlers/launch-item-message-handler');
const { MarketListMessageHandler } = require('./handlers/market-list-message-handler');
const {
  MarketListByLocationMessageHandler,
} = require('./handlers/market-list-by-location-message-handler');
const { MarketQuoteMessageHandler } = require('./handlers/market-quote-message-handler');
const {
  MarketInventoryListMessageHandler,
} = require('./handlers/market-inventory-list-message-handler');
const { MarketLedgerListMessageHandler } = require('./handlers/market-ledger-list-message-handler');
const { MarketBuyMessageHandler } = require('./handlers/market-buy-message-handler');
const { MarketSellMessageHandler } = require('./handlers/market-sell-message-handler');
const {
  SolarSystemListMessageHandler,
} = require('./handlers/solar-system-list-message-handler');
const {
  SolarSystemGetMessageHandler,
} = require('./handlers/solar-system-get-message-handler');
const { StarListMessageHandler } = require('./handlers/star-list-message-handler');
const { StarGetMessageHandler } = require('./handlers/star-get-message-handler');
const { registerSocketHandlers } = require('./handlers/socket-handler-registry');

/**
 * Parse and validate a TCP port value.
 * @param {string|undefined} value
 * @returns {number}
 */
function resolvePort(value = process.env.PORT) {
  const parsed = Number.parseInt(value ?? '3000', 10);

  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
  }

  return parsed;
}

/**
 * Build server dependencies, bind socket handlers, and return runtime objects.
 * @param {{ port?: string, databaseService?: Object|null, initializeContext?: boolean }} [options]
 * @returns {{ port: number, server: import('node:http').Server, io: import('socket.io').Server, messageHandlerContext: Object }}
 */
function createServer(options = {}) {
  const port = resolvePort(options.port);
  const registeredPlayers = new Map();
  const charactersByPlayer = new Map();
  const celestialBodiesById = new Map();
  const itemsById = new Map();
  const messageHandlerContext = new MessageHandlerContext({
    registeredPlayers,
    charactersByPlayer,
    celestialBodiesById,
    itemsById,
    databaseService: options.databaseService || null,
    createId: randomUUID,
  });
  if (options.initializeContext !== false) {
    messageHandlerContext.initializeAsync({ seedDefaults: true }).catch((error) => {
      process.stderr.write(`[server] Context initialization failed: ${error.message}\n`);
    });
  }
  const registerMessageHandler = new RegisterMessageHandler(messageHandlerContext);
  const loginMessageHandler = new LoginMessageHandler(messageHandlerContext);
  const characterListMessageHandler = new CharacterListMessageHandler(messageHandlerContext);
  const characterAddMessageHandler = new CharacterAddMessageHandler(messageHandlerContext);
  const characterDeleteMessageHandler = new CharacterDeleteMessageHandler(messageHandlerContext);
  const characterEditMessageHandler = new CharacterEditMessageHandler(messageHandlerContext);
  const shipListMessageHandler = new ShipListMessageHandler(messageHandlerContext);
  const shipUpsertMessageHandler = new ShipUpsertMessageHandler(messageHandlerContext);
  const gameJoinMessageHandler = new GameJoinMessageHandler(messageHandlerContext);
  const missionUpsertMessageHandler = new MissionUpsertMessageHandler(messageHandlerContext);
  const celestialBodyUpsertMessageHandler = new CelestialBodyUpsertMessageHandler(
    messageHandlerContext
  );
  const celestialBodyListMessageHandler = new CelestialBodyListMessageHandler(
    messageHandlerContext
  );
  const missionListMessageHandler = new MissionListMessageHandler(messageHandlerContext);
  const itemUpsertMessageHandler = new ItemUpsertMessageHandler(messageHandlerContext);
  const itemListByContainerMessageHandler = new ItemListByContainerMessageHandler(
    messageHandlerContext
  );
  const itemListByLocationMessageHandler = new ItemListByLocationMessageHandler(
    messageHandlerContext
  );
  const launchItemMessageHandler = new LaunchItemMessageHandler(messageHandlerContext);
  const marketListMessageHandler = new MarketListMessageHandler(messageHandlerContext);
  const marketListByLocationMessageHandler = new MarketListByLocationMessageHandler(
    messageHandlerContext
  );
  const marketQuoteMessageHandler = new MarketQuoteMessageHandler(messageHandlerContext);
  const marketInventoryListMessageHandler = new MarketInventoryListMessageHandler(
    messageHandlerContext
  );
  const marketLedgerListMessageHandler = new MarketLedgerListMessageHandler(messageHandlerContext);
  const marketBuyMessageHandler = new MarketBuyMessageHandler(messageHandlerContext);
  const marketSellMessageHandler = new MarketSellMessageHandler(messageHandlerContext);
  const solarSystemListMessageHandler = new SolarSystemListMessageHandler(messageHandlerContext);
  const solarSystemGetMessageHandler = new SolarSystemGetMessageHandler(messageHandlerContext);
  const starListMessageHandler = new StarListMessageHandler(messageHandlerContext);
  const starGetMessageHandler = new StarGetMessageHandler(messageHandlerContext);


  // Express app for REST endpoints
  const app = express();
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  // Canonical items endpoint
  app.use(require('./handlers/items-contract'));

  // Create HTTP server from Express app
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.emit('welcome', {
      id: socket.id,
      message: 'Connected to Stellar Socket.IO server',
    });

    socket.on('message', (payload) => {
      io.emit('message', {
        id: socket.id,
        payload,
      });
    });

    registerSocketHandlers(socket, {
      registerMessageHandler,
      loginMessageHandler,
      characterListMessageHandler,
      characterAddMessageHandler,
      characterDeleteMessageHandler,
      characterEditMessageHandler,
      shipListMessageHandler,
      shipUpsertMessageHandler,
      gameJoinMessageHandler,
      missionUpsertMessageHandler,
      celestialBodyUpsertMessageHandler,
      celestialBodyListMessageHandler,
      missionListMessageHandler,
      itemUpsertMessageHandler,
      itemListByContainerMessageHandler,
      itemListByLocationMessageHandler,
      launchItemMessageHandler,
      marketListMessageHandler,
      marketListByLocationMessageHandler,
      marketQuoteMessageHandler,
      marketInventoryListMessageHandler,
      marketLedgerListMessageHandler,
      marketBuyMessageHandler,
      marketSellMessageHandler,
      solarSystemListMessageHandler,
      solarSystemGetMessageHandler,
      starListMessageHandler,
      starGetMessageHandler,
    });

    // Keep alias wiring explicit because it emits a different response event name.
    socket.on(MISSION_UPSERT_ALIAS_REQUEST_EVENT, (payload) => {
      missionUpsertMessageHandler
        .handle(socket, payload)
        .then((response) => {
          socket.emit(MISSION_UPSERT_ALIAS_RESPONSE_EVENT, response);
        })
        .catch((error) => {
          process.stderr.write(`[socket] Mission upsert alias handler error: ${error.message}\n`);
        });
    });
  });

  return { port, server, io, messageHandlerContext };
}

/**
 * Start the production server and optional MongoDB connection lifecycle.
 * @param {{ port?: string, databaseService?: Object|null }} [options]
 * @returns {Promise<{ port: number, server: import('node:http').Server, io: import('socket.io').Server, shutdown: Function, mongoConnection: Object, databaseService: Object|null, messageHandlerContext: Object }>}
 */
async function startServer(options = {}) {
  const mongoConnection = new MongoConnection({
    mongoUri: process.env.MONGODB_URI,
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

  const { port, server, io, messageHandlerContext } = createServer({
    ...options,
    databaseService,
    initializeContext: false,
  });

  await messageHandlerContext.initializeAsync({ seedDefaults: true });

  // Best-effort persistence of HYG star + solar-system registry into Mongo so
  // future deployments can query them directly. Failures are logged and ignored.
  if (databaseService) {
    try {
      const { getHygStars } = require('./model/hyg-star-catalog');
      const { getSolarSystemRegistry } = require('./model/solar-system-registry');
      await databaseService.upsertStars(getHygStars());
      await databaseService.upsertSolarSystems(getSolarSystemRegistry());
      process.stdout.write('[server] HYG star + solar-system registry persisted\n');
    } catch (registryError) {
      process.stderr.write(
        `[server] Failed to persist star/solar-system registry: ${registryError.message}\n`
      );
    }
  }

  const celestialSeedResult = await messageHandlerContext.seedSolarSystemCelestialBodiesAsync({
    solarSystemId: 'sol',
  });
  process.stdout.write(
    `[server] Celestial body seeding ${celestialSeedResult.success ? 'completed' : 'skipped'} for ${celestialSeedResult.solarSystemId}: ${celestialSeedResult.bodyCount}\n`
  );

  const alphaCentauriSeedResult = await messageHandlerContext.seedSolarSystemCelestialBodiesAsync({
    solarSystemId: 'alpha-centauri',
  });
  process.stdout.write(
    `[server] Celestial body seeding ${alphaCentauriSeedResult.success ? 'completed' : 'skipped'} for ${alphaCentauriSeedResult.solarSystemId}: ${alphaCentauriSeedResult.bodyCount}\n`
  );

  const marketSeedResult = await messageHandlerContext.seedSolarSystemMarketsAsync({
    solarSystemId: 'sol',
  });
  process.stdout.write(
    `[server] Market seeding ${marketSeedResult.success ? 'completed' : 'skipped'} for ${marketSeedResult.solarSystemId}: ${marketSeedResult.marketCount}\n`
  );

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

  return {
    port,
    server,
    io,
    shutdown,
    mongoConnection,
    databaseService,
    messageHandlerContext,
  };
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
  startServer,
};
