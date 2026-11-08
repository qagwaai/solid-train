'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const {
  previewCopperValeP4,
  validateP4Preview,
  isNamingEligible,
  applyBodyNames,
  resolveNamedBody,
  assertNameLookup,
} = require('../src/model/non-sol-p4-preview');
const { previewCopperValeP3 } = require('../src/model/non-sol-p3-preview');
const { previewExpandedNonSolSystem } = require('../src/model/non-sol-expanded-augmentation');
const manifest = require('../data/copper-vale-body-naming-manifest-v1.json');

test('P4 applies exactly the approved 18 eligible names and separates lane/language denominators', () => {
  const preview = previewCopperValeP4();
  assert.deepEqual(preview.counts, {
    cultural: 18,
    inherited: 11,
    narrative: 7,
    systematic: 37,
    protectedExisting: 2,
    languages: { English: 13, Mandarin: 1, Russian: 1, Spanish: 1, Arabic: 1, Hindi: 1 },
  });
  assert.deepEqual(
    preview.generatedBodies
      .filter((body) => isNamingEligible(body))
      .map((body) => body.id)
      .sort(),
    Object.keys(manifest.assignments).sort()
  );
  for (const entry of preview.assignments) {
    assert.equal(entry.preferredName, manifest.assignments[entry.bodyId].preferredName);
    assert.equal(entry.editorialStatus, 'owner-approved-offline');
    if (entry.language !== 'English')
      assert.equal(entry.linguisticStatus, 'unverified-sketch-owner-accepted');
    assert.ok(!entry.aliases.includes(entry.preferredName));
  }
  assert.equal(preview.runtimeEnabled, false);
  assert.equal(preview.databaseWrites, false);
});

test('eligibility uses diameter at the exact 200km boundary and supports explicit story-important overrides only', () => {
  const moon = { id: 'small-moon', bodyType: 'moon', physicalCatalog: { meanRadiusKm: 100 } };
  assert.equal(isNamingEligible(moon), true);
  assert.equal(isNamingEligible({ ...moon, physicalCatalog: { meanRadiusKm: 99.999999 } }), false);
  assert.equal(isNamingEligible({ ...moon, physicalCatalog: { meanRadiusKm: 100.000001 } }), true);
  const asteroid = { ...moon, bodyType: 'asteroid', physicalCatalog: { meanRadiusKm: 1000 } };
  assert.equal(isNamingEligible(asteroid), false);
  assert.equal(isNamingEligible(asteroid, 200, [asteroid.id]), true);
  assert.equal(isNamingEligible({ ...moon, bodyType: 'planet' }), true);
  assert.equal(isNamingEligible({ ...moon, bodyType: 'dwarf-planet' }), true);
});

test('names and aliases resolve with explicit system qualification without changing parent IDs or station snapshots', () => {
  const p3 = previewCopperValeP3();
  const preview = previewCopperValeP4();
  const bodies = [...preview.baseBodies, ...preview.generatedBodies];
  for (const old of p3.generatedBodies) {
    const named = preview.generatedBodies.find((body) => body.id === old.id);
    assert.equal(resolveNamedBody(bodies, preview.systemId, old.id).id, old.id);
    assert.equal(resolveNamedBody(bodies, preview.systemId, old.displayName).id, old.id);
    assert.equal(resolveNamedBody(bodies, preview.systemId, named.displayName).id, old.id);
    assert.equal(named.parentBodyId, old.parentBodyId);
    if (manifest.assignments[old.id])
      assert.ok(named.universeMetadata.naming.aliases.includes(old.displayName));
    else assert.deepEqual(named, old);
  }
  const station = structuredClone(preview.station);
  assert.equal(station.trajectory.orbit.anchorBodyName, 'Hearthward');
  station.trajectory.orbit.anchorBodyName = p3.station.trajectory.orbit.anchorBodyName;
  assert.deepEqual(station, p3.station);
  assert.throws(() => resolveNamedBody(bodies, 'other-system', 'Hearthward'), /exactly one/);
  assert.throws(() => resolveNamedBody(bodies, '', 'Hearthward'), /explicit/);
  assert.throws(() => resolveNamedBody(bodies, preview.systemId, 'missing'), /exactly one/);
});

