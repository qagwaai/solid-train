'use strict';

require('dotenv').config();

const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const { MongoConnection } = require('./db/connection');
const { DatabaseService } = require('./db/service');
const { MessageHandlerContext } = require('./handlers/message-handler-context');
const { RegisterMessageHandler } = require('./handlers/register-message-handler');
const { LoginMessageHandler } = require('./handlers/login-message-handler');
const { CharacterListMessageHandler } = require('./handlers/character-list-message-handler');
const { CharacterAddMessageHandler } = require('./handlers/character-add-message-handler');
const { CharacterDeleteMessageHandler } = require('./handlers/character-delete-message-handler');
const { CharacterEditMessageHandler } = require('./handlers/character-edit-message-handler');
const {
  CharacterBustCreateMessageHandler,
} = require('./handlers/character-bust-create-message-handler');
const {
  CharacterBustReadMessageHandler,
} = require('./handlers/character-bust-read-message-handler');
const {
  CharacterBustUpdateMessageHandler,
} = require('./handlers/character-bust-update-message-handler');
const { NpcBustCreateMessageHandler } = require('./handlers/npc-bust-create-message-handler');
const { NpcBustReadMessageHandler } = require('./handlers/npc-bust-read-message-handler');
const { NpcBustUpdateMessageHandler } = require('./handlers/npc-bust-update-message-handler');
const { ShipListMessageHandler } = require('./handlers/ship-list-message-handler');
const { ShipListByOwnerMessageHandler } = require('./handlers/ship-list-by-owner-message-handler');
const { ShipUpsertMessageHandler } = require('./handlers/ship-upsert-message-handler');
const { ShipTransferMessageHandler } = require('./handlers/ship-transfer-message-handler');
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
const { ItemRemoveMessageHandler } = require('./handlers/item-remove-message-handler');
const { LaunchItemMessageHandler } = require('./handlers/launch-item-message-handler');
const {
  TractorBeamActivateMessageHandler,
} = require('./handlers/tractor-beam-activate-message-handler');
const { MarketListMessageHandler } = require('./handlers/market-list-message-handler');
const {
  MarketListByLocationMessageHandler,
} = require('./handlers/market-list-by-location-message-handler');
const { MarketQuoteMessageHandler } = require('./handlers/market-quote-message-handler');
const {
  MarketInventoryListMessageHandler,
} = require('./handlers/market-inventory-list-message-handler');
const { MarketLedgerListMessageHandler } = require('./handlers/market-ledger-list-message-handler');
const { CreditLedgerListMessageHandler } = require('./handlers/credit-ledger-list-message-handler');
const { MarketBuyMessageHandler } = require('./handlers/market-buy-message-handler');
const { MarketSellMessageHandler } = require('./handlers/market-sell-message-handler');
const {
  MarketListingCreateMessageHandler,
} = require('./handlers/market-listing-create-message-handler');
const {
  MarketOfferCreateMessageHandler,
} = require('./handlers/market-offer-create-message-handler');
const {
  MarketOfferAcceptMessageHandler,
} = require('./handlers/market-offer-accept-message-handler');
const { ItemListByOwnerMessageHandler } = require('./handlers/item-list-by-owner-message-handler');
const { ShipSalvageClaimMessageHandler } = require('./handlers/ship-salvage-claim-message-handler');
const { ShipPiracySeizeMessageHandler } = require('./handlers/ship-piracy-seize-message-handler');
const {
  ShipListByNpcOwnerMessageHandler,
} = require('./handlers/ship-list-by-npc-owner-message-handler');
const { SolarSystemListMessageHandler } = require('./handlers/solar-system-list-message-handler');
const { SolarSystemGetMessageHandler } = require('./handlers/solar-system-get-message-handler');
const { StarListMessageHandler } = require('./handlers/star-list-message-handler');
const { StarGetMessageHandler } = require('./handlers/star-get-message-handler');
const { registerSocketHandlers } = require('./handlers/socket-handler-registry');
const { createLogger } = require('./logging/logger');
const { runContractSafetyPreflight } = require('../scripts/sw08/startup-preflight');

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
 * @param {{ port?: string, databaseService?: Object|null, initializeContext?: boolean, logger?: Object, logLevel?: string }} [options]
 * @returns {{ port: number, server: import('node:http').Server, io: import('socket.io').Server, messageHandlerContext: Object }}
 */
