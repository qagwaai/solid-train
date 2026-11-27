'use strict';

const {
  BASIS_ID,
  MODEL_ID,
  PLACEMENT_RULE,
  revision,
  shipRevision,
} = require('../../model/navigation-placement');
const { SOL_SYSTEM_CATALOG } = require('../../model/sol-system-catalog');
const { computeAbsolutePositionKm } = require('../../model/solar-system-celestial-seed');
const { buildSeededMarketsForSolarSystem } = require('../../model/solar-system-market-seed');
const { normalizeStationPlacement } = require('../../model/station-placement');
const { STARTER_RULE, starterPosition } = require('../../model/starter-belt');
const {
  computeRelativeOrbitPositionKm,
  computeRelativeOrbitPositionAtEpochMs,
} = require('./orbital-math');
const {
  PredictionError,
  keplerSpeedBound,
  keplerChainSpeedBound,
  predictNavigation,
} = require('./navigation-prediction-service');

const MIN_EPOCH_MS = Date.parse('2000-01-01T00:00:00.000Z');
const MAX_EPOCH_MS = Date.parse('2100-01-01T00:00:00.000Z');
const POSITION_TOLERANCE_KM = 0.001;
const CATALOG = new Map(SOL_SYSTEM_CATALOG.map((entry) => [entry.id, entry]));
const STATIONS = new Map(
  buildSeededMarketsForSolarSystem('sol')
    .filter((entry) => entry.siteType === 'station')
    .map((entry) => [entry.marketId, entry])
);
const placements = new WeakMap();
const ORBIT_NUMBERS = [
  'semiMajorAxisKm',
  'eccentricity',
  'inclinationDeg',
  'longitudeOfAscendingNodeDeg',
  'argumentOfPeriapsisDeg',
  'meanAnomalyAtEpochDeg',
  'orbitalPeriodSec',
];

class NavigationUnsupportedError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

function reject(reason, message) {
  throw new NavigationUnsupportedError(reason, message);
}

function validEpoch(epochMs) {
  return Number.isSafeInteger(epochMs) && epochMs >= MIN_EPOCH_MS && epochMs < MAX_EPOCH_MS;
}

function vector(value) {
  return value && ['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]));
}

function assertSpatial(spatial) {
  if (!spatial || spatial.solarSystemId !== 'sol' || spatial.frame !== 'barycentric') {
    reject('SYSTEM_MISMATCH', 'A source is not in the supported Sol game-coordinate system');
  }
  if (!validEpoch(spatial.epochMs)) {
    reject(
      'POSITION_EPOCH_UNSUPPORTED',
      'Position epochs must be integer milliseconds in [2000, 2100)'
    );
  }
  if (!vector(spatial.positionKm))
    reject('POSITION_INVALID', 'A position is not a finite km vector');
}

function assertOrbit(orbit, station = false) {
  if (
    !orbit ||
    !ORBIT_NUMBERS.every((key) => Number.isFinite(orbit[key])) ||
    !Number.isFinite(Date.parse(orbit.epoch)) ||
    orbit.semiMajorAxisKm <= 0 ||
    orbit.eccentricity < 0 ||
    orbit.eccentricity > (station ? 0.99 : 0.999) ||
    Math.abs(orbit.orbitalPeriodSec) < 1 ||
    (station && orbit.orbitalPeriodSec < 1)
  ) {
    reject(
      'EVALUATION_UNSUPPORTED',
      'The source lacks supported finite elliptical orbital elements'
    );
  }
}

function samePosition(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z) <= POSITION_TOLERANCE_KM;
}

