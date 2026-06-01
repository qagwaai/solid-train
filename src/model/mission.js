'use strict';

const MISSION_STATUS_VALUES = [
  'available',
  'active',
  'completed',
];

const MISSION_STATUS_SET = new Set(MISSION_STATUS_VALUES);

const DEFAULT_MISSION_STATUS = 'available';
const DEFAULT_STARTER_MISSION_ID = 'first-target';
const MISSION_CATALOG_IDS = [
  'first-target',
  'm-01',
  'm-02',
  'm-03',
  'm-04',
  'm-05',
  'sq-01',
  'sq-02',
  'sq-03',
  'sq-04',
];
const MISSION_CATALOG_ID_SET = new Set(MISSION_CATALOG_IDS);

const MISSION_PREREQUISITES_BY_ID = {
  'first-target': [],
  'm-01': ['first-target'],
  'm-02': ['m-01'],
  'm-03': ['m-02'],
  'm-04': ['m-03'],
  'm-05': ['m-04'],
  'sq-01': ['m-02'],
  'sq-02': ['first-target'],
  'sq-03': ['first-target'],
  'sq-04': ['m-04'],
};

const MISSION_UNLOCK_SOURCE_STATUSES = new Set(['completed']);

function isCanonicalMissionStatus(status) {
  return MISSION_STATUS_SET.has(status);
}

/**
 * @typedef {Object} CharacterMissionProgress
 * @property {string} missionId
 * @property {string} status
 * @property {string} [updatedAt]
 */

module.exports = {
  MISSION_STATUS_VALUES,
  MISSION_STATUS_SET,
  DEFAULT_MISSION_STATUS,
  DEFAULT_STARTER_MISSION_ID,
  MISSION_CATALOG_IDS,
  MISSION_CATALOG_ID_SET,
  MISSION_PREREQUISITES_BY_ID,
  MISSION_UNLOCK_SOURCE_STATUSES,
  isCanonicalMissionStatus,
};
