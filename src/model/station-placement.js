'use strict';

const STATION_PLACEMENT_KINDS = Object.freeze([
  'body-orbit',
  'stellar-orbit',
  'lagrange-region',
  'deep-space',
]);
const STATION_PLACEMENT_ACTIVATIONS = Object.freeze(['metadata-only', 'active']);
const LAGRANGE_REGIONS = Object.freeze(['L1', 'L2', 'L3', 'L4', 'L5']);
const SUPPORTED_TRAJECTORY_PLACEMENTS = new Set(['body-orbit', 'stellar-orbit']);

function placementError(message, code = 'MARKET_PLACEMENT_INVALID') {
  return Object.assign(new Error(message), { code });
}

function normalizeStationPlacement(value, trajectory) {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw placementError('Market stationPlacement must be an object');
  }

  const kind = typeof value.kind === 'string' ? value.kind.trim() : '';
  if (!STATION_PLACEMENT_KINDS.includes(kind)) {
    throw placementError(`Market stationPlacement kind '${kind || '(missing)'}' is invalid`);
  }

  if (typeof value.stationKeeping !== 'boolean') {
    throw placementError('Market stationPlacement.stationKeeping must be an explicit boolean');
  }
  const activation = typeof value.activation === 'string' ? value.activation.trim() : '';
  if (!STATION_PLACEMENT_ACTIVATIONS.includes(activation)) {
    throw placementError('Market stationPlacement.activation must be metadata-only or active');
  }

  const primaryBodyId = typeof value.primaryBodyId === 'string' ? value.primaryBodyId.trim() : '';
  const secondaryBodyId =
    typeof value.secondaryBodyId === 'string' ? value.secondaryBodyId.trim() : '';
  const region = typeof value.region === 'string' ? value.region.trim() : '';
  const provenance = typeof value.provenance === 'string' ? value.provenance.trim() : '';
  const reason = typeof value.reason === 'string' ? value.reason.trim() : '';

  if (['body-orbit', 'stellar-orbit'].includes(kind) && !primaryBodyId) {
    throw placementError(`Market stationPlacement ${kind} requires primaryBodyId`);
  }
  if (kind === 'lagrange-region' && (!primaryBodyId || !secondaryBodyId)) {
    throw placementError('Market stationPlacement lagrange-region requires both primary body IDs');
  }
  if (kind === 'lagrange-region' && primaryBodyId === secondaryBodyId) {
    throw placementError(
      'Market stationPlacement Lagrange primary and secondary body IDs must differ'
    );
  }
  if (kind === 'lagrange-region' && !LAGRANGE_REGIONS.includes(region)) {
    throw placementError('Market stationPlacement lagrange-region requires region L1-L5');
  }
  if (kind !== 'lagrange-region' && region) {
    throw placementError('Market stationPlacement.region is only valid for lagrange-region');
  }
  if (!provenance || !reason) {
    throw placementError('Market stationPlacement requires non-empty provenance and reason');
  }

  if (!SUPPORTED_TRAJECTORY_PLACEMENTS.has(kind) && trajectory?.kind === 'orbital-elements') {
    throw placementError(
      `Market stationPlacement '${kind}' cannot be represented by orbital-elements`,
      'MARKET_PLACEMENT_UNSUPPORTED'
    );
  }

  if (activation === 'active') {
    if (!SUPPORTED_TRAJECTORY_PLACEMENTS.has(kind)) {
      throw placementError(
        `Active station placement '${kind}' is unsupported; no matching trajectory evaluator exists`,
        'MARKET_PLACEMENT_UNSUPPORTED'
      );
    }
    if (
      trajectory?.kind !== 'orbital-elements' ||
      !trajectory?.orbit ||
      trajectory.orbit.anchorBodyId !== primaryBodyId
    ) {
      throw placementError(
        `Active station placement '${kind}' requires orbital-elements anchored to primaryBodyId`,
        'MARKET_PLACEMENT_UNSUPPORTED'
      );
    }
  }

  return {
    kind,
    ...(primaryBodyId ? { primaryBodyId } : {}),
    ...(secondaryBodyId ? { secondaryBodyId } : {}),
    ...(region ? { region } : {}),
    activation,
    stationKeeping: value.stationKeeping,
    provenance,
    reason,
  };
}

module.exports = {
  STATION_PLACEMENT_KINDS,
  STATION_PLACEMENT_ACTIVATIONS,
  LAGRANGE_REGIONS,
  normalizeStationPlacement,
};