test('naming preserves all P2/P3 physical, resource and generation state and leaves four pilots unchanged', () => {
  const before = previewCopperValeP3();
  const preview = previewCopperValeP4();
  assert.deepEqual(preview.baseBodies, before.baseBodies);
  for (const old of before.generatedBodies) {
    const named = structuredClone(preview.generatedBodies.find((body) => body.id === old.id));
    named.displayName = old.displayName;
    named.universeMetadata.naming = old.universeMetadata.naming;
    named.universeMetadata.provenance.fieldSources = old.universeMetadata.provenance.fieldSources;
    assert.deepEqual(named, old);
  }
  assert.deepEqual(previewCopperValeP3(), before);
  for (const entry of preview.unchangedSystems) {
    const original = previewExpandedNonSolSystem(entry.systemId);
    assert.equal(entry.outputSha256, original.outputSha256);
    assert.equal(entry.generatedBodyCount, 0);
    assert.equal(entry.namingChanged, false);
    assert.equal(entry.status, 'blocked');
  }
});

test('fixed names are independent of epoch and input ordering, and naming application is idempotent', () => {
  const first = previewCopperValeP4();
  const later = previewCopperValeP4({ epoch: '2026-11-07T00:00:00.000Z' });
  assert.deepEqual(later.assignments, first.assignments);
  assert.notDeepEqual(later.generatedBodies[0].spatial, first.generatedBodies[0].spatial);
  const p3 = previewCopperValeP3();
  const reverse = applyBodyNames([...p3.generatedBodies].reverse(), manifest);
  assert.deepEqual(reverse.reverse(), first.generatedBodies);
  assert.deepEqual(applyBodyNames(first.generatedBodies, manifest), first.generatedBodies);
  assert.equal(validateP4Preview(later), true);
});

test('collision checks, protected bodies and incorrect manifest scopes fail explicitly', () => {
  const p3 = previewCopperValeP3();
  const invalid = structuredClone(manifest);
  const ids = Object.keys(invalid.assignments);
  invalid.assignments[ids[1]].preferredName = invalid.assignments[ids[0]].preferredName;
  assert.throws(() => applyBodyNames(p3.generatedBodies, invalid), /Ambiguous/);
  delete invalid.assignments[ids[0]];
  assert.throws(() => applyBodyNames(p3.generatedBodies, invalid), /eligible/);
  const protectedBodies = structuredClone(p3.generatedBodies);
  protectedBodies.find((body) => body.id === ids[0]).universeMetadata.naming.lane = 'protected';
  assert.throws(() => applyBodyNames(protectedBodies, manifest), /protected/);
  const body = { id: 'one', displayName: 'Café', spatial: { solarSystemId: 'one-system' } };
  assert.throws(
    () => assertNameLookup([body, { ...body, id: 'two', displayName: 'Cafe!' }]),
    /Ambiguous/
  );
  assert.doesNotThrow(() =>
    assertNameLookup([body, { ...body, id: 'two', spatial: { solarSystemId: 'two-system' } }])
  );
});

test('serialized reports replay exactly and tampering cannot claim successful naming validation', () => {
  const preview = previewCopperValeP4();
  const persisted = JSON.parse(JSON.stringify(preview));
  assert.deepEqual(persisted, preview);
  assert.equal(validateP4Preview(persisted), true);
  const { outputSha256, ...content } = preview;
  assert.equal(createHash('sha256').update(JSON.stringify(content)).digest('hex'), outputSha256);
  for (const mutate of [
    (value) => {
      value.generatedBodies[0].displayName = 'Other';
    },
    (value) => {
      value.counts.cultural++;
    },
    (value) => {
      value.station.trajectory.orbit.anchorBodyName = 'Old';
    },
    (value) => {
      value.runtimeEnabled = true;
    },
    (value) => {
      value.assignments[0].linguisticStatus = 'certified';
    },
    (value) => {
      value.outputSha256 = '0'.repeat(64);
    },
  ]) {
    const changed = structuredClone(preview);
    mutate(changed);
    assert.throws(() => validateP4Preview(changed), /replay/);
  }
});

test('CLI provides an explicit offline preview and rejects unsupported arguments', () => {
  const script = path.resolve(__dirname, '..', 'scripts', 'non-sol-p4-preview.js');
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /18 cultural names \(11 inherited \/ 7 narrative\)/);
  assert.match(result.stdout, /station host: Hearthward/);
  const bad = spawnSync(process.execPath, [script, '--all'], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Usage/);
});
