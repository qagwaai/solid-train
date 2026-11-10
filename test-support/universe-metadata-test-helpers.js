'use strict';

const { createCelestialBody } = require('./message-handler-test-helpers');

function universeBody(overrides = {}) {
  const body = {
    ...createCelestialBody({
      id: 'exo-test-generated-asteroid-01',
      catalogId: 'exo-test-generated-asteroid-01',
      bodyType: 'asteroid',
      surfaceArchetype: 'asteroid',
      isCatalogBody: true,
      displayName: 'Test I',
      ...overrides,
    }),
    universeMetadata: undefined,
  };
  body.spatial.solarSystemId = 'alpha-centauri';
  body.isCatalogBody = true;
  body.displayName = overrides.displayName ?? 'Test I';
  body.universeMetadata = {
    schemaVersion: 'non-sol-universe-v1',
    provenance: {
      origin: 'hypothetical',
      sourceReferences: [],
      fieldSources: [
        {
          field: 'physicalCatalog.massKg',
          derivation: 'seeded',
          reference: null,
          uncertainty: null,
        },
      ],
      rationale: 'Deterministic plausible outer-system representative.',
    },
    generation: {
      generatorVersion: 'test-v1',
      seedKey: 'alpha:outer-asteroid:01',
      sourceSha256: 'a'.repeat(64),
    },
    naming: {
      preferredName: body.displayName,
      aliases: [],
      lane: 'systematic',
      language: null,
      motivation: null,
      policyVersion: 'test-naming-v1',
    },
    lifecycle: { status: 'active', retiredAt: null, reason: null },
    resourceProfile: {
      materialItemTypes: ['iron'],
      abundance: 'sparse',
      accessibility: 'accessible',
      policyVersion: 'test-v1',
    },
    ...overrides.universeMetadata,
  };
  return body;
}

module.exports = { universeBody };