function add(left, right) {
  const result = { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
  if (!vector(result)) reject('POSITION_INVALID', 'Evaluated position is not finite');
  return result;
}

function registry(ctx) {
  let entries = placements.get(ctx);
  if (!entries) {
    entries = new Map();
    placements.set(ctx, entries);
  }
  return entries;
}

function placementKey(playerName, shipId) {
  return JSON.stringify([playerName.toLowerCase(), shipId]);
}

function revokeNavigationPlacements(ctx, playerName, shipIds) {
  const entries = placements.get(ctx);
  if (entries) {
    for (const shipId of shipIds) entries.set(placementKey(playerName, shipId), {});
  }
}

async function capture(ctx, playerName) {
  const db = ctx.databaseService;
  const [characters, bodies, markets] = db
    ? await Promise.all([
        db.getCharacters(playerName),
        db.getCelestialBodies({ solarSystemId: 'sol' }),
        db.getMarkets({ solarSystemId: 'sol' }),
      ])
    : [
        ctx.charactersByPlayer.get(ctx.normalizePlayerName(playerName)) || [],
        [...ctx.celestialBodiesById.values()].filter(
          (body) => body.spatial?.solarSystemId === 'sol'
        ),
        [...ctx.marketsByKey.values()].filter((market) => market.solarSystemId === 'sol'),
      ];
  if (![characters, bodies, markets].every(Array.isArray)) {
    throw new Error('Navigation source reads did not return arrays');
  }
  return structuredClone({ characters, bodies, markets });
}

function ownedShip(ctx, snapshot, playerName, shipId) {
  const player = ctx.getPlayer(playerName);
  const matches = snapshot.characters.flatMap((character) =>
    (character.ships || [])
      .filter((ship) => ship.id === shipId)
      .map((ship) => ({ ship, characterId: character.id }))
  );
  if (matches.length !== 1)
    reject('SHIP_NOT_OWNED', 'The departure ship is not uniquely owned by this player');
  const { ship, characterId } = matches[0];
  if (
    ship.ownership?.ownerType !== 'player-character' ||
    ship.ownership.playerId !== player.playerId ||
    ship.ownership.characterId !== characterId
  ) {
    reject('SHIP_NOT_OWNED', 'The departure ship lacks matching player-character ownership');
  }
  return ship;
}

function evaluator(ctx, snapshot, targetEpochMs) {
  const bodies = new Map();
  for (const body of snapshot.bodies) {
    if (bodies.has(body.id)) reject('SOURCE_UNVERIFIED', 'Duplicate celestial source identities');
    bodies.set(body.id, body);
  }
  const validated = new Set();
  const dependencies = new Map();
  const positionCache = new Map();
  function verify(id, visiting = new Set()) {
    if (validated.has(id)) return;
    if (visiting.has(id)) reject('SOURCE_UNVERIFIED', 'A celestial parent cycle is unsupported');
    const entry = CATALOG.get(id);
    const body = bodies.get(id);
    if (
      !entry ||
      !body ||
      typeof entry.positionKmAtTimestamp === 'function' ||
      !['star', 'planet', 'moon', 'dwarf-planet', 'tno'].includes(entry.bodyType)
    ) {
      reject(
        'EVALUATION_UNSUPPORTED',
        `Celestial source '${id}' is unavailable or outside the elliptical Sol model`
      );
    }
    assertSpatial(body.spatial);
    if (
      body.bodyType !== entry.bodyType ||
      body.parentBodyId !== entry.parentBodyId ||
      body.catalogId !== id ||
      body.isCatalogBody !== true ||
      body.sourceScanId !== 'catalog' ||
      body.createdByCharacterId !== 'system-catalog' ||
      body.state !== 'active'
    ) {
      reject(
        'SOURCE_UNVERIFIED',
        `Celestial source '${id}' is not a supported active catalog record`
      );
    }
    if (entry.orbit) {
      assertOrbit(body.orbitalElements);
      const expectedAnchor =
        CATALOG.get(entry.parentBodyId)?.bodyType === 'star' ? null : entry.parentBodyId;
      if (
        [...ORBIT_NUMBERS, 'epoch'].some((key) => body.orbitalElements[key] !== entry.orbit[key]) ||
        (body.orbitalElements.anchorBodyId || null) !== expectedAnchor
      ) {
        reject(
          'SOURCE_UNVERIFIED',
          `Celestial source '${id}' does not match the bundled coordinate model`
        );
      }
    } else if (id !== 'sol-sun' || body.orbitalElements != null) {
      reject('EVALUATION_UNSUPPORTED', `Celestial source '${id}' has no supported orbital model`);
    }
    visiting.add(id);
    if (entry.parentBodyId) verify(entry.parentBodyId, visiting);
    visiting.delete(id);
    const expected = computeAbsolutePositionKm(entry, body.spatial.epochMs, new Map(), CATALOG);
    if (!vector(expected) || !samePosition(expected, body.spatial.positionKm)) {
      reject(
        'SOURCE_UNVERIFIED',
        `Celestial source '${id}' does not match its stored position epoch`
      );
    }
    dependencies.set(id, body);
    validated.add(id);
  }
  function bodyPosition(id) {
    verify(id);
    const positionKm = computeAbsolutePositionKm(
      CATALOG.get(id),
      targetEpochMs,
      positionCache,
      CATALOG
    );
    if (!vector(positionKm)) reject('POSITION_INVALID', 'Evaluated body position is not finite');
    return { bodyId: id, positionKm, sourceEpochMs: bodies.get(id).spatial.epochMs };
  }
  function stationPosition(marketId) {
    const matches = snapshot.markets.filter((market) => market.marketId === marketId);
    if (matches.length !== 1)
      reject('STATION_HOST_UNVERIFIED', 'The destination station is unavailable or ambiguous');
    const market = matches[0];
    const seed = STATIONS.get(marketId);
    if (
      !seed ||
      market.siteType !== 'station' ||
      market.solarSystemId !== 'sol' ||
      market.trajectory?.kind !== 'orbital-elements'
    ) {
      reject(
        'STATION_PLACEMENT_UNSUPPORTED',
        'Only bundled Sol orbital station trajectories are supported'
      );
    }
    const orbit = market.trajectory.orbit;
    assertOrbit(orbit, true);
    if (
      ['anchorBodyId', 'orbitType', ...ORBIT_NUMBERS, 'epoch'].some(
        (key) => orbit[key] !== seed.trajectory.orbit[key]
      )
    ) {
      reject(
        'STATION_HOST_UNVERIFIED',
        'The station trajectory does not match its exact bundled anchor/model'
      );
    }
    let placement;
    try {
      placement = normalizeStationPlacement(market.stationPlacement, market.trajectory);
    } catch (error) {
      if (!['MARKET_PLACEMENT_INVALID', 'MARKET_PLACEMENT_UNSUPPORTED'].includes(error.code))
        throw error;
      reject('STATION_PLACEMENT_UNSUPPORTED', error.message);
    }
    if (
      placement &&
      (placement.activation !== 'active' ||
        !['body-orbit', 'stellar-orbit'].includes(placement.kind) ||
        placement.primaryBodyId !== orbit.anchorBodyId ||
        (placement.kind === 'stellar-orbit' &&
          CATALOG.get(orbit.anchorBodyId)?.bodyType !== 'star'))
    ) {
      reject(
        'STATION_PLACEMENT_UNSUPPORTED',
        'The station placement has no supported active exact-host evaluator'
      );
    }
    const host = bodyPosition(orbit.anchorBodyId);
    dependencies.set(`station:${marketId}`, market);
    return {
      marketId,
      hostBodyId: host.bodyId,
      positionKm: add(
        host.positionKm,
        computeRelativeOrbitPositionKm(ctx, orbit, new Date(targetEpochMs).toISOString())
      ),
      hostPositionKm: host.positionKm,
      hostSourceEpochMs: host.sourceEpochMs,
      orbitalReferenceEpoch: orbit.epoch,
      placementKind: placement?.kind || null,
      association: 'verified-exact-anchor',
    };
  }
  function stationTarget(state) {
    const allowedIds = new Set(dependencies.keys());
    function requireDependency(id) {
      if (!allowedIds.has(id) || !dependencies.has(id)) {
        throw new PredictionError(
          'failed',
          'PREDICTION_SOURCE_MISMATCH',
          'Prediction may use only the verified departure-epoch dependencies'
        );
      }
      return dependencies.get(id);
    }
    function catalogBody(id) {
      requireDependency(id);
      return CATALOG.get(id);
    }
    const marketId = state.destination.marketId;
    const orbit = requireDependency(`station:${marketId}`).trajectory.orbit;
    const destinationBound =
      keplerChainSpeedBound(orbit.anchorBodyId, catalogBody) + keplerSpeedBound(orbit, true);
    function bodyAt(id, epochMs, cache) {
      requireDependency(id);
      return computeAbsolutePositionKm(CATALOG.get(id), epochMs, cache, CATALOG);
    }
    return {
      speedBoundKmPerSec: destinationBound,
      atEpoch: (epochMs) => {
        const hostPositionKm = bodyAt(orbit.anchorBodyId, epochMs, new Map());
        const offset = computeRelativeOrbitPositionAtEpochMs(ctx, orbit, epochMs);
        return {
          marketId,
          hostBodyId: orbit.anchorBodyId,
          hostPositionKm,
          positionKm: {
            x: hostPositionKm.x + offset.x,
            y: hostPositionKm.y + offset.y,
            z: hostPositionKm.z + offset.z,
          },
        };
      },
    };
  }
  function predictionTargets(state) {
    const candidateId = state.candidates[0].bodyId;
    const allowedIds = new Set(dependencies.keys());
    function catalogBody(id) {
      if (!allowedIds.has(id) || !dependencies.has(id)) {
        throw new PredictionError(
          'failed',
          'PREDICTION_SOURCE_MISMATCH',
          'Prediction dependencies changed'
        );
      }
      return CATALOG.get(id);
    }
    return {
      candidate: {
        speedBoundKmPerSec: keplerChainSpeedBound(candidateId, catalogBody),
        atEpoch: (epochMs) => ({
          bodyId: candidateId,
          positionKm: computeAbsolutePositionKm(
            catalogBody(candidateId),
            epochMs,
            new Map(),
            CATALOG
          ),
        }),
      },
      destination: stationTarget(state),
      assertSources: () => {
        if (dependencyRevision(dependencies) !== state.provenance.sourceRevision) {
          throw new PredictionError(
            'failed',
            'PREDICTION_SOURCE_MISMATCH',
            'Prediction dependencies changed during evaluation'
          );
        }
      },
    };
  }
  return { bodyPosition, stationPosition, dependencies, predictionTargets, stationTarget };
}

function dependencyRevision(dependencies) {
  return revision([...dependencies.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function modelRevision(dependencies) {
  return revision(
    [...dependencies.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, source]) => [
        id,
        id.startsWith('station:')
          ? {
              solarSystemId: source.solarSystemId,
              siteType: source.siteType,
              trajectory: source.trajectory,
              stationPlacement: source.stationPlacement || null,
            }
          : {
              id: source.id,
              parentBodyId: source.parentBodyId,
              bodyType: source.bodyType,
              orbitalElements: source.orbitalElements || null,
              catalogId: source.catalogId,
              sourceScanId: source.sourceScanId,
              createdByCharacterId: source.createdByCharacterId,
              isCatalogBody: source.isCatalogBody,
            },
      ])
  );
}

function invalidStation(marketId) {
  const station = STATIONS.get(marketId);
  const orbit = station?.trajectory.orbit;
  const radiusKm = CATALOG.get(orbit?.anchorBodyId)?.physical?.meanRadiusKm;
  return Number.isFinite(radiusKm) && orbit.semiMajorAxisKm * (1 - orbit.eccentricity) <= radiusKm;
}

function previewEligibility(sourceMarketId, destinationMarketId) {
  if (invalidStation(destinationMarketId)) {
    return { status: 'ineligible', reason: 'KNOWN_INVALID_DESTINATION' };
  }
  if (invalidStation(sourceMarketId)) {
    return { status: 'ineligible', reason: 'KNOWN_INVALID_SOURCE' };
  }
  return { status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED' };
}

async function preparePurchasedNavigationPlacementAsync(
  ctx,
  playerName,
  marketId,
  solarSystemId,
  epochMs
) {
  try {
    if (solarSystemId !== 'sol')
      reject('SYSTEM_UNSUPPORTED', 'Purchase placement evaluation supports Sol only');
    if (!validEpoch(epochMs))
      reject('POSITION_EPOCH_UNSUPPORTED', 'Purchase placement epoch is unsupported');
    const snapshot = await capture(ctx, playerName);
    const evaluation = evaluator(ctx, snapshot, epochMs);
    const source = evaluation.stationPosition(marketId);
    if (invalidStation(marketId))
      reject(
        'KNOWN_INVALID_SOURCE',
        'The station orbit intersects its catalog mean-radius profile'
      );
    if (revision(snapshot) !== revision(await capture(ctx, playerName))) {
      reject('SOURCES_CHANGED', 'Purchase placement inputs changed during evaluation');
    }
    return {
      status: 'supported',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        epochMs,
        positionKm: source.positionKm,
      },
      sourceMarketId: marketId,
      sourceHostBodyId: source.hostBodyId,
      sourceModelRevision: modelRevision(evaluation.dependencies),
    };
  } catch (error) {
    if (!(error instanceof NavigationUnsupportedError)) {
      ctx.log(`[navigation-placement] Purchase placement evaluation failed: ${error.message}`);
      throw error;
    }
    return { status: 'unsupported', reason: error.reason, message: error.message };
  }
}

async function commitPurchasedNavigationPlacementAsync(
  ctx,
  playerName,
  characterId,
  ship,
  transactionId,
  prepared
) {
  const attestation = {
    version: 1,
    status: 'committed',
    lineageId: ctx.createId(),
    shipId: ship.id,
    coordinateBasisId: BASIS_ID,
    evaluationModelId: MODEL_ID,
    placementRule: PLACEMENT_RULE,
    transactionId,
    sourceMarketId: prepared.sourceMarketId,
    sourceHostBodyId: prepared.sourceHostBodyId,
    sourceModelRevision: prepared.sourceModelRevision,
    shipRevision: shipRevision(ship),
    epochMs: ship.spatial.epochMs,
    issuedAt: ctx.getCurrentTimestamp(),
  };
  const snapshot = await capture(ctx, playerName);
  const stored = ownedShip(ctx, snapshot, playerName, ship.id);
  if (shipRevision(stored) !== attestation.shipRevision || stored.navigationPlacement) {
    reject('BASIS_UNKNOWN', 'Purchased ship changed before placement completion');
  }
  const evaluation = evaluator(ctx, snapshot, ship.spatial.epochMs);
  const source = evaluation.stationPosition(prepared.sourceMarketId);
  if (
    modelRevision(evaluation.dependencies) !== prepared.sourceModelRevision ||
    !samePosition(stored.spatial.positionKm, source.positionKm)
  ) {
    reject('SOURCE_UNVERIFIED', 'Purchase placement sources changed before completion');
  }
  if (ctx.databaseService) {
    const result = await ctx.databaseService.commitNavigationPlacement(
      playerName,
      characterId,
      stored,
      attestation
    );
    if (!result)
      reject('BASIS_UNKNOWN', 'Purchase placement completion conflicted with persisted state');
    ctx.cacheCharacters(playerName, result.characters);
  } else {
    const character = ctx.findCharacter(playerName, characterId);
    const current = character?.ships.find((entry) => entry.id === ship.id);
    if (!current || shipRevision(current) !== attestation.shipRevision) {
      reject('BASIS_UNKNOWN', 'Purchased ship changed before placement completion');
    }
    current.navigationPlacement = structuredClone(attestation);
  }
  return { status: 'supported', lineageId: attestation.lineageId };
}

function validateSelectors(navigation) {
  if (
    !navigation ||
    typeof navigation !== 'object' ||
    Array.isArray(navigation) ||
    Object.keys(navigation).some(
      (key) => !['shipId', 'destinationMarketId', 'candidateBodyId'].includes(key)
    ) ||
    !['shipId', 'destinationMarketId'].every(
      (key) => typeof navigation[key] === 'string' && navigation[key].trim()
    ) ||
    (navigation.candidateBodyId !== undefined &&
      (typeof navigation.candidateBodyId !== 'string' || !navigation.candidateBodyId.trim()))
  ) {
    reject(
      'NAVIGATION_REQUEST_INVALID',
      'navigation requires shipId, destinationMarketId, and at most one optional candidateBodyId'
    );
  }
}

// Trusted server placement operations may call this; no socket request can issue a proof.
async function registerTrustedNavigationPlacementAsync(ctx, request) {
  validateSelectors({ shipId: request.shipId, destinationMarketId: request.sourceMarketId });
  if (!vector(request.offsetKm))
    reject('POSITION_INVALID', 'A trusted placement requires an explicit finite offset');
  const entries = registry(ctx);
  const key = placementKey(request.playerName, request.shipId);
  const previous = entries.get(key);
  const snapshot = await capture(ctx, request.playerName);
  const ship = ownedShip(ctx, snapshot, request.playerName, request.shipId);
  assertSpatial(ship.spatial);
  const evaluation = evaluator(ctx, snapshot, ship.spatial.epochMs);
  const source = evaluation.stationPosition(request.sourceMarketId);
  if (!samePosition(ship.spatial.positionKm, add(source.positionKm, request.offsetKm))) {
    reject(
      'SOURCE_UNVERIFIED',
      'The ship position does not match the trusted source placement at its epoch'
    );
  }
  const after = await capture(ctx, request.playerName);
  if (revision(snapshot) !== revision(after))
    reject('SOURCES_CHANGED', 'Placement sources changed during certification');
  if (entries.get(key) !== previous)
    reject('BASIS_UNKNOWN', 'Placement lineage changed during certification');
  entries.set(key, {
    proof: {
      shipRevision: shipRevision(ship),
      sourceMarketId: request.sourceMarketId,
      offsetKm: structuredClone(request.offsetKm),
      sourceRevision: dependencyRevision(evaluation.dependencies),
    },
  });
  return { coordinateBasisId: BASIS_ID, epochMs: ship.spatial.epochMs };
}

async function getNavigationStateAsync(ctx, playerName, solarSystemId, navigation, options = {}) {
  let snapshot;
  try {
    validateSelectors(navigation);
    if (solarSystemId !== 'sol')
      reject('SYSTEM_UNSUPPORTED', 'Navigation evaluation currently supports Sol only');
    snapshot = await capture(ctx, playerName);
    const ship = ownedShip(ctx, snapshot, playerName, navigation.shipId);
    const durable = ship.navigationPlacement;
    const starter = durable?.placementRule === STARTER_RULE;
    const proof = durable || placements.get(ctx)?.get(placementKey(playerName, ship.id))?.proof;
    if (!proof) reject('BASIS_UNKNOWN', 'The owned ship has no trusted server placement lineage');
    if (
      durable &&
      (durable.version !== 1 ||
        durable.status !== 'committed' ||
        durable.shipId !== ship.id ||
        durable.coordinateBasisId !== BASIS_ID ||
        durable.evaluationModelId !== MODEL_ID ||
        (!starter && durable.placementRule !== PLACEMENT_RULE) ||
        durable.epochMs !== ship.spatial.epochMs ||
        !durable.lineageId ||
        (!starter && !durable.transactionId))
    ) {
      reject('BASIS_UNKNOWN', 'The stored placement attestation is unsupported or invalid');
    }
    assertSpatial(ship.spatial);
    if (proof.shipRevision !== shipRevision(ship)) {
      revokeNavigationPlacements(ctx, playerName, [ship.id]);
      reject('BASIS_UNKNOWN', 'The ship changed since its trusted placement was recorded');
    }
    const evaluation = evaluator(ctx, snapshot, ship.spatial.epochMs);
    const source = starter
      ? { positionKm: starterPosition(ship.ownership.characterId) }
      : evaluation.stationPosition(proof.sourceMarketId);
    const offsetKm = durable ? { x: 0, y: 0, z: 0 } : proof.offsetKm;
    if (
      (!starter &&
        (durable
          ? modelRevision(evaluation.dependencies) !== durable.sourceModelRevision ||
            source.hostBodyId !== durable.sourceHostBodyId
          : dependencyRevision(evaluation.dependencies) !== proof.sourceRevision)) ||
      !samePosition(ship.spatial.positionKm, add(source.positionKm, offsetKm))
    ) {
      reject(
        'SOURCE_UNVERIFIED',
        'The trusted placement sources no longer match the recorded lineage'
      );
    }
    const destination = evaluation.stationPosition(navigation.destinationMarketId);
    const candidates = navigation.candidateBodyId
      ? [evaluation.bodyPosition(navigation.candidateBodyId)]
      : [];
    if (options.routeCandidateBodyIds) {
      for (const id of options.routeCandidateBodyIds) evaluation.bodyPosition(id);
    }
    if (
      candidates.some((body) => !['planet', 'moon'].includes(CATALOG.get(body.bodyId)?.bodyType))
    ) {
      reject('EVALUATION_UNSUPPORTED', 'A navigation candidate must be a supported planet or moon');
    }
    const navigationState = {
      status: 'supported',
      solarSystemId: 'sol',
      coordinateBasisId: BASIS_ID,
      epochMs: ship.spatial.epochMs,
      driveProfile: ship.driveProfile ? structuredClone(ship.driveProfile) : null,
      driveProfileRevision: ship.driveProfile ? revision(ship.driveProfile) : null,
      departure: {
        shipId: ship.id,
        positionKm: ship.spatial.positionKm,
        provenance: {
          kind: durable ? 'trusted-persisted-placement' : 'trusted-runtime-placement',
          ...(durable ? { lineageId: durable.lineageId } : {}),
          ...(starter ? { sourceKind: 'starter-belt' } : { sourceMarketId: proof.sourceMarketId }),
          offsetKm,
          shipRevision: proof.shipRevision,
        },
      },
      destination,
      candidates,
      provenance: {
        evaluationModelId: MODEL_ID,
        sourceRevision: dependencyRevision(evaluation.dependencies),
        positionToleranceKm: POSITION_TOLERANCE_KM,
      },
      previewEligibility: previewEligibility(proof.sourceMarketId, navigation.destinationMarketId),
      motion: { status: 'unsupported' },
      clearance: { status: 'unsupported' },
      gravityAssist: { status: 'unsupported' },
    };
    const predictionResult = options.prediction
      ? predictNavigation(ctx, navigationState, options.prediction, () =>
          evaluation.predictionTargets(navigationState)
        )
      : undefined;
    const after = await capture(ctx, playerName);
    if (revision(snapshot) !== revision(after))
      reject('SOURCES_CHANGED', 'Navigation inputs changed during evaluation');
    if (!durable && placements.get(ctx)?.get(placementKey(playerName, ship.id))?.proof !== proof) {
      reject('BASIS_UNKNOWN', 'Placement lineage changed during evaluation');
    }
    return {
      bodies: snapshot.bodies,
      navigationState,
      ...(options.routeCandidateBodyIds
        ? { routeTarget: evaluation.stationTarget(navigationState) }
        : {}),
      ...(predictionResult ? { predictionResult } : {}),
    };
  } catch (error) {
    if (!(error instanceof NavigationUnsupportedError)) {
      ctx.log(`[navigation-state] Read/evaluation failed: ${error.message}`);
      throw error;
    }
    return {
      bodies: snapshot?.bodies || [],
      navigationState: { status: 'unsupported', reason: error.reason, message: error.message },
    };
  }
}

module.exports = {
  BASIS_ID,
  MODEL_ID,
  MIN_EPOCH_MS,
  MAX_EPOCH_MS,
  POSITION_TOLERANCE_KM,
  getNavigationStateAsync,
  registerTrustedNavigationPlacementAsync,
  revokeNavigationPlacements,
  preparePurchasedNavigationPlacementAsync,
  commitPurchasedNavigationPlacementAsync,
};
