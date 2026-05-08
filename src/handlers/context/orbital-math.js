'use strict';

const FALLBACK_ANCHOR_POSITION_KM = {
  'sol-sun': { x: 0, y: 0, z: 0 },
  'sol-mercury': { x: 57_909_227, y: 0, z: 0 },
  'sol-venus': { x: 108_209_475, y: 0, z: 0 },
  'sol-earth': { x: 149_597_870.7, y: 0, z: 0 },
  'sol-moon': { x: 149_982_270.7, y: 0, z: 0 },
  'sol-mars': { x: 227_943_824, y: 0, z: 0 },
  'sol-asteroid-belt': { x: 414_012_000, y: 0, z: 0 },
  'sol-jupiter': { x: 778_340_821, y: 0, z: 0 },
  'sol-saturn': { x: 1_426_666_422, y: 0, z: 0 },
  'sol-uranus': { x: 2_870_658_186, y: 0, z: 0 },
  'sol-neptune': { x: 4_498_396_441, y: 0, z: 0 },
  'sol-pluto': { x: 5_906_376_272, y: 0, z: 0 }
};

const ASTRONOMICAL_UNIT_KM = 149_597_870.7;

function calculateDistanceKm(_ctx, fromPositionKm, toPositionKm) {
  const dx = toPositionKm.x - fromPositionKm.x;
  const dy = toPositionKm.y - fromPositionKm.y;
  const dz = toPositionKm.z - fromPositionKm.z;

  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function calculateDistanceAu(ctx, fromPositionKm, toPositionKm) {
  return calculateDistanceKm(ctx, fromPositionKm, toPositionKm) / ASTRONOMICAL_UNIT_KM;
}

function normalizeAngleRadians(_ctx, value) {
  const twoPi = Math.PI * 2;
  const normalized = value % twoPi;
  return normalized < 0 ? normalized + twoPi : normalized;
}

function solveEccentricAnomaly(_ctx, meanAnomalyRad, eccentricity) {
  let eccentricAnomaly = meanAnomalyRad;

  for (let index = 0; index < 8; index += 1) {
    const delta = (eccentricAnomaly - (eccentricity * Math.sin(eccentricAnomaly)) - meanAnomalyRad)
      / (1 - (eccentricity * Math.cos(eccentricAnomaly)));
    eccentricAnomaly -= delta;

    if (Math.abs(delta) < 1e-8) {
      break;
    }
  }

  return eccentricAnomaly;
}

function rotatePerifocalVector(_ctx, perifocalVector, orbit) {
  const omega = (orbit.argumentOfPeriapsisDeg * Math.PI) / 180;
  const inclination = (orbit.inclinationDeg * Math.PI) / 180;
  const ascendingNode = (orbit.longitudeOfAscendingNodeDeg * Math.PI) / 180;

  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const cosNode = Math.cos(ascendingNode);
  const sinNode = Math.sin(ascendingNode);

  const px = perifocalVector.x;
  const py = perifocalVector.y;
  const pz = perifocalVector.z;

  const x = (
    (cosNode * cosOmega - sinNode * sinOmega * cosI) * px
    + (-cosNode * sinOmega - sinNode * cosOmega * cosI) * py
    + (sinNode * sinI) * pz
  );
  const y = (
    (sinNode * cosOmega + cosNode * sinOmega * cosI) * px
    + (-sinNode * sinOmega + cosNode * cosOmega * cosI) * py
    + (-cosNode * sinI) * pz
  );
  const z = ((sinOmega * sinI) * px) + ((cosOmega * sinI) * py) + (cosI * pz);

  return { x, y, z };
}

function computeRelativeOrbitPositionKm(ctx, orbit, timestamp) {
  const a = Math.max(0, orbit.semiMajorAxisKm);
  const e = Math.max(0, Math.min(0.99, orbit.eccentricity));
  const periodSec = Math.max(1, orbit.orbitalPeriodSec);
  const epochMs = Date.parse(orbit.epoch);
  const timestampMs = Date.parse(timestamp);
  const baselineMs = Number.isNaN(epochMs) ? timestampMs : epochMs;
  const nowMs = Number.isNaN(timestampMs) ? baselineMs : timestampMs;

  const meanMotionRadPerSec = (Math.PI * 2) / periodSec;
  const elapsedSec = (nowMs - baselineMs) / 1000;
  const meanAnomalyAtEpoch = (orbit.meanAnomalyAtEpochDeg * Math.PI) / 180;
  const meanAnomaly = normalizeAngleRadians(ctx, meanAnomalyAtEpoch + (meanMotionRadPerSec * elapsedSec));
  const eccentricAnomaly = solveEccentricAnomaly(ctx, meanAnomaly, e);

  const xPerifocal = a * (Math.cos(eccentricAnomaly) - e);
  const yPerifocal = a * Math.sqrt(1 - (e * e)) * Math.sin(eccentricAnomaly);

  return rotatePerifocalVector(
    ctx,
    { x: xPerifocal, y: yPerifocal, z: 0 },
    orbit
  );
}

async function resolveMarketPositionKmAsync(ctx, market, timestamp) {
  const orbit = ctx.normalizeMarketOrbit(market?.orbit || market?.trajectory?.orbit);
  if (orbit && orbit.anchorBodyId) {
    const relative = computeRelativeOrbitPositionKm(ctx, orbit, timestamp || ctx.getCurrentTimestamp());
    const anchorBody = await ctx.getCelestialBodyByIdAsync(orbit.anchorBodyId);
    const fallbackAnchorPosition = FALLBACK_ANCHOR_POSITION_KM[orbit.anchorBodyId] || { x: 0, y: 0, z: 0 };
    const anchorPosition = ctx.isTriple(anchorBody?.spatial?.positionKm)
      ? anchorBody.spatial.positionKm
      : fallbackAnchorPosition;

    return {
      x: anchorPosition.x + relative.x,
      y: anchorPosition.y + relative.y,
      z: anchorPosition.z + relative.z
    };
  }

  if (ctx.isTriple(market?.spatial?.positionKm)) {
    return market.spatial.positionKm;
  }

  return { x: 0, y: 0, z: 0 };
}

function getShipPositionKm(ctx, ship) {
  if (ctx.isTriple(ship?.spatial?.positionKm)) {
    return ship.spatial.positionKm;
  }

  return null;
}

module.exports = {
  calculateDistanceKm,
  calculateDistanceAu,
  normalizeAngleRadians,
  solveEccentricAnomaly,
  rotatePerifocalVector,
  computeRelativeOrbitPositionKm,
  resolveMarketPositionKmAsync,
  getShipPositionKm
};
