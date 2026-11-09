'use strict';

function assessEvidence(evidence, { measurementFields, requireCommonFit = false }) {
  if (!evidence || !Array.isArray(evidence.records) || !Array.isArray(measurementFields)) {
    throw new Error('Assessment requires evidence records and explicit measurement fields');
  }
  if (!evidence.records.length) throw new Error('Assessment evidence records must not be empty');
  if (!measurementFields.length || measurementFields.some((field) => typeof field !== 'string')) {
    throw new Error('Measurement fields must be a nonempty list of field names');
  }
  const blockers = [];
  const ids = new Set();
  for (const record of evidence.records) {
    if (!record.id || ids.has(record.id)) throw new Error('Evidence IDs must be present and unique');
    ids.add(record.id);
    if (record.fieldEvidence !== undefined && !Array.isArray(record.fieldEvidence)) {
      throw new Error(`${record.id}: fieldEvidence must be an array`);
    }
    for (const field of measurementFields) {
      const entries = (record.fieldEvidence || []).filter((entry) => entry.field === field);
      if (!Number.isFinite(record[field]) || !entries.length) {
        blockers.push(`${record.id}: ${field} has no matching measurement evidence`);
        continue;
      }
      for (const entry of entries) {
        if (entry.value !== record[field]) {
          blockers.push(`${record.id}: ${field} evidence value does not match`);
        }
        if (
          field === 'massEarth' &&
          record.massProvenance !== 'Mass'
        ) {
          blockers.push(
            `${record.id}: mass provenance ${record.massProvenance || 'unknown'} is not a measured mass`
          );
        }
        if (entry.limit !== 'none') {
          blockers.push(`${record.id}: ${field} is ${entry.limit || 'unknown'}, not a measurement`);
        }
        if (!Array.isArray(entry.reference) || !entry.reference[0]) {
          blockers.push(`${record.id}: ${field} lacks a field-specific source`);
        }
        if (
          !Number.isFinite(entry.errorUpper) || entry.errorUpper < 0 ||
          !Number.isFinite(entry.errorLower) || entry.errorLower > 0
        ) {
          blockers.push(`${record.id}: ${field} lacks valid signed uncertainty bounds`);
        }
      }
      if (new Set(entries.map((entry) => JSON.stringify(entry))).size > 1) {
        blockers.push(`${record.id}: ${field} has conflicting evidence alternatives`);
      }
    }
  }
  if (requireCommonFit) {
    blockers.push('Common fitted architecture is not certified by field-level catalog evidence');
  }
  return {
    status: blockers.length ? 'held' : 'measurement-evidence-accepted',
    physicalEligibility: 'not-assessed',
    blockers: [...new Set(blockers)],
  };
}

module.exports = { assessEvidence };