function createServer(options = {}) {
  const logger =
    options.logger ||
    createLogger({ minLevel: options.logLevel || process.env.LOG_LEVEL || 'info' });
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
    logger,
  });
  if (options.initializeContext !== false) {
    messageHandlerContext.initializeAsync({ seedDefaults: true }).catch((error) => {
      logger.error(`[server] Context initialization failed: ${error.message}`);
    });
  }
  const registerMessageHandler = new RegisterMessageHandler(messageHandlerContext);
  const loginMessageHandler = new LoginMessageHandler(messageHandlerContext);
  const characterListMessageHandler = new CharacterListMessageHandler(messageHandlerContext);
  const characterAddMessageHandler = new CharacterAddMessageHandler(messageHandlerContext);
  const characterDeleteMessageHandler = new CharacterDeleteMessageHandler(messageHandlerContext);
  const characterEditMessageHandler = new CharacterEditMessageHandler(messageHandlerContext);
  const characterBustCreateMessageHandler = new CharacterBustCreateMessageHandler(
    messageHandlerContext
  );
  const characterBustReadMessageHandler = new CharacterBustReadMessageHandler(
    messageHandlerContext
  );
  const characterBustUpdateMessageHandler = new CharacterBustUpdateMessageHandler(
    messageHandlerContext
  );
  const npcBustCreateMessageHandler = new NpcBustCreateMessageHandler(messageHandlerContext);
  const npcBustReadMessageHandler = new NpcBustReadMessageHandler(messageHandlerContext);
  const npcBustUpdateMessageHandler = new NpcBustUpdateMessageHandler(messageHandlerContext);
  const shipListMessageHandler = new ShipListMessageHandler(messageHandlerContext);
  const shipListByOwnerMessageHandler = new ShipListByOwnerMessageHandler(messageHandlerContext);
  const shipUpsertMessageHandler = new ShipUpsertMessageHandler(messageHandlerContext);
  const shipTransferMessageHandler = new ShipTransferMessageHandler(messageHandlerContext);
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
  const itemRemoveMessageHandler = new ItemRemoveMessageHandler(messageHandlerContext);
  const launchItemMessageHandler = new LaunchItemMessageHandler(messageHandlerContext);
  const tractorBeamActivateMessageHandler = new TractorBeamActivateMessageHandler(
    messageHandlerContext
  );
  const marketListMessageHandler = new MarketListMessageHandler(messageHandlerContext);
  const marketListByLocationMessageHandler = new MarketListByLocationMessageHandler(
    messageHandlerContext
  );
  const marketQuoteMessageHandler = new MarketQuoteMessageHandler(messageHandlerContext);
  const marketInventoryListMessageHandler = new MarketInventoryListMessageHandler(
    messageHandlerContext
  );
  const marketLedgerListMessageHandler = new MarketLedgerListMessageHandler(messageHandlerContext);
  const creditLedgerListMessageHandler = new CreditLedgerListMessageHandler(messageHandlerContext);
  const marketBuyMessageHandler = new MarketBuyMessageHandler(messageHandlerContext);
  const marketSellMessageHandler = new MarketSellMessageHandler(messageHandlerContext);
  const marketListingCreateMessageHandler = new MarketListingCreateMessageHandler(
    messageHandlerContext
  );
  const marketOfferCreateMessageHandler = new MarketOfferCreateMessageHandler(
    messageHandlerContext
  );
  const marketOfferAcceptMessageHandler = new MarketOfferAcceptMessageHandler(
    messageHandlerContext
  );
  const itemListByOwnerMessageHandler = new ItemListByOwnerMessageHandler(messageHandlerContext);
  const shipSalvageClaimMessageHandler = new ShipSalvageClaimMessageHandler(messageHandlerContext);
  const shipPiracySeizeMessageHandler = new ShipPiracySeizeMessageHandler(messageHandlerContext);
  const shipListByNpcOwnerMessageHandler = new ShipListByNpcOwnerMessageHandler(
    messageHandlerContext
  );
  const solarSystemListMessageHandler = new SolarSystemListMessageHandler(messageHandlerContext);
  const solarSystemGetMessageHandler = new SolarSystemGetMessageHandler(messageHandlerContext);
  const starListMessageHandler = new StarListMessageHandler(messageHandlerContext);
  const starGetMessageHandler = new StarGetMessageHandler(messageHandlerContext);

  // Express app for REST endpoints
  const app = express();
  const documentationRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const openApiSpecPath = path.resolve(__dirname, '..', 'api', 'openapi.yaml');
  const openApiModulesDirPath = path.resolve(__dirname, '..', 'api', 'openapi');
  const schemaDirPath = path.resolve(__dirname, '..', 'api', 'schemas');
  const celestialBodyContractPath = path.resolve(
    __dirname,
    '..',
    'docs',
    'celestial-body-contract.md'
  );

  app.get('/openapi.yaml', documentationRateLimit, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(openApiSpecPath);
  });

  app.get('/docs/celestial-body-contract.md', documentationRateLimit, (req, res) => {
    res.set('Content-Type', 'text/markdown; charset=utf-8').sendFile(celestialBodyContractPath);
  });

  // Expose modular OpenAPI files so root $ref pointers can resolve at runtime.
  const contractStaticOptions = {
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-store'),
  };
  app.use('/openapi', express.static(openApiModulesDirPath, contractStaticOptions));

  // Expose schema files so external $ref values in openapi.yaml can resolve.
  app.use('/schemas', express.static(schemaDirPath, contractStaticOptions));
  // Expose schemas under /openapi/schemas so relative refs inside /openapi/* modules resolve.
  app.use('/openapi/schemas', express.static(schemaDirPath, contractStaticOptions));

  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(null, {
      swaggerOptions: {
        url: '/openapi.yaml',
      },
      explorer: true,
    })
  );

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

    registerSocketHandlers(
      socket,
      {
        registerMessageHandler,
        loginMessageHandler,
        characterListMessageHandler,
        characterAddMessageHandler,
        characterDeleteMessageHandler,
        characterEditMessageHandler,
        characterBustCreateMessageHandler,
        characterBustReadMessageHandler,
        characterBustUpdateMessageHandler,
        npcBustCreateMessageHandler,
        npcBustReadMessageHandler,
        npcBustUpdateMessageHandler,
        shipListMessageHandler,
        shipListByOwnerMessageHandler,
        shipUpsertMessageHandler,
        shipTransferMessageHandler,
        gameJoinMessageHandler,
        missionUpsertMessageHandler,
        celestialBodyUpsertMessageHandler,
        celestialBodyListMessageHandler,
        missionListMessageHandler,
        itemUpsertMessageHandler,
        itemListByContainerMessageHandler,
        itemListByLocationMessageHandler,
        itemRemoveMessageHandler,
        launchItemMessageHandler,
        tractorBeamActivateMessageHandler,
        marketListMessageHandler,
        marketListByLocationMessageHandler,
        marketQuoteMessageHandler,
        marketInventoryListMessageHandler,
        marketLedgerListMessageHandler,
        creditLedgerListMessageHandler,
        marketBuyMessageHandler,
        marketSellMessageHandler,
        marketListingCreateMessageHandler,
        marketOfferCreateMessageHandler,
        marketOfferAcceptMessageHandler,
        itemListByOwnerMessageHandler,
        shipSalvageClaimMessageHandler,
        shipPiracySeizeMessageHandler,
        shipListByNpcOwnerMessageHandler,
        solarSystemListMessageHandler,
        solarSystemGetMessageHandler,
        starListMessageHandler,
        starGetMessageHandler,
      },
      messageHandlerContext
    );
  });

  return { port, server, io, messageHandlerContext };
}

