'use strict';

const LAUNCH_ITEM_REQUEST_EVENT = 'launch-item-request';
const LAUNCH_ITEM_RESPONSE_EVENT = 'launch-item-response';

/**
 * @typedef {1|2|3|4|5} LaunchHotkey
 */

/**
 * @typedef {Object} LaunchItemRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} shipId
 * @property {string} sessionKey
 * @property {string} targetCelestialBodyId
 * @property {LaunchHotkey} hotkey
 * @property {string} itemId
 * @property {string} itemType
 */

/**
 * @typedef {Object} LaunchYieldMaterial
 * @property {string} material
 * @property {string} rarity
 * @property {number} quantity
 */

/**
 * @typedef {Object} LaunchResolution
 * @property {'target-destroyed'|'no-effect'} outcome
 * @property {boolean} targetDestroyed
 * @property {LaunchYieldMaterial[]} yieldedMaterials
 * @property {Object[]} yieldedItems
 * @property {Object} [targetCelestialBody]
 * @property {number} launchSeed
 */

/**
 * @typedef {Object} LaunchItemResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} shipId
 * @property {string} targetCelestialBodyId
 * @property {LaunchHotkey} hotkey
 * @property {string} itemId
 * @property {string} itemType
 * @property {LaunchResolution} [resolution]
 * @property {Object} [launchedItem]
 */

module.exports = {
  LAUNCH_ITEM_REQUEST_EVENT,
  LAUNCH_ITEM_RESPONSE_EVENT
};
