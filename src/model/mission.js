'use strict';

const MISSION_STATUS_VALUES = [
  'available',
  'started',
  'in-progress',
  'failed',
  'completed',
  'locked',
  'abandoned',
  'paused',
  'turned-in'
];

const DEFAULT_MISSION_STATUS = 'available';
const DEFAULT_STARTER_MISSION_ID = 'first-target';

/**
 * @typedef {Object} CharacterMissionProgress
 * @property {string} missionId
 * @property {string} status
 * @property {string} [startedAt]
 * @property {string} [inProgressAt]
 * @property {string} [failedAt]
 * @property {string} [completedAt]
 * @property {string} [updatedAt]
 * @property {string} [failureReason]
 * @property {string} [statusDetail]
 */

module.exports = {
  MISSION_STATUS_VALUES,
  DEFAULT_MISSION_STATUS,
  DEFAULT_STARTER_MISSION_ID
};