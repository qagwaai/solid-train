'use strict';

/**
 * Canonical spatial model types and interfaces for in-world entities.
 * This module defines the hard-cut spatial architecture:
 * - Every in-world entity has required `spatial` field
 * - Motion is optional and stored separately
 * - No fallback readers for legacy fields
 * - Frame is always 'barycentric'
 */

/**
 * @typedef {Object} Triple
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} SpatialState
 * Required on all in-world entities (Ships, CelestialBodies, Markets)
 * Provides authoritative position, reference frame, and coordinate system epoch.
 * @property {string} solarSystemId - Solar system identifier
 * @property {'barycentric'} frame - Hardcoded to barycentric frame
 * @property {Triple} positionKm - Position in kilometers
 * @property {number} epochMs - Epoch timestamp in milliseconds (when position is valid)
 */

/**
 * @typedef {Object} MotionState
 * Optional on in-world entities. Only present if entity has velocity.
 * @property {Triple} velocityKmPerSec - Velocity vector
 * @property {Triple} [angularVelocityRadPerSec] - Angular velocity (for celestial bodies)
 */

/**
 * @typedef {Object} PhysicalState
 * Optional on in-world entities. Only present if entity has physical properties.
 * @property {number} [estimatedMassKg] - Mass in kilograms
 * @property {number} [estimatedDiameterM] - Diameter in meters
 */

/**
 * @typedef {Object} ObservabilityState
 * Observability state for in-world entities.
 * @property {'visible' | 'not-visible' | 'cloaked'} visibility - Current visibility
 * @property {'unscanned' | 'scanned'} scanState - Scan state
 */

/**
 * @typedef {Object} TrajectoryDescriptor
 * Optional trajectory information, wrapping orbital elements.
 * @property {'static' | 'orbital-elements'} kind - Type of trajectory
 * @property {Object} [orbit] - Orbital elements (only when kind is 'orbital-elements')
 */

/**
 * Validation helper: check if value is a valid Triple
 * @param {*} value
 * @returns {boolean}
 */
function isTriple(value) {
  return (
    Boolean(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    typeof value.z === 'number' &&
    Number.isFinite(value.z)
  );
}

/**
 * Validation helper: check if value is a valid SpatialState
 * @param {*} value
 * @returns {boolean}
 */
function isSpatialState(value) {
  return (
    Boolean(value) &&
    typeof value.solarSystemId === 'string' &&
    value.solarSystemId.length > 0 &&
    value.frame === 'barycentric' &&
    isTriple(value.positionKm) &&
    typeof value.epochMs === 'number' &&
    Number.isFinite(value.epochMs)
  );
}

/**
 * Calculate Cartesian distance between two positions
 * @param {Triple} fromPositionKm
 * @param {Triple} toPositionKm
 * @returns {number} Distance in kilometers
 */
function distanceKm(fromPositionKm, toPositionKm) {
  const dx = toPositionKm.x - fromPositionKm.x;
  const dy = toPositionKm.y - fromPositionKm.y;
  const dz = toPositionKm.z - fromPositionKm.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate squared Cartesian distance (for efficient filtering)
 * @param {Triple} fromPositionKm
 * @param {Triple} toPositionKm
 * @returns {number} Squared distance in kilometers²
 */
function distanceKmSquared(fromPositionKm, toPositionKm) {
  const dx = toPositionKm.x - fromPositionKm.x;
  const dy = toPositionKm.y - fromPositionKm.y;
  const dz = toPositionKm.z - fromPositionKm.z;
  return dx * dx + dy * dy + dz * dz;
}

module.exports = {
  isTriple,
  isSpatialState,
  distanceKm,
  distanceKmSquared,
};
