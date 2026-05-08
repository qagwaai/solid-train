'use strict';

const {
  MessageHandlerContext
} = require('../src/handlers/message-handler-context');

function createTestContext(options = {}) {
  const defaultSeedIds = ['player-1', 'session-1', 'session-2', 'character-1'];
  const providedSeedIds = Array.isArray(options.seedIds) ? options.seedIds : null;
  const issuedIds = (providedSeedIds || defaultSeedIds)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => Boolean(value));
  let generatedIdCounter = 0;

  return new MessageHandlerContext({
    createId: () => {
      const nextIssued = issuedIds.shift();
      if (nextIssued) {
        return nextIssued;
      }

      generatedIdCounter += 1;
      return `generated-${generatedIdCounter}`;
    },
    getCurrentTimestamp: () => '2026-04-17T00:00:00.000Z'
  });
}

function createMockSocket(id = 'socket-1') {
  const events = [];

  return {
    id,
    events,
    emit(eventName, payload) {
      events.push({ eventName, payload });
    }
  };
}

function createSpatialState(overrides = {}) {
  return {
    solarSystemId: overrides.solarSystemId || 'sol',
    frame: 'barycentric',
    positionKm: overrides.positionKm || { x: 0, y: 0, z: 0 },
    epochMs: overrides.epochMs || 1713360000000
  };
}

function createMotionState(overrides = {}) {
  if (overrides === null) {
    return null;
  }

  return {
    velocityKmPerSec: overrides.velocityKmPerSec || { x: 0, y: 0, z: 0 },
    ...(overrides.angularVelocityRadPerSec
      ? { angularVelocityRadPerSec: overrides.angularVelocityRadPerSec }
      : {})
  };
}

function createPhysicalState(overrides = {}) {
  if (overrides === null) {
    return null;
  }

  return {
    ...(overrides.estimatedMassKg !== undefined
      ? { estimatedMassKg: overrides.estimatedMassKg }
      : { estimatedMassKg: 1e18 }),
    ...(overrides.estimatedDiameterM !== undefined
      ? { estimatedDiameterM: overrides.estimatedDiameterM }
      : { estimatedDiameterM: 500 })
  };
}

function createObservabilityState(overrides = {}) {
  return {
    visibility: overrides.visibility || 'visible',
    scanState: overrides.scanState || 'scanned'
  };
}

function createShip(overrides = {}) {
  return {
    id: overrides.id || 'ship-1',
    shipName: overrides.shipName || 'Scavenger Pod',
    status: overrides.status || null,
    model: overrides.model || 'Scavenger Pod',
    tier: overrides.tier || 1,
    createdAt: overrides.createdAt || '2026-04-17T00:00:00.000Z',
    inventory: overrides.inventory || [],
    spatial: createSpatialState(overrides.spatial || {}),
    ...(overrides.motion !== undefined
      ? { motion: createMotionState(overrides.motion) }
      : {}),
    launchable: overrides.launchable !== undefined ? overrides.launchable : true,
    damageProfile: overrides.damageProfile || null
  };
}

function createCelestialBody(overrides = {}) {
  return {
    id: overrides.id || 'asteroid-1',
    catalogId: overrides.catalogId || 'catalog-001',
    sourceScanId: overrides.sourceScanId || 'scan-1',
    createdByCharacterId: overrides.createdByCharacterId || 'char-1',
    missionId: overrides.missionId || null,
    missionInstanceId: overrides.missionInstanceId || null,
    createdAt: overrides.createdAt || '2026-04-17T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-04-17T00:00:00.000Z',
    spatial: createSpatialState(overrides.spatial || {
      positionKm: { x: 150000, y: 50000, z: 30000 }
    }),
    ...(overrides.motion !== undefined
      ? { motion: createMotionState(overrides.motion) }
      : {}),
    ...(overrides.physical !== undefined
      ? { physical: createPhysicalState(overrides.physical) }
      : {}),
    observability: createObservabilityState(overrides.observability || {}),
    composition: overrides.composition || {
      rarity: 'Rare',
      material: 'Iron',
      textureColor: '#888888'
    },
    state: overrides.state || 'active',
    destroyedAt: overrides.destroyedAt || null,
    destroyedReason: overrides.destroyedReason || null,
    debrisSeed: overrides.debrisSeed || null,
    debris: overrides.debris || []
  };
}

function createContainedItem(overrides = {}) {
  return {
    id: overrides.id || 'item-1',
    itemType: overrides.itemType || 'expendable-dart-drone',
    displayName: overrides.displayName || 'Expendable Dart Drone',
    state: overrides.state || 'contained',
    damageStatus: overrides.damageStatus || 'intact',
    container: overrides.container !== undefined
      ? overrides.container
      : { containerType: 'ship', containerId: 'ship-1' },
    owningPlayerId: overrides.owningPlayerId || 'player-1',
    owningCharacterId: overrides.owningCharacterId || 'character-1',
    spatial: overrides.spatial !== undefined ? overrides.spatial : null,
    ...(overrides.motion !== undefined ? { motion: overrides.motion } : {}),
    createdAt: overrides.createdAt || '2026-04-17T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-04-17T00:00:00.000Z',
    destroyedAt: overrides.destroyedAt || null,
    destroyedReason: overrides.destroyedReason || null,
    launchable: overrides.launchable !== undefined ? overrides.launchable : true,
    quantity: overrides.quantity || 1
  };
}

