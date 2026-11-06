'use strict';

const { createHash } = require('node:crypto');
const { comparisonKeys } = require('./system-naming');

const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 100;
// The checked-in system registry is 4,845 entries; leave headroom for catalog growth
// while keeping full-catalog planning bounded. This does not change batch/CLI limits.
const MAX_CATALOG_SCOPE_SIZE = 5000;
const WEIGHT_TOTAL = 100;

const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function validateBatchSize(count) {
  if (!Number.isInteger(count) || count < MIN_BATCH_SIZE || count > MAX_BATCH_SIZE) {
    throw new RangeError(
      `Batch size must be an integer from ${MIN_BATCH_SIZE} through ${MAX_BATCH_SIZE}.`
    );
  }
}

function validateCatalogScopeSize(count) {
  if (!Number.isInteger(count) || count < MIN_BATCH_SIZE || count > MAX_CATALOG_SCOPE_SIZE) {
    throw new RangeError(
      `Catalog scope size must be an integer from ${MIN_BATCH_SIZE} through ${MAX_CATALOG_SCOPE_SIZE}.`
    );
  }
}

function validatePolicy(policy) {
  if (!policy || !Array.isArray(policy.languages) || policy.languages.length === 0) {
    throw new TypeError('Weighted language policy must contain an ordered languages array.');
  }
  const ids = new Set();
  let total = 0;
  for (const language of policy.languages) {
    if (
      !language ||
      typeof language.id !== 'string' ||
      !language.id ||
      typeof language.language !== 'string' ||
      !language.language ||
      !Number.isInteger(language.weight) ||
      language.weight < 0 ||
      !Array.isArray(language.candidateLanguageLabels) ||
      language.candidateLanguageLabels.some((label) => typeof label !== 'string' || !label.trim())
    ) {
      throw new TypeError(
        'Each policy language needs an id, label, integer weight and language tags.'
      );
    }
    if (ids.has(language.id)) throw new Error(`Duplicate policy language id: ${language.id}`);
    ids.add(language.id);
    total += language.weight;
  }
  if (total !== WEIGHT_TOTAL) {
    throw new RangeError(`Language policy weights must sum to ${WEIGHT_TOTAL}; found ${total}.`);
  }
}

function getHamiltonQuotas(count, policy) {
  validateBatchSize(count);
  return calculateHamiltonQuotas(count, policy);
}

function getHamiltonScopeQuotas(count, policy) {
  validateCatalogScopeSize(count);
  return calculateHamiltonQuotas(count, policy);
}

function calculateHamiltonQuotas(count, policy) {
  validatePolicy(policy);

  const quotas = policy.languages.map((language, index) => {
    const numerator = language.weight * count;
    return {
      ...language,
      policyOrder: index,
      quota: Math.floor(numerator / WEIGHT_TOTAL),
      remainderNumerator: numerator % WEIGHT_TOTAL,
      remainderDenominator: WEIGHT_TOTAL,
      receivesRemainderSlot: false,
    };
  });
  let remainingSlots = count - quotas.reduce((total, quota) => total + quota.quota, 0);
  const remainderOrder = [...quotas].sort(
    (left, right) =>
      right.remainderNumerator - left.remainderNumerator || left.policyOrder - right.policyOrder
  );
  for (const quota of remainderOrder) {
    if (remainingSlots === 0) break;
    quota.quota += 1;
    quota.receivesRemainderSlot = true;
    remainingSlots -= 1;
  }
  if (remainingSlots !== 0) {
    throw new Error(`Hamilton allocation left ${remainingSlots} unallocated batch slots.`);
  }
  return quotas;
}

function candidateRank(candidate, category, algorithmVersion, seed) {
  return createHash('sha256')
    .update(JSON.stringify([algorithmVersion, seed, category.id, candidate.candidateId]))
    .digest('hex');
}

function isCandidateForLanguage(candidate, category) {
  if (!category.candidateLanguageLabels.includes(candidate.language)) return false;
  return (
    !category.requiredLinguisticStatus ||
    candidate.linguisticStatus === category.requiredLinguisticStatus
  );
}

function validateCandidates(candidates) {
  if (!Array.isArray(candidates)) throw new TypeError('Candidates must be an array.');
  const ids = new Set();
  for (const candidate of candidates) {
    if (
      !candidate ||
      typeof candidate.candidateId !== 'string' ||
      !candidate.candidateId ||
      typeof candidate.name !== 'string' ||
      !candidate.name.trim() ||
      typeof candidate.language !== 'string' ||
      !candidate.language
    ) {
      throw new TypeError('Each candidate needs a nonempty id, name and explicit language tag.');
    }
    if (ids.has(candidate.candidateId)) {
      throw new Error(`Duplicate candidate id: ${candidate.candidateId}`);
    }
    ids.add(candidate.candidateId);
  }
}

