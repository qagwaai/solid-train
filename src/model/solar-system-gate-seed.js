'use strict';

/**
 * Canonical seeded jump gate network for in-memory (no-database) server startup.
 * Gates are directional: sol→alpha-centauri and alpha-centauri→sol are separate entries.
 *
 * Connected topology:
 *   sol ↔ alpha-centauri ↔ barnards-star
 */
function buildSeededGateNetwork() {
  return [
    {
      gateId: 'sol-ac-g1',
      sourceSystemId: 'sol',
      destSystemId: 'alpha-centauri',
      traversalCostAu: 5,
      traversalTimeHours: 48,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 900, y: 220, z: -40 },
        epochMs: 1713360000000,
      },
    },
    {
      gateId: 'ac-sol-g1',
      sourceSystemId: 'alpha-centauri',
      destSystemId: 'sol',
      traversalCostAu: 5,
      traversalTimeHours: 48,
      spatial: {
        solarSystemId: 'alpha-centauri',
        frame: 'barycentric',
        positionKm: { x: 860, y: -180, z: 55 },
        epochMs: 1713360000000,
      },
    },
    {
      gateId: 'ac-bs-g1',
      sourceSystemId: 'alpha-centauri',
      destSystemId: 'barnards-star',
      traversalCostAu: 7,
      traversalTimeHours: 72,
      spatial: {
        solarSystemId: 'alpha-centauri',
        frame: 'barycentric',
        positionKm: { x: -1040, y: 260, z: 90 },
        epochMs: 1713360000000,
      },
    },
    {
      gateId: 'bs-ac-g1',
      sourceSystemId: 'barnards-star',
      destSystemId: 'alpha-centauri',
      traversalCostAu: 7,
      traversalTimeHours: 72,
      spatial: {
        solarSystemId: 'barnards-star',
        frame: 'barycentric',
        positionKm: { x: -980, y: -210, z: -30 },
        epochMs: 1713360000000,
      },
    },
  ];
}

module.exports = { buildSeededGateNetwork };
