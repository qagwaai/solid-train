'use strict';

const { SOL_SYSTEM_CATALOG } = require('../../model/sol-system-catalog');
const { computeAbsolutePositionKm } = require('../../model/solar-system-celestial-seed');

const AU_KM = 149597870.7;
const CRUISE_SPEED_KM_S = 12466.489225;
const LEG_LIMIT_KM = 0.5 * AU_KM;
const MAX_ENCOUNTERS = 5;
const MAX_LEGS = 6;
const MAX_LENGTH_KM = 448793612.1;
const TEST_PROFILE_ID = 'stellar-sol-station-100au-v1';
const TEST_MAX_LENGTH_KM = 14959787070;
const LEGACY_PROFILE_ID = 'navigation-phase3-legacy-v1';
const NAV_MODE_NORMAL = 'ship-drive-normal';
const NAV_MODE_PREVIEW = 'bounded-preview-100au';
const WARNING_BUFFER_KM = 1000;
const MODEL_ID = 'navigation-route-edge-batch-v1';
const CATALOG = new Map(SOL_SYSTEM_CATALOG.map((entry) => [entry.id, entry]));

function directReferenceEligibility(distanceKm, profileId = LEGACY_PROFILE_ID) {
  if (profileId === TEST_PROFILE_ID) {
    return {
      eligible: distanceKm <= TEST_MAX_LENGTH_KM,
      reason: distanceKm <= TEST_MAX_LENGTH_KM
        ? 'WITHIN_PHASE3_BOUNDS'
        : 'DIRECT_REFERENCE_MAY_EXCEED_PATH_LIMIT',
    };
  }

  return {
    eligible: distanceKm <= LEG_LIMIT_KM,
    reason: distanceKm <= LEG_LIMIT_KM
      ? 'WITHIN_PHASE3_BOUNDS'
      : 'DIRECT_REFERENCE_MAY_EXCEED_HOP_LIMIT',
  };
}

function routeEligibility(totalDistanceKm, profileId = LEGACY_PROFILE_ID) {
  if (profileId === TEST_PROFILE_ID) {
    return {
      eligible: totalDistanceKm <= TEST_MAX_LENGTH_KM,
      reason: totalDistanceKm <= TEST_MAX_LENGTH_KM
        ? 'WITHIN_PHASE3_BOUNDS'
        : 'OUTSIDE_TOTAL_PATH_LIMIT',
    };
  }
  return {
    eligible: totalDistanceKm <= MAX_LENGTH_KM,
    reason: totalDistanceKm <= MAX_LENGTH_KM
      ? 'WITHIN_PHASE3_BOUNDS'
      : 'OUTSIDE_HOP_OR_PATH_LIMIT',
  };
}

function driveEligibility(legs, driveProfile, navigationMode) {
  if (navigationMode !== NAV_MODE_NORMAL) {
    return {
      status: 'not-applicable',
      reason: 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE',
      flightAuthorized: false,
    };
  }
  if (!driveProfile) {
    return {
      status: 'unavailable',
      reason: 'DRIVE_PROFILE_UNAVAILABLE',
      flightAuthorized: false,
    };
  }
  const rangeKm = driveProfile.rangeAu * AU_KM;
  const exceedingLegs = legs
    .map((leg, index) => ({ legIndex: index + 1, distanceKm: leg.distanceKm }))
    .filter((leg) => leg.distanceKm > rangeKm);
  if (exceedingLegs.length > 0) {
    return {
      status: 'ineligible',
      reason: 'OUTSIDE_SHIP_LEG_RANGE',
      rangeAu: driveProfile.rangeAu,
      rangeKm,
      exceedingLegs,
      flightAuthorized: false,
    };
  }
  return {
    status: 'eligible',
    reason: 'WITHIN_SHIP_LEG_RANGE',
    rangeAu: driveProfile.rangeAu,
    rangeKm,
    exceedingLegs: [],
    flightAuthorized: false,
  };
}