function createDeployedItem(overrides = {}) {
  const positionKm = overrides.positionKm
    || (overrides.spatial && overrides.spatial.positionKm)
    || { x: 1000, y: 0, z: 0 };
  const spatial = overrides.spatial === null
    ? null
    : createSpatialState({
      ...(overrides.spatial || {}),
      positionKm
    });

  return {
    id: overrides.id || 'deployed-item-1',
    itemType: overrides.itemType || 'expendable-dart-drone',
    displayName: overrides.displayName || 'Expendable Dart Drone',
    state: overrides.state || 'deployed',
    damageStatus: overrides.damageStatus || 'intact',
    container: overrides.container !== undefined ? overrides.container : null,
    owningPlayerId: overrides.owningPlayerId || 'player-1',
    owningCharacterId: overrides.owningCharacterId || 'character-1',
    spatial,
    ...(overrides.motion !== undefined
      ? { motion: createMotionState(overrides.motion) }
      : {}),
    createdAt: overrides.createdAt || '2026-04-17T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-04-17T00:00:00.000Z',
    destroyedAt: overrides.destroyedAt || null,
    destroyedReason: overrides.destroyedReason || null,
    launchable: overrides.launchable !== undefined ? overrides.launchable : true,
    quantity: overrides.quantity || 1
  };
}

function createMarket(overrides = {}) {
  return {
    marketId: overrides.marketId || 'market-1',
    solarSystemId: overrides.solarSystemId || 'sol',
    marketName: overrides.marketName || 'Ceres Exchange',
    siteType: overrides.siteType || 'station',
    siteName: overrides.siteName || 'Ceres Main',
    spatial: createSpatialState(overrides.spatial || {
      positionKm: { x: 413000, y: 0, z: 0 }
    }),
    ...(overrides.trajectory
      ? {
        trajectory: {
          kind: overrides.trajectory.kind || 'orbital-elements',
          ...(overrides.trajectory.orbit ? { orbit: overrides.trajectory.orbit } : {})
        }
      }
      : {}),
    isStarterMarket: overrides.isStarterMarket || false,
    priceMultiplier: overrides.priceMultiplier !== undefined ? overrides.priceMultiplier : 1,
    driftPercentPerHour: overrides.driftPercentPerHour !== undefined ? overrides.driftPercentPerHour : 0,
    restockIntervalMinutes: overrides.restockIntervalMinutes || 60,
    lastRestockAt: overrides.lastRestockAt || '2026-04-17T00:00:00.000Z',
    inventory: overrides.inventory || [],
    ledger: overrides.ledger || []
  };
}

function seedItems(context, items = []) {
  const normalizedItems = Array.isArray(items) ? items : [];

  for (const item of normalizedItems) {
    context.itemsById.set(item.id, item);
  }

  return normalizedItems;
}

function seedCelestialBodies(context, celestialBodies = []) {
  const normalizedBodies = Array.isArray(celestialBodies) ? celestialBodies : [];

  for (const celestialBody of normalizedBodies) {
    context.celestialBodiesById.set(celestialBody.id, celestialBody);
  }

  return normalizedBodies;
}

function seedPlayer(context, overrides = {}) {
  const normalizedPlayerName = (overrides.playerName || 'PilotOne').toLowerCase();
  const player = {
    playerId: overrides.playerId || 'player-seeded',
    playerName: overrides.playerName || 'PilotOne',
    email: overrides.email || 'pilot@example.com',
    password: overrides.password || 'secret',
    preferredLocale: overrides.preferredLocale || 'en',
    sessionKey: overrides.sessionKey || null,
    socketId: overrides.socketId || null
  };

  context.registeredPlayers.set(normalizedPlayerName, player);
  context.setCharacters(normalizedPlayerName, overrides.characters || []);

  return player;
}

function seedTraderCharacter(context, options = {}) {
  const startingBalance = Number.isFinite(options.startingBalance)
    ? options.startingBalance
    : 2000;
  const shipOverrides = options.shipOverrides || {};

  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    playerId: 'player-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Trader',
        createdAt: '2026-05-05T00:00:00.000Z',
        ships: [createShip({
          id: 'ship-1',
          shipName: 'Trader Ship 1',
          createdAt: '2026-05-05T00:00:00.000Z',
          ...shipOverrides
        })],
        missions: [],
        creditLedger: [
          {
            type: 'put',
            amount: startingBalance,
            description: 'Seed',
            timestamp: '2026-05-05T00:00:00.000Z',
            referenceId: null
          }
        ]
      }
    ]
  });
}

module.exports = {
  createCelestialBody,
  createContainedItem,
  createDeployedItem,
  createMarket,
  createMockSocket,
  createMotionState,
  createObservabilityState,
  createPhysicalState,
  createShip,
  createSpatialState,
  createTestContext,
  seedCelestialBodies,
  seedItems,
  seedPlayer,
  seedTraderCharacter
};