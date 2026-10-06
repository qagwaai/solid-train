'use strict';

const { createTestContext } = require('./message-handler-test-helpers');
const {
  buildSeededCelestialBodiesForSolarSystem,
} = require('../src/model/solar-system-celestial-seed');

function createStationMarketTestContext() {
  const context = createTestContext();
  const timestamp = context.getCurrentTimestamp();
  for (const body of buildSeededCelestialBodiesForSolarSystem('sol', timestamp)) {
    context.celestialBodiesById.set(body.id, body);
  }
  // Older distance/route unit fixtures explicitly orbit these test-only origins.
  // Supply real snapshots instead of depending on the production missing-host fallback.
  for (const id of ['sol', 'alpha-centauri', 'barnards-star']) {
    context.celestialBodiesById.set(id, {
      id,
      spatial: {
        solarSystemId: id,
        frame: 'barycentric',
        positionKm: { x: 0, y: 0, z: 0 },
        epochMs: Date.parse(timestamp),
      },
    });
  }
  return context;
}

module.exports = { createStationMarketTestContext };
