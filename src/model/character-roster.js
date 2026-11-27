'use strict';

const { createSchemaValidator } = require('./schema-validator');
const ledgerSchema = require('../../api/schemas/credit-ledger-entry.schema.json');
const { MISSION_STATUS_VALUES } = require('./mission');
const validateLedger = createSchemaValidator().compile(ledgerSchema);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nonblank = (value) => typeof value === 'string' && /\S/.test(value);

function validIdentity(identity) {
  return (
    identity &&
    typeof identity === 'object' &&
    !Array.isArray(identity) &&
    Object.keys(identity).length === 3 &&
    identity.operation === 'character-list' &&
    identity.entityType === 'character' &&
    nonblank(identity.containerId)
  );
}

function validRequest(payload) {
  return (
    nonblank(payload?.playerName) &&
    nonblank(payload?.sessionKey) &&
    typeof payload?.correlationId === 'string' &&
    uuid.test(payload.correlationId) &&
    validIdentity(payload.requestIdentity)
  );
}

function failure(payload, reason, message) {
  return {
    success: false,
    message,
    reason,
    playerName: typeof payload?.playerName === 'string' ? payload.playerName : '',
    characters: [],
    correlationId:
      typeof payload?.correlationId === 'string' && uuid.test(payload.correlationId)
        ? payload.correlationId
        : null,
    ...(validIdentity(payload?.requestIdentity)
      ? { requestIdentity: payload.requestIdentity }
      : {}),
  };
}

function projectRoster(characters) {
  if (!Array.isArray(characters)) throw new Error('Roster is unavailable');
  const characterIds = new Set();
  const ledgerIds = new Set();
  return characters.map((character) => {
    if (
      !nonblank(character?.id) ||
      characterIds.has(character.id) ||
      !nonblank(character.characterName) ||
      !Array.isArray(character.creditLedger) ||
      !Array.isArray(character.missions)
    )
      throw new Error('Incomplete character');
    characterIds.add(character.id);
    let credits = 0;
    const creditLedger = character.creditLedger.map((entry) => {
      if (!entry || !nonblank(entry.id) || ledgerIds.has(entry.id) || !validateLedger(entry)) {
        throw new Error('Incomplete ledger');
      }
      /** @type {any} */
      const ledgerEntry = entry;
      ledgerIds.add(ledgerEntry.id);
      credits += ledgerEntry.type === 'put' ? ledgerEntry.amount : -ledgerEntry.amount;
      if (!Number.isFinite(credits)) throw new Error('Invalid balance');
      return {
        id: ledgerEntry.id,
        type: ledgerEntry.type,
        amount: ledgerEntry.amount,
        description: ledgerEntry.description,
        timestamp: ledgerEntry.timestamp,
        referenceId: ledgerEntry.referenceId,
      };
    });
    const missionIds = new Set();
    const missions = character.missions.map((mission) => {
      if (
        !nonblank(mission?.missionId) ||
        missionIds.has(mission.missionId) ||
        !MISSION_STATUS_VALUES.includes(mission.status)
      )
        throw new Error('Incomplete mission');
      missionIds.add(mission.missionId);
      return { missionId: mission.missionId, status: mission.status };
    });
    return {
      id: character.id,
      characterName: character.characterName,
      credits,
      creditLedger,
      missions,
      ships: Array.isArray(character.ships) ? character.ships : [],
    };
  });
}

module.exports = { validRequest, failure, projectRoster };