/**
 * Start the production server and optional MongoDB connection lifecycle.
 * @param {{ port?: string, host?: string, databaseService?: Object|null, logger?: Object, logLevel?: string }} [options]
 * @returns {Promise<{ port: number, server: import('node:http').Server, io: import('socket.io').Server, shutdown: Function, mongoConnection: Object, databaseService: Object|null, messageHandlerContext: Object }>}
 */
async function startServer(options = {}) {
  const logger =
    options.logger ||
    createLogger({ minLevel: options.logLevel || process.env.LOG_LEVEL || 'info' });
  const contractReport = runContractSafetyPreflight();
  logger.info(
    `[contract-preflight] Approved baseline verified; varianceCount=${contractReport.summary.totalIssues}`
  );
  const mongoConnection = new MongoConnection({
    mongoUri: process.env.MONGODB_URI,
    logger,
  });
  let databaseService = null;

  // Connect to MongoDB if URI is configured; otherwise run in-memory.
  if (process.env.MONGODB_URI) {
    try {
      await mongoConnection.connect();
      databaseService = new DatabaseService({ logger });
      logger.info('[server] MongoDB connection established');
    } catch (error) {
      logger.error(
        `[server] Failed to connect to MongoDB, using in-memory storage: ${error.message}`
      );
    }
  } else {
    logger.info('[server] MONGODB_URI not configured; running with in-memory storage');
  }

  const { port, server, io, messageHandlerContext } = createServer({
    ...options,
    databaseService,
    initializeContext: false,
    logger,
  });

  await messageHandlerContext.initializeAsync({ seedDefaults: true });

  // Best-effort persistence of the star catalog (HYG + exoplanet catalog) and the
  // solar-system registry into Mongo. Bulk writes are skipped when the content
  // hash is unchanged (D49). Failures are logged and ignored.
  if (databaseService) {
    logger.info('[server] Starting star catalog + solar-system registry persistence');
    const registryStartedAt = Date.now();
    try {
      const { getStarCatalogEntries } = require('./model/star-catalog');
      const { getSolarSystemRegistry } = require('./model/solar-system-registry');
      const starSync = await databaseService.syncStars(getStarCatalogEntries());
      const systemSync = await databaseService.syncSolarSystems(getSolarSystemRegistry());
      const describe = (result) =>
        result.skipped ? 'unchanged' : `${result.upserted} upserted, ${result.removed} removed`;
      logger.info(
        `[server] Star catalog (${describe(starSync)}) + solar-system registry (${describe(systemSync)}) persisted (${Date.now() - registryStartedAt}ms)`
      );
    } catch (registryError) {
      logger.error(
        `[server] Failed to persist star/solar-system registry (${Date.now() - registryStartedAt}ms): ${registryError.message}`
      );
    }
  }

  const seedCelestialBodies = async (solarSystemId) => {
    logger.info(`[server] Starting celestial body seeding for ${solarSystemId}`);
    const startedAt = Date.now();
    const result = await messageHandlerContext.seedSolarSystemCelestialBodiesAsync({
      solarSystemId,
    });
    logger.info(
      `[server] Celestial body seeding ${result.success ? 'completed' : 'skipped'} for ${result.solarSystemId}: ${result.bodyCount} (${Date.now() - startedAt}ms)`
    );
    return result;
  };

  await seedCelestialBodies('sol');
  await seedCelestialBodies('alpha-centauri');

  const marketSystems = ['sol', 'alpha-centauri', 'barnards-star'];
  // Barnard b (exoplanet catalog, D45) must exist before strict station materialization.
  await seedCelestialBodies('barnards-star');
  for (const solarSystemId of marketSystems) {
    logger.info(`[server] Starting market seeding for ${solarSystemId}`);
    const marketStartedAt = Date.now();
    const marketSeedResult = await messageHandlerContext.seedSolarSystemMarketsAsync({
      solarSystemId,
    });
    logger.info(
      `[server] Market seeding ${marketSeedResult.success ? 'completed' : 'skipped'} for ${marketSeedResult.solarSystemId}: ${marketSeedResult.marketCount} (${Date.now() - marketStartedAt}ms)`
    );
  }

  logger.info('[server] Starting NPC seeding for sol');
  const npcStartedAt = Date.now();
  const npcSeedResult = await messageHandlerContext.seedSolarSystemNpcsAsync({
    solarSystemId: 'sol',
  });
  logger.info(
    `[server] NPC seeding ${npcSeedResult.success ? 'completed' : 'skipped'} for ${npcSeedResult.solarSystemId}: ${npcSeedResult.npcCount} (${Date.now() - npcStartedAt}ms)`
  );

  const host = options.host || process.env.HOST;
  const onListening = () => {
    logger.info(`Stellar Socket.IO server listening on port ${port}`);
    logger.info(`[server] Swagger UI available at http://localhost:${port}/docs/`);
  };

  if (host) {
    server.listen(port, host, onListening);
  } else {
    server.listen(port, onListening);
  }

  const shutdown = async () => {
    const fallbackTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit.');
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
          logger.error(`[server] Error disconnecting from MongoDB: ${dbError.message}`);
        }
        if (error && error.message !== 'Server is not running.') {
          logger.error(`Shutdown error: ${error.message}`);
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
    const startupLogger = createLogger({ minLevel: process.env.LOG_LEVEL || 'info' });
    startupLogger.error(`[server] Startup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  createServer,
  resolvePort,
  startServer,
};
