'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { seedPlayer } = require('../test-support/message-handler-test-helpers');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { SolarSystemListMessageHandler } = require('../src/handlers/solar-system-list-message-handler');
const { SolarSystemGetMessageHandler } = require('../src/handlers/solar-system-get-message-handler');
const { seedCopperValeIsolatedPilot } = require('../src/model/copper-vale-isolated-pilot');

test('fresh Mongo context lists all augmented planet/moon counts and filters before paging', async () => {
  const harness = await createMongoTestHarness();
  try {
    await seedCopperValeIsolatedPilot(harness.databaseService);
    const context = new MessageHandlerContext({ databaseService: harness.databaseService });
    seedPlayer(context, { playerName: 'CountPilot', sessionKey: 'count-session' });
    const handler = new SolarSystemListMessageHandler(context);
    const payload = {
      playerName: 'CountPilot', sessionKey: 'count-session',
      search: 'Copper Vale', minPlanetCount: 5, limit: 1,
    };
    const response = await handler.buildResponse(payload);
    assert.equal(response.success, true);
    assert.equal(response.total, 1);
    const system = response.solarSystems[0];
    assert.deepEqual(
      [system.planetCount, system.moonCount, system.asteroidCount, system.marketCount],
      [5, 16, 26, 1]
    );
    const excluded = await handler.buildResponse({ ...payload, minPlanetCount: 6 });
    assert.equal(excluded.total, 0);
    assert.deepEqual(excluded.solarSystems, []);
    const detail = await new SolarSystemGetMessageHandler(context).buildResponse({
      ...payload, solarSystemId: 'exo-gj-9066',
    });
    assert.equal(detail.success, true);
    assert.equal(detail.bodies.length, 57);
    assert.deepEqual(
      [detail.solarSystem.planetCount, detail.solarSystem.moonCount, detail.solarSystem.asteroidCount],
      [5, 16, 26]
    );
    const unseeded = await handler.buildResponse({
      ...payload, search: '55 Cnc', minPlanetCount: 7,
    });
    assert.equal(unseeded.solarSystems[0].planetCount, 7);
  } finally {
    await harness.teardown();
  }
});