function allocateCandidates(
  {
    count,
    policy,
    candidates,
    reservedKeys = new Set(),
    algorithmVersion,
    seed,
    pinnedCandidates = [],
    preferredCandidateLanes = [],
  },
  catalogScope = false
) {
  (catalogScope ? validateCatalogScopeSize : validateBatchSize)(count);
  validatePolicy(policy);
  validateCandidates(candidates);
  if (!(reservedKeys instanceof Set)) throw new TypeError('reservedKeys must be a Set.');
  if (typeof algorithmVersion !== 'string' || !algorithmVersion) {
    throw new TypeError('algorithmVersion is required.');
  }
  if (typeof seed !== 'string' || !seed) throw new TypeError('seed is required.');
  if (!Array.isArray(pinnedCandidates) || !Array.isArray(preferredCandidateLanes)) {
    throw new TypeError('Pinned candidates and preferred lanes must be arrays.');
  }

  const quotas = catalogScope
    ? getHamiltonScopeQuotas(count, policy)
    : getHamiltonQuotas(count, policy);
  const quotaById = new Map(quotas.map((quota) => [quota.id, quota]));
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const pinsByLanguage = new Map();
  const pinnedIds = new Set();
  for (const pin of pinnedCandidates) {
    const quota = quotaById.get(pin?.languageId);
    const candidate = candidateById.get(pin?.candidateId);
    if (!quota || !candidate) {
      throw new Error(`Pinned candidate or policy language is unknown: ${pin?.candidateId}`);
    }
    if (quota.quota === 0) {
      throw new Error(`Pinned language ${quota.language} received no slot in this batch.`);
    }
    if (!isCandidateForLanguage(candidate, quota)) {
      throw new Error(
        `Pinned candidate ${candidate.candidateId} has an incompatible language tag.`
      );
    }
    if (pinnedIds.has(candidate.candidateId)) {
      throw new Error(`Candidate is pinned more than once: ${candidate.candidateId}`);
    }
    const languageSlot =
      pin.languageSlot ??
      Array.from({ length: quota.quota }, (_unused, index) => index + 1).find(
        (slot) => !pinsByLanguage.get(quota.id)?.has(slot)
      );
    if (!Number.isInteger(languageSlot) || languageSlot < 1 || languageSlot > quota.quota) {
      throw new Error(`Pinned language slot is outside the quota for ${quota.id}: ${languageSlot}`);
    }
    if (!pinsByLanguage.has(quota.id)) pinsByLanguage.set(quota.id, new Map());
    const languagePins = pinsByLanguage.get(quota.id);
    if (languagePins.has(languageSlot)) {
      throw new Error(
        `More than one fixed candidate is pinned to ${quota.id} slot ${languageSlot}.`
      );
    }
    languagePins.set(languageSlot, candidate);
    pinnedIds.add(candidate.candidateId);
  }

  const usedKeys = new Set(reservedKeys);
  const usedCandidateIds = new Set();
  const allocations = quotas.map((quota) => {
    const allocatedCandidates = Array.from({ length: quota.quota }, () => null);
    const rejectedCandidateIds = [];
    const languagePins = pinsByLanguage.get(quota.id) || new Map();
    for (const [languageSlot, pinned] of [...languagePins].sort(
      ([left], [right]) => left - right
    )) {
      const keys = comparisonKeys(pinned.name);
      if (keys.some((key) => usedKeys.has(key))) {
        throw new Error(`Pinned candidate collides with a reserved name: ${pinned.name}`);
      }
      allocatedCandidates[languageSlot - 1] = pinned;
      usedCandidateIds.add(pinned.candidateId);
      for (const key of keys) usedKeys.add(key);
    }

    const preferredLaneRank = (candidate) => {
      const index = preferredCandidateLanes.indexOf(candidate.lane);
      return index === -1 ? preferredCandidateLanes.length : index;
    };
    const rankedCandidates = candidates
      .filter(
        (candidate) =>
          isCandidateForLanguage(candidate, quota) &&
          !usedCandidateIds.has(candidate.candidateId) &&
          ![...languagePins.values()].some((pinned) => pinned.candidateId === candidate.candidateId)
      )
      .map((candidate) => ({
        candidate,
        rank: candidateRank(candidate, quota, algorithmVersion, seed),
      }))
      .sort(
        (left, right) =>
          preferredLaneRank(left.candidate) - preferredLaneRank(right.candidate) ||
          compareText(left.rank, right.rank) ||
          compareText(left.candidate.candidateId, right.candidate.candidateId)
      );

    for (const ranked of rankedCandidates) {
      const availableSlot = allocatedCandidates.findIndex((candidate) => candidate === null);
      if (availableSlot === -1) break;
      const candidate = ranked.candidate;
      const keys = comparisonKeys(candidate.name);
      if (keys.some((key) => usedKeys.has(key))) {
        rejectedCandidateIds.push(candidate.candidateId);
        continue;
      }
      allocatedCandidates[availableSlot] = candidate;
      usedCandidateIds.add(candidate.candidateId);
      for (const key of keys) usedKeys.add(key);
    }

    const filledCount = allocatedCandidates.filter(Boolean).length;
    return {
      ...quota,
      allocatedCandidates,
      filledCount,
      unfilledCount: quota.quota - filledCount,
      rejectedCandidateIds,
    };
  });

  return {
    count,
    weightTotal: WEIGHT_TOTAL,
    allocationMethod: 'hamilton-largest-remainder-per-batch',
    fractionalRemainderTieBreak:
      'higher integer remainder first; exact ties use the language order listed in policy',
    quotas: allocations,
    filledCount: allocations.reduce((total, item) => total + item.filledCount, 0),
    unfilledCount: allocations.reduce((total, item) => total + item.unfilledCount, 0),
  };
}

function allocateWeightedCandidates(options) {
  return allocateCandidates(options);
}

function allocateWeightedScopeCandidates(options) {
  return allocateCandidates(options, true);
}

module.exports = {
  MAX_CATALOG_SCOPE_SIZE,
  MAX_BATCH_SIZE,
  MIN_BATCH_SIZE,
  allocateWeightedCandidates,
  allocateWeightedScopeCandidates,
  getHamiltonQuotas,
  getHamiltonScopeQuotas,
  validateBatchSize,
  validateCatalogScopeSize,
  validatePolicy,
};
