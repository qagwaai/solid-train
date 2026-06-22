'use strict';

function defaultToNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

/**
 * Returns true if value is a finite number.
 * @param {*} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Returns true if value is an object with finite x, y, z coordinates.
 * @param {*} value
 * @returns {boolean}
 */
function isTriple(value) {
  return (
    Boolean(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.z)
  );
}

/**
 * Conditionally attaches requestId from payload to response (mutates response).
 * @param {Object} response
 * @param {Object} payload
 * @param {function} toNonEmptyString
 * @returns {Object} response
 */
function attachRequestId(response, payload, toNonEmptyString = defaultToNonEmptyString) {
  const requestId = toNonEmptyString(payload?.requestId);
  if (requestId) response.requestId = requestId;
  return response;
}

module.exports = { isFiniteNumber, isTriple, attachRequestId };
