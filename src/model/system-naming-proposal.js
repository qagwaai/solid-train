'use strict';

const { createHash } = require('node:crypto');
const { comparisonKeys, normalizeAlias } = require('./system-naming');

function rankCandidates(candidates, { algorithmVersion, seed, systemId }) {
  return candidates
    .map((candidate) => ({
      candidate,
      rank: createHash('sha256')
        .update(JSON.stringify([algorithmVersion, seed, systemId, candidate.candidateId]))
        .digest('hex'),
    }))
    .sort(
      (left, right) =>
        left.rank.localeCompare(right.rank) ||
        left.candidate.candidateId.localeCompare(right.candidate.candidateId)
    );
}

function selectCandidate(candidates, reservedKeys, options) {
  const ranked = rankCandidates(candidates, options);
  const rejectedCandidateIds = [];
  for (const rankedCandidate of ranked) {
    const { candidate } = rankedCandidate;
    if (comparisonKeys(candidate.name).every((key) => !reservedKeys.has(key))) {
      return { ...rankedCandidate, rejectedCandidateIds };
    }
    rejectedCandidateIds.push(candidate.candidateId);
  }
  return null;
}

function addReservedLabels(reservedKeys, system) {
  for (const label of [
    system.displayName,
    system.catalogName,
    system.settlementName,
    system.primaryStar?.properName,
    ...(system.aliases || []),
  ]) {
    for (const key of comparisonKeys(label)) reservedKeys.add(key);
  }
  return reservedKeys;
}

function uniqueAliases(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizeAlias(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = {
  addReservedLabels,
  comparisonKeys,
  rankCandidates,
  selectCandidate,
  uniqueAliases,
};
