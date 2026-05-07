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
      traversalTimeHours: 48
    },
    {
      gateId: 'ac-sol-g1',
      sourceSystemId: 'alpha-centauri',
      destSystemId: 'sol',
      traversalCostAu: 5,
      traversalTimeHours: 48
    },
    {
      gateId: 'ac-bs-g1',
      sourceSystemId: 'alpha-centauri',
      destSystemId: 'barnards-star',
      traversalCostAu: 7,
      traversalTimeHours: 72
    },
    {
      gateId: 'bs-ac-g1',
      sourceSystemId: 'barnards-star',
      destSystemId: 'alpha-centauri',
      traversalCostAu: 7,
      traversalTimeHours: 72
    }
  ];
}

module.exports = { buildSeededGateNetwork };
