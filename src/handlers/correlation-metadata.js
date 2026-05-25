'use strict';

function defaultToNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function resolveCorrelationId(payload, toNonEmptyString = defaultToNonEmptyString) {
  return (
    toNonEmptyString(payload?.correlationId) ||
    toNonEmptyString(payload?.requestId) ||
    toNonEmptyString(payload?.messageId) ||
    'missing-correlation-id'
  );
}

function normalizeRequestIdentity(options = {}, toNonEmptyString = defaultToNonEmptyString) {
  const requestIdentity =
    options.requestIdentity && typeof options.requestIdentity === 'object'
      ? options.requestIdentity
      : {};
  const operation = toNonEmptyString(requestIdentity.operation) || options.operation;

  const entityTypeCandidates = Array.isArray(options.entityTypeCandidates)
    ? options.entityTypeCandidates
    : [];
  const containerIdCandidates = Array.isArray(options.containerIdCandidates)
    ? options.containerIdCandidates
    : [];

  let entityType = toNonEmptyString(requestIdentity.entityType);
  if (!entityType) {
    for (const candidate of entityTypeCandidates) {
      entityType = toNonEmptyString(candidate);
      if (entityType) {
        break;
      }
    }
  }

  let containerId = toNonEmptyString(requestIdentity.containerId);
  if (!containerId) {
    for (const candidate of containerIdCandidates) {
      containerId = toNonEmptyString(candidate);
      if (containerId) {
        break;
      }
    }
  }

  return {
    operation,
    entityType: entityType || 'unknown',
    containerId: containerId || '-',
  };
}

function applyCorrelationEcho(responsePayload, correlationMetadata, toNonEmptyString = defaultToNonEmptyString) {
  if (!responsePayload || typeof responsePayload !== 'object' || Array.isArray(responsePayload)) {
    return responsePayload;
  }

  const nextPayload = {
    ...responsePayload,
  };

  if (!toNonEmptyString(nextPayload.correlationId)) {
    nextPayload.correlationId = correlationMetadata.correlationId;
  }

  if (!nextPayload.requestIdentity || typeof nextPayload.requestIdentity !== 'object') {
    nextPayload.requestIdentity = correlationMetadata.requestIdentity;
  }

  return nextPayload;
}

module.exports = {
  resolveCorrelationId,
  normalizeRequestIdentity,
  applyCorrelationEcho,
};