const CANDIDATE_IDS = [
  'sol-mercury',
  'sol-venus',
  'sol-earth',
  'sol-mars',
  'sol-jupiter',
  'sol-saturn',
  'sol-uranus',
  'sol-neptune',
  'sol-luna',
  'sol-phobos',
];

function finiteVector(value) {
  return value && ['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]));
}

function vectorDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function bodyPosition(bodyId, epochMs) {
  const entry = CATALOG.get(bodyId);
  if (!entry || typeof entry.positionKmAtTimestamp === 'function') return null;
  const positionKm = computeAbsolutePositionKm(entry, epochMs, new Map(), CATALOG);
  return finiteVector(positionKm) ? positionKm : null;
}

function radiusKm(entry) {
  const physical = entry?.physical;
  if (!Number.isFinite(physical?.meanRadiusKm) || physical.meanRadiusKm <= 0) return null;
  return physical.meanRadiusKm;
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function multiply(vector, scalar) {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

function norm(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function unit(vector) {
  const length = norm(vector);
  return length > 0 ? multiply(vector, 1 / length) : null;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function solveMovingTarget({ startEpochMs, startPositionKm, targetPositionAtEpoch }) {
  let epochMs = startEpochMs;
  for (let iteration = 1; iteration <= 64; iteration += 1) {
    const target = targetPositionAtEpoch(epochMs);
    if (!target || !finiteVector(target)) return null;
    const distanceKm = vectorDistance(startPositionKm, target);
    const next = startEpochMs + (1000 * distanceKm) / CRUISE_SPEED_KM_S;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - epochMs) <= 0.1) {
      const roundedEpoch = Math.round(next);
      const finalTarget = targetPositionAtEpoch(roundedEpoch);
      if (!finalTarget || !finiteVector(finalTarget)) return null;
      if (Math.abs(startEpochMs + (1000 * vectorDistance(startPositionKm, finalTarget)) / CRUISE_SPEED_KM_S - roundedEpoch) > 1) {
        return null;
      }
      return {
        epochMs: roundedEpoch,
        positionKm: finalTarget,
        iterations: iteration,
        residualMs: Math.abs(startEpochMs + (1000 * vectorDistance(startPositionKm, finalTarget)) / CRUISE_SPEED_KM_S - roundedEpoch),
      };
    }
    epochMs = next;
  }
  return null;
}

function candidateWaypoint(startPositionKm, bodyId, startEpochMs, side = 1) {
  const entry = CATALOG.get(bodyId);
  const modeledRadius = radiusKm(entry);
  if (!modeledRadius) return null;

  const approachPoint = bodyPosition(bodyId, startEpochMs);
  if (!approachPoint) return null;
  const approachDirection = unit(subtract(approachPoint, startPositionKm));
  if (!approachDirection) return null;
  let tangent = unit(cross(approachDirection, { x: 0, y: 0, z: 1 }));
  if (!tangent) tangent = unit(cross(approachDirection, { x: 0, y: 1, z: 0 }));
  if (!tangent) return null;

  const minimumRadius = modeledRadius + WARNING_BUFFER_KM + 10;
  const offsets = [];
  for (let angle = 0; angle < 360; angle += 45) {
    const radians = (angle * Math.PI) / 180;
    const radial = multiply(tangent, side * Math.cos(radians));
    const normal = multiply(unit(cross(tangent, approachDirection)) || tangent, side * Math.sin(radians));
    offsets.push(add(radial, normal));
  }
  for (const offset of offsets) {
    const length = norm(offset);
    if (length <= 0) continue;
    const point = add(approachPoint, multiply(offset, minimumRadius / length));
    if (norm(subtract(point, approachPoint)) <= modeledRadius + WARNING_BUFFER_KM) continue;
    let overlapsSurveyedBody = false;
    for (const profile of SOL_HAZARD_SURVEY.profiles) {
      if (profile.bodyId === bodyId) continue;
      const otherPosition = bodyPosition(profile.bodyId, startEpochMs);
      if (!otherPosition) continue;
      const otherRadius = profile.surfaceRadiusKm;
      if (otherRadius != null && vectorDistance(point, otherPosition) <= otherRadius + WARNING_BUFFER_KM + 10) {
        overlapsSurveyedBody = true;
        break;
      }
      if (profile.bodyId === 'sol-sun') {
        if (vectorDistance(point, otherPosition) <= 13914000 + WARNING_BUFFER_KM + 10) {
          overlapsSurveyedBody = true;
          break;
        }
      }
    }
    if (!overlapsSurveyedBody) return subtract(point, approachPoint);
  }
  return null;
}

function assessHazards(legs, inventory = SOL_HAZARD_SURVEY) {
  const markers = [];
  const unresolved = [];
  const unresolvedAssessments = [];
  for (let legIndex = 0; legIndex < legs.length; legIndex += 1) {
    const leg = legs[legIndex];
    const index = leg.legIndex ?? legIndex + 1;
    const midpointEpoch = Math.round((leg.departureEpochMs + leg.arrivalEpochMs) / 2);
    const midpointPosition = add(
      leg.startPositionKm,
      multiply(subtract(leg.endPositionKm, leg.startPositionKm), 0.5)
    );
    for (const profile of inventory.profiles) {
      if (profile.assessment === 'unavailable') {
        unresolved.push(profile.bodyId);
        unresolvedAssessments.push({
          bodyId: profile.bodyId,
          legIndex: index,
          epochMs: midpointEpoch,
          positionKm: midpointPosition,
          reason: 'profile_unavailable',
          approximation: 'coarse-spherical-moving-body-envelope-on-straight-leg',
          uncertainty: 'advisory-only-data-or-position-unresolved',
        });
        continue;
      }
      const surface = profile.surfaceRadiusKm;
      const atmosphere = profile.atmosphereOuterRadiusKm;
      const ring = profile.ringOuterEnvelopeKm;
      const boundaries = [
        surface == null ? null : { type: 'surface', km: surface + WARNING_BUFFER_KM },
        atmosphere == null ? null : { type: 'atmosphere', km: atmosphere + WARNING_BUFFER_KM },
        ring == null ? null : { type: 'ring', km: ring + WARNING_BUFFER_KM },
      ].filter(Boolean);
      if (boundaries.length === 0) continue;
      for (const boundary of boundaries) {
        const center = bodyPosition(profile.bodyId, midpointEpoch);
        if (!center) {
          unresolved.push(profile.bodyId);
          unresolvedAssessments.push({
            bodyId: profile.bodyId,
            legIndex: index,
            epochMs: midpointEpoch,
            positionKm: midpointPosition,
            reason: 'body_position_unavailable',
            approximation: 'coarse-spherical-moving-body-envelope-on-straight-leg',
            uncertainty: 'advisory-only-data-or-position-unresolved',
          });
          continue;
        }
        const closest = closestPointOnSegment(center, leg.startPositionKm, leg.endPositionKm);
        const segmentDistance = vectorDistance(center, closest.positionKm);
        if (segmentDistance <= boundary.km) {
          const distanceAlongLegKm = closest.routeFraction * leg.distanceKm;
          const markerEpochMs = Math.round(
            leg.departureEpochMs +
              closest.routeFraction * (leg.arrivalEpochMs - leg.departureEpochMs)
          );
          markers.push({
            bodyId: profile.bodyId,
            hazardType: boundary.type,
            level: 'warning',
            explanation: `The calculated leg comes within the modeled ${boundary.type} warning boundary plus 1000 km.`,
            legIndex: index,
            epochMs: markerEpochMs,
            positionKm: closest.positionKm,
            routeFraction: closest.routeFraction,
            distanceAlongLegKm,
            warningRadiusKm: boundary.km,
            approximation: 'coarse-spherical-moving-body-envelope-on-straight-leg',
            uncertainty: 'advisory-only-not-a-physical-clearance-guarantee',
          });
        }
      }
    }
  }
  return {
    level: unresolved.length > 0 ? 'warning-with-unresolved' : markers.length > 0 ? 'warning' : 'clear-within-survey',
    markers,
    unresolvedBodyIds: [...new Set(unresolved)],
    unresolvedAssessments,
  };
}

function distancePointToSegment(point, start, end) {
  return vectorDistance(point, closestPointOnSegment(point, start, end).positionKm);
}

function closestPointOnSegment(point, start, end) {
  const ab = subtract(end, start);
  const abLengthSquared = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  if (abLengthSquared === 0) {
    return { positionKm: start, routeFraction: 0 };
  }
  const ap = subtract(point, start);
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / abLengthSquared));
  return { positionKm: add(start, multiply(ab, t)), routeFraction: t };
}

function buildProfiles() {
  const inventoryIds = SOL_SYSTEM_CATALOG
    .filter((entry) => ['star', 'planet', 'moon', 'dwarf-planet'].includes(entry.bodyType))
    .map((entry) => entry.id);
  const profiles = inventoryIds.map((bodyId) => {
    const entry = CATALOG.get(bodyId);
    const surface = radiusKm(entry);
    let ringOuter = null;
    let atmosphereOuter = null;
    if (bodyId === 'sol-sun') atmosphereOuter = 13914000;
    else if (entry?.atmosphere?.hasAtmosphere === true) {
      // No catalog altitude is available for planetary atmospheres. Until an
      // explicitly researched exclusion altitude exists, the game survey uses
      // the modeled surface as its conservative exclusion radius.
      atmosphereOuter = surface;
    } else if (entry?.atmosphere?.hasAtmosphere === false) {
      atmosphereOuter = null;
    } else if (surface == null) {
      return { bodyId, surfaceRadiusKm: null, atmosphereOuterRadiusKm: null, ringOuterEnvelopeKm: null, assessment: 'unavailable' };
    }
    if (bodyId === 'sol-saturn') ringOuter = 140180;
    if (bodyId === 'sol-uranus') ringOuter = 98000;
    if (bodyId === 'sol-jupiter') ringOuter = 225000;
    if (bodyId === 'sol-neptune') ringOuter = 63000;
    return {
      bodyId,
      surfaceRadiusKm: surface,
      atmosphereOuterRadiusKm: atmosphereOuter,
      ringOuterEnvelopeKm: ringOuter,
      assessment: 'complete',
    };
  });
  const status = profiles.some((profile) => profile.assessment !== 'complete')
    ? 'incomplete'
    : 'complete';
  return {
    surveyId: 'sol-hazard-survey-v1',
    status,
    approximation: 'coarse-spherical-moving-body-warning-envelope',
    inventoryBodyIds: inventoryIds,
    profiles,
  };
}

const SOL_HAZARD_SURVEY = buildProfiles();

function evaluateLeg(
  startPositionKm,
  startEpochMs,
  targetPositionAtEpoch,
  startId,
  endId,
  profileId = LEGACY_PROFILE_ID,
  navigationMode = null,
  driveProfile = null
) {
  const solved = solveMovingTarget({ startEpochMs, startPositionKm, targetPositionAtEpoch });
  if (!solved) return null;
  const distanceKm = vectorDistance(startPositionKm, solved.positionKm);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  return {
    fromBodyOrShipId: startId,
    toBodyOrMarketId: endId,
    startPositionKm,
    endPositionKm: solved.positionKm,
    departureEpochMs: startEpochMs,
    arrivalEpochMs: solved.epochMs,
    distanceKm,
    durationMs: solved.epochMs - startEpochMs,
    fuelUnits: distanceKm / AU_KM,
    withinHopLimit:
      profileId === TEST_PROFILE_ID ? true : distanceKm <= LEG_LIMIT_KM,
    ...(navigationMode === NAV_MODE_NORMAL && driveProfile
      ? {
          withinShipLegRange: distanceKm <= driveProfile.rangeAu * AU_KM,
          shipLegRangeKm: driveProfile.rangeAu * AU_KM,
        }
      : {}),
  };
}

function evaluateJob(ctx, state, clock, job, profileId = LEGACY_PROFILE_ID, navigationMode = null) {
  const prefix = job.prefixBodyIds || [];
  if (prefix.length > MAX_ENCOUNTERS) return { success: false, reason: 'OUT_OF_DOMAIN', message: 'Too many encounters' };
  if (new Set(prefix).size !== prefix.length) return { success: false, reason: 'OUT_OF_DOMAIN', message: 'Repeated encounter bodies are unsupported' };
  if (prefix.some((id) => !CANDIDATE_IDS.includes(id))) return { success: false, reason: 'OUT_OF_DOMAIN', message: 'Encounter body is outside the approved candidate pool' };
  if (!state || state.status !== 'supported') return { success: false, reason: 'INVALID_CAPTURE', message: 'A supported navigation capture is required' };
  if (
    job.target?.kind === 'body' &&
    (!CANDIDATE_IDS.includes(job.target.id) ||
      prefix.includes(job.target.id) ||
      prefix.length >= MAX_ENCOUNTERS)
  ) {
    return {
      success: false,
      reason: 'OUT_OF_DOMAIN',
      message: 'Body-target encounter would exceed the approved five-encounter bound',
    };
  }

  const epochMs = clock?.read?.().epochMs ?? state.epochMs;
  let startPositionKm = state.departure.positionKm;
  let startEpochMs = epochMs;
  let startId = state.departure.shipId;
  const legs = [];
  const sideHistory = [];
  let eligible = true;
  for (let index = 0; index < prefix.length; index += 1) {
    const bodyId = prefix[index];
    const side = job.prefixSides?.[index] ?? 1;
    const offsetVector = candidateWaypoint(startPositionKm, bodyId, startEpochMs, side);
    if (!offsetVector) {
      return { success: false, reason: 'ENCOUNTER_UNAVAILABLE', message: `No bounded clear encounter offset is available for ${bodyId}` };
    }
    /** @type {any} */
    const leg = evaluateLeg(
      startPositionKm,
      startEpochMs,
      (arrivalEpoch) => solveEncounterPosition(bodyId, arrivalEpoch, offsetVector),
      startId,
      bodyId,
      profileId,
      navigationMode,
      state.driveProfile
    );
    if (!leg) return { success: false, reason: 'NUMERIC_FAILURE', message: 'A moving encounter leg could not converge' };
    leg.legIndex = legs.length + 1;
    leg.encounter = buildEncounter(state, leg, bodyId, side);
    if (!leg.encounter) {
      return { success: false, reason: 'ENCOUNTER_UNAVAILABLE', message: `The timed encounter marker is unavailable for ${bodyId}` };
    }
    legs.push(leg);
    sideHistory.push({ encounterIndex: index + 1, bodyId, side });
    if (profileId === LEGACY_PROFILE_ID && !leg.withinHopLimit) eligible = false;
    startPositionKm = leg.endPositionKm;
    startEpochMs = leg.arrivalEpochMs;
    startId = bodyId;
  }

  /** @type {any} */
  let leg;
  let targetSide = null;
  if (job.target?.kind === 'body') {
    if (!CANDIDATE_IDS.includes(job.target.id)) {
      return { success: false, reason: 'OUT_OF_DOMAIN', message: 'Target body is outside the approved candidate pool' };
    }
    const offsetVector = candidateWaypoint(startPositionKm, job.target.id, startEpochMs, job.targetSide ?? 1);
    if (!offsetVector) {
      return { success: false, reason: 'ENCOUNTER_UNAVAILABLE', message: `No bounded clear encounter offset is available for ${job.target.id}` };
    }
    leg = evaluateLeg(
      startPositionKm,
      startEpochMs,
      (arrivalEpoch) => solveEncounterPosition(job.target.id, arrivalEpoch, offsetVector),
      startId,
      job.target.id,
      profileId,
      navigationMode,
      state.driveProfile
    );
    targetSide = job.targetSide ?? 1;
    sideHistory.push({
      encounterIndex: prefix.length + 1,
      bodyId: job.target.id,
      side: targetSide,
    });
    leg.encounter = buildEncounter(state, leg, job.target.id, targetSide);
    if (!leg.encounter) {
      return { success: false, reason: 'ENCOUNTER_UNAVAILABLE', message: `The timed encounter marker is unavailable for ${job.target.id}` };
    }
  } else {
    const destinationOffset = subtract(state.destination.positionKm, state.destination.hostPositionKm);
    const targetHostId = state.destination.hostBodyId;
    leg = evaluateLeg(
      startPositionKm,
      startEpochMs,
      (arrivalEpoch) =>
        add(
          bodyPosition(targetHostId, arrivalEpoch) || state.destination.hostPositionKm,
          destinationOffset
        ),
      startId,
      state.destination.marketId,
      profileId,
      navigationMode,
      state.driveProfile
    );
  }
  if (!leg) return { success: false, reason: 'NUMERIC_FAILURE', message: 'The destination leg could not converge' };
  leg.legIndex = legs.length + 1;
  legs.push(leg);
  if (profileId === LEGACY_PROFILE_ID && !leg.withinHopLimit) eligible = false;

  if (legs.length > MAX_LEGS) return { success: false, reason: 'OUT_OF_DOMAIN', message: 'Too many legs' };
  const totalDistanceKm = legs.reduce((sum, item) => sum + item.distanceKm, 0);
  const routeEligibilityResult = routeEligibility(totalDistanceKm, profileId);
  if (!routeEligibilityResult.eligible) eligible = false;
  const drive = driveEligibility(legs, state.driveProfile, navigationMode);
  if (navigationMode === NAV_MODE_NORMAL && drive.status !== 'eligible') eligible = false;
  let eligibilityReason = eligible
    ? 'WITHIN_PHASE3_BOUNDS'
    : navigationMode === NAV_MODE_NORMAL && drive.status !== 'eligible'
      ? 'OUTSIDE_SHIP_LEG_RANGE'
      : routeEligibilityResult.reason;
  return {
    success: true,
    jobId: job.jobId,
    prefixBodyIds: prefix,
    prefixSides: prefix.map((_, index) => job.prefixSides?.[index] ?? 1),
    sideHistory,
    target: job.target,
    ...(targetSide === null ? {} : { targetSide }),
    modelId: MODEL_ID,
    eligible,
    eligibilityReason,
    legs,
    totalDistanceKm,
    totalDurationMs: legs.reduce((sum, item) => sum + item.durationMs, 0),
    fuelUnits: totalDistanceKm / AU_KM,
    hazardAssessment: assessHazards(legs),
    navigationMode: navigationMode || 'legacy',
    flightAuthorized: false,
    driveEligibility: drive,
  };
}

function solveEncounterPosition(bodyId, epochMs, offsetVector) {
  const epochPosition = bodyPosition(bodyId, epochMs);
  if (!epochPosition) return null;
  const waypoint = add(epochPosition, offsetVector);
  if (norm(subtract(waypoint, epochPosition)) <= radiusKm(CATALOG.get(bodyId)) + WARNING_BUFFER_KM) return null;
  return waypoint;
}

function buildEncounter(state, leg, bodyId, side) {
  const bodyCenterPositionKm = bodyPosition(bodyId, leg.arrivalEpochMs);
  if (!bodyCenterPositionKm) return null;
  const waypointPositionKm = leg.endPositionKm;
  const offsetKm = subtract(waypointPositionKm, bodyCenterPositionKm);
  const minimumRadiusKm = (radiusKm(CATALOG.get(bodyId)) || 0) + WARNING_BUFFER_KM;
  if (norm(offsetKm) <= minimumRadiusKm) return null;
  return {
    bodyId,
    side,
    encounterEpochMs: leg.arrivalEpochMs,
    bodyCenterPositionKm,
    waypointPositionKm,
    offsetKm,
    coordinateBasisId: state.coordinateBasisId,
    positionEvaluationModelId: state.provenance?.evaluationModelId,
    sourceRevision: state.provenance?.sourceRevision,
  };
}

function evaluateDirectReference(ctx, state, clock, profileId = LEGACY_PROFILE_ID, navigationMode = null) {
  if (!state || state.status !== 'supported') return null;
  const clockRead = clock?.read?.();
  const epochMs = clockRead?.epochMs ?? state.epochMs;
  const targetHostId = state.destination.hostBodyId;
  const destinationOffset = subtract(state.destination.positionKm, state.destination.hostPositionKm);
  const solved = solveMovingTarget({
    startEpochMs: epochMs,
    startPositionKm: state.departure.positionKm,
    targetPositionAtEpoch: (arrivalEpoch) =>
      add(bodyPosition(targetHostId, arrivalEpoch) || state.destination.hostPositionKm, destinationOffset),
  });
  if (!solved) return null;
  const distanceKm = vectorDistance(state.departure.positionKm, solved.positionKm);
  const durationMs = solved.epochMs - epochMs;
  const directLeg = {
    legIndex: 1,
    departureEpochMs: epochMs,
    arrivalEpochMs: solved.epochMs,
    startPositionKm: state.departure.positionKm,
    endPositionKm: solved.positionKm,
    distanceKm,
  };
  const hazardAssessment = assessHazards([directLeg]);
  const eligibility = directReferenceEligibility(distanceKm, profileId);
  const drive = driveEligibility([directLeg], state.driveProfile, navigationMode);
  const directEligible =
    eligibility.eligible &&
    (navigationMode !== NAV_MODE_NORMAL || drive.status === 'eligible');
  const directReason =
    navigationMode === NAV_MODE_NORMAL && drive.status !== 'eligible'
      ? 'OUTSIDE_SHIP_LEG_RANGE'
      : eligibility.reason;
  return {
    status: 'supported',
    kind: 'direct-reference',
    target: { kind: 'market', id: state.destination.marketId },
    departurePositionKm: state.departure.positionKm,
    destinationPositionKm: state.destination.positionKm,
    distanceKm,
    durationMs,
    fuelUnits: distanceKm / AU_KM,
    eligible: directEligible,
    eligibilityReason: directReason,
    hazardAssessment,
    navigationMode: navigationMode || 'legacy',
    flightAuthorized: false,
    driveEligibility: drive,
  };
}

module.exports = {
  AU_KM,
  CRUISE_SPEED_KM_S,
  LEG_LIMIT_KM,
  MAX_ENCOUNTERS,
  MAX_LEGS,
  MAX_LENGTH_KM,
  LEGACY_PROFILE_ID,
  TEST_PROFILE_ID,
  TEST_MAX_LENGTH_KM,
  directReferenceEligibility,
  routeEligibility,
  driveEligibility,
  NAV_MODE_NORMAL,
  NAV_MODE_PREVIEW,
  CANDIDATE_IDS,
  SOL_HAZARD_SURVEY,
  solveMovingTarget,
  candidateWaypoint,
  assessHazards,
  evaluateLeg,
  evaluateJob,
  evaluateDirectReference,
  bodyPosition,
  distancePointToSegment,
  closestPointOnSegment,
  buildEncounter,
};
