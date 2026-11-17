'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Parser = require('@apidevtools/swagger-parser');
const { createSchemaValidator } = require('../src/model/schema-validator');

const contract = Parser.dereference(path.join(__dirname, '..', 'api', 'openapi.yaml'));
const documentation = fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'spatial-model.md'),
  'utf8'
);

function firstJsonAfter(heading) {
  const start = documentation.indexOf(heading);
  assert.notEqual(start, -1, `Missing documentation heading: ${heading}`);
  const match = /```json\s*\r?\n([\s\S]*?)```/.exec(documentation.slice(start));
  assert.ok(match, `Missing JSON example after: ${heading}`);
  return JSON.parse(match[1]);
}

test('real purchase/restart example and preview overlay preserve distinct stored and evaluated positions', async () => {
  const example = firstJsonAfter('### Real local committed purchase and restart capture');
  const overlay = firstJsonAfter('#### Projected-marker example from the real capture');
  const state = example.navigationState;
  const api = await contract;
  const validate = createSchemaValidator({ strict: false }).compile(
    api.paths['/socket/solar-system-get'].post.responses['200'].content['application/json'].schema
      .properties.navigationState
  );
  assert.equal(validate(state), true, JSON.stringify(validate.errors));
  assert.equal(state.epochMs, example.ship.spatial.epochMs);
  assert.deepEqual(state.departure.positionKm, example.ship.spatial.positionKm);
  assert.notEqual(state.epochMs, example.station.spatial.epochMs);
  assert.equal(state.destination.hostSourceEpochMs, example.host.spatial.epochMs);
  assert.equal(state.destination.marketId, example.station.marketId);
  assert.equal(state.destination.hostBodyId, example.host.id);

  const destination = overlay.markers.find((marker) => marker.key === overlay.destinationMarkerKey);
  const candidate = overlay.markers.find((marker) => marker.key === overlay.candidateMarkerKey);
  assert.ok(destination);
  assert.ok(candidate);
  assert.equal(destination.marketId, state.destination.marketId);
  assert.equal(candidate.bodyId, state.candidates[0].bodyId);
  assert.deepEqual(destination.positionKm, state.destination.positionKm);
  assert.deepEqual(candidate.positionKm, state.candidates[0].positionKm);
  assert.notDeepEqual(destination.positionKm, example.station.spatial.positionKm);
  const displacementKm = Math.hypot(
    ...['x', 'y', 'z'].map(
      (axis) => destination.positionKm[axis] - example.station.spatial.positionKm[axis]
    )
  );
  assert.ok(
    displacementKm > 2.84e6 && displacementKm < 2.86e6,
    `Actual stored/projected station displacement was ${displacementKm} km`
  );
  for (const marker of [destination, candidate]) {
    assert.equal(marker.solarSystemId, state.solarSystemId);
    assert.equal(marker.epochMs, state.epochMs);
    assert.match(marker.presentation, /preview-only/);
    assert.match(marker.label, /Projected preview/);
    assert.ok(marker.label.includes(marker.marketId || marker.bodyId));
    assert.ok(marker.label.includes(String(state.epochMs)));
  }
  const routeAnchors = overlay.routePointSources.map((source) => {
    assert.match(source, /^navigationState\./);
    return source
      .replace('navigationState.', '')
      .replaceAll(/\[(\d+)\]/g, '.$1')
      .split('.')
      .reduce((value, key) => value[key], state);
  });
  assert.deepEqual(routeAnchors, [
    state.departure.positionKm,
    candidate.positionKm,
    destination.positionKm,
  ]);
  assert.deepEqual(state.previewEligibility, {
    status: 'eligible-with-warnings',
    reason: 'CLEARANCE_UNVERIFIED',
  });
  assert.match(overlay.warning, /clearance unknown/);
  assert.deepEqual(
    [state.motion.status, state.clearance.status, state.gravityAssist.status],
    ['unsupported', 'unsupported', 'unsupported']
  );
});

test('market OpenAPI examples validate and purchasedShip issuance cannot be omitted or malformed', async () => {
  const api = await contract;
  const response =
    api.paths['/socket/market-buy'].post.responses['200'].content['application/json'];
  const validate = createSchemaValidator({ strict: false }).compile(response.schema);
  for (const [name, example] of Object.entries(response.examples)) {
    assert.equal(validate(example.value), true, `${name}: ${JSON.stringify(validate.errors)}`);
  }
  const purchase = structuredClone(response.examples.successfulShipBuy.value);
  const ship = purchase.transaction.purchasedShip;
  for (const outcome of [
    { status: 'supported', lineageId: 'example-lineage' },
    {
      status: 'unsupported',
      reason: 'KNOWN_INVALID_SOURCE',
      message: 'Known station profile intersection',
    },
  ]) {
    ship.navigationPlacement = outcome;
    assert.equal(validate(purchase), true, JSON.stringify(validate.errors));
  }
  for (const outcome of [
    { status: 'supported' },
    { status: 'unsupported' },
    { status: 'unknown' },
    { status: 'supported', lineageId: 'example-lineage', shipRevision: 'private-attestation' },
  ]) {
    ship.navigationPlacement = outcome;
    assert.equal(validate(purchase), false, JSON.stringify(outcome));
  }
  delete ship.navigationPlacement;
  assert.equal(validate(purchase), false, 'purchasedShip requires an explicit issuance result');
  delete purchase.transaction.purchasedShip;
  assert.equal(validate(purchase), true, 'Cargo responses need no ship issuance result');
});
