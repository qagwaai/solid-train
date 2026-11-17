'use strict';

const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const {
  NavigationRouteEstimateMessageHandler,
} = require('../src/handlers/navigation-route-estimate-message-handler');
const {
  registerTrustedNavigationPlacementAsync,
} = require('../src/handlers/context/navigation-state-service');
const {
  buildSeededCelestialBodiesForSolarSystem,
} = require('../src/model/solar-system-celestial-seed');
const { buildSeededMarketsForSolarSystem } = require('../src/model/solar-system-market-seed');
const { materializeStationSnapshotAsync } = require('../src/handlers/context/orbital-math');

async function navigationFixture(
  sourceMarketId = 'sol-mars-orbit',
  epoch = '2026-11-14T00:00:00.000Z'
) {
  const logs = [];
  const ctx = new MessageHandlerContext({ log: (message) => logs.push(message) });
  const bodies = buildSeededCelestialBodiesForSolarSystem('sol', '2026-04-17T00:00:00.000Z');
  const markets = buildSeededMarketsForSolarSystem('sol');
  for (const body of bodies) ctx.celestialBodiesById.set(body.id, body);
  for (const market of markets) ctx.marketsByKey.set(`sol:${market.marketId}`, market);
  const evaluated = new MessageHandlerContext({
    log: () => {},
    celestialBodiesById: new Map(
      buildSeededCelestialBodiesForSolarSystem('sol', epoch).map((body) => [body.id, body])
    ),
  });
  const source = markets.find((market) => market.marketId === sourceMarketId);
  const placement = await materializeStationSnapshotAsync(evaluated, source);
  const ship = {
    id: 'fixture-ship',
    model: 'Scavenger Pod',
    inventory: [],
    spatial: structuredClone(placement.spatial),
    ownership: {
      ownerType: 'player-character',
      playerId: 'fixture-player',
      characterId: 'fixture-character',
      npcId: null,
      factionId: null,
    },
  };
  ctx.registeredPlayers.set('fixturepilot', {
    playerId: 'fixture-player',
    playerName: 'FixturePilot',
  });
  ctx.charactersByPlayer.set('fixturepilot', [{ id: 'fixture-character', ships: [ship] }]);
  await registerTrustedNavigationPlacementAsync(ctx, {
    playerName: 'FixturePilot',
    shipId: ship.id,
    sourceMarketId,
    offsetKm: { x: 0, y: 0, z: 0 },
  });
  Object.assign(ctx, {
    seedSolarSystemCelestialBodiesAsync: async () => {
      throw new Error('Navigation must not seed');
    },
    refreshCharacterPresence: () => {
      throw new Error('Navigation must not refresh presence');
    },
  });
  const request = {
    playerName: 'FixturePilot',
    sessionKey: 'fixture-session',
    correlationId: '36ea198f-0df8-4fa9-82b3-7bdfe0d9fd66',
    requestIdentity: {
      operation: 'navigation-route-estimate',
      entityType: 'solar-system',
      containerId: 'sol',
    },
    solarSystemId: 'sol',
    shipId: ship.id,
    destinationMarketId: 'sol-pluto-orbit',
  };
  return {
    ctx,
    ship,
    bodies,
    markets,
    source,
    evaluated,
    logs,
    request,
    handler: new NavigationRouteEstimateMessageHandler(ctx),
  };
}

module.exports = { navigationFixture };
