'use strict';

const {
  TRACTOR_BEAM_ACTIVATE_RESPONSE_EVENT,
} = require('../model/tractor-beam-activate');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const {
  resolveCorrelationId,
  normalizeRequestIdentity,
} = require('./correlation-metadata');

const TRACTOR_BEAM_ITEM_TYPE = 'ship-tractor-beam';

class TractorBeamActivateMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeRequestIdentity(
      {
        requestIdentity,
        operation: 'tractor-beam-activate',
        entityTypeCandidates: [TRACTOR_BEAM_ITEM_TYPE],
        containerIdCandidates: [payload?.shipId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  async buildParsed(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const shipId = this.context.toNonEmptyString(payload?.shipId);
    const targetItemId = this.context.toNonEmptyString(payload?.targetItemId) || null;
    const targetCelestialBodyId = this.context.toNonEmptyString(payload?.targetCelestialBodyId) || null;

    if (!playerName || !characterId || !shipId) {
      return {
        error: 'playerName, characterId, and shipId are required',
        playerName,
        characterId,
        shipId,
        targetItemId,
        targetCelestialBodyId,
      };
    }

    const player = await this.context.ensurePlayerLoadedAsync(playerName);
    if (!player) {
      return {
        error: 'Player is not registered',
        playerName,
        characterId,
        shipId,
        targetItemId,
        targetCelestialBodyId,
      };
    }

    await this.context.getCharactersAsync(player.playerName);
    const character = this.context.findCharacter(player.playerName, characterId);
    if (!character) {
      return {
        error: 'Character is not in player list',
        playerName: player.playerName,
        characterId,
        shipId,
        targetItemId,
        targetCelestialBodyId,
      };
    }

    const ship = Array.isArray(character.ships)
      ? character.ships.find((candidate) => candidate.id === shipId)
      : null;
    if (!ship) {
      return {
        error: 'Ship is not in character list',
        playerName: player.playerName,
        characterId,
        shipId,
        targetItemId,
        targetCelestialBodyId,
      };
    }

    const inventory = Array.isArray(ship.inventory) ? ship.inventory : [];
    const tractorReference = inventory.find(
      (reference) => this.context.toNonEmptyString(reference.itemType) === TRACTOR_BEAM_ITEM_TYPE
    );

    if (!tractorReference) {
      return {
        error: 'Ship does not have an equipped tractor beam item',
        playerName: player.playerName,
        characterId,
        shipId,
        targetItemId,
        targetCelestialBodyId,
      };
    }

    return {
      playerName: player.playerName,
      characterId,
      shipId,
      targetItemId,
      targetCelestialBodyId,
      tractorBeamItemId: this.context.toNonEmptyString(tractorReference.itemId),
    };
  }

  /**
   * Validate tractor beam activation payload and emit tractor-beam-activate-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('tractor-beam-activate-request', payload);
    const correlationId = resolveCorrelationId(
      payload,
      this.context.toNonEmptyString.bind(this.context)
    );
    const requestIdentity = this.normalizeRequestIdentity(payload?.requestIdentity, payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const parsed = await this.buildParsed(payload);
    const response = {
      success: !parsed.error,
      message: parsed.error || 'Tractor beam activated',
      correlationId,
      requestIdentity,
      playerName: this.context.toNonEmptyString(parsed.playerName || payload?.playerName),
      characterId: this.context.toNonEmptyString(parsed.characterId || payload?.characterId),
      shipId: this.context.toNonEmptyString(parsed.shipId || payload?.shipId),
      tractorBeamItemId: this.context.toNonEmptyString(parsed.tractorBeamItemId),
      targetItemId: this.context.toNonEmptyString(parsed.targetItemId || payload?.targetItemId) || null,
      targetCelestialBodyId:
        this.context.toNonEmptyString(parsed.targetCelestialBodyId || payload?.targetCelestialBodyId) ||
        null,
    };

    if (response.success) {
      response.activated = true;
    }

    socket.emit(TRACTOR_BEAM_ACTIVATE_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  TractorBeamActivateMessageHandler,
};
