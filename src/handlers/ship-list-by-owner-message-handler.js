'use strict';

const { SHIP_LIST_BY_OWNER_RESPONSE_EVENT } = require('../model/ship-list-by-owner');
const { INVALID_SESSION_MESSAGE } = require('../model/session');
const { normalizeOwnership, matchesOwner } = require('./context/ship-ownership');

class ShipListByOwnerMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const correlationId =
      this.context.toNonEmptyString(payload?.correlationId) ||
      this.context.toNonEmptyString(payload?.requestId) ||
      this.context.toNonEmptyString(payload?.messageId) ||
      '-';
    const ownerRaw = payload?.owner;

    if (!playerName) {
      return {
        success: false,
        message: 'playerName is required',
        ships: [],
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        ships: [],
      };
    }

    const ownerNormalization = normalizeOwnership(this.context, {
      ...ownerRaw,
      playerId:
        this.context.toNonEmptyString(ownerRaw?.playerId) ||
        (ownerRaw?.ownerType === 'player-character'
          ? this.context.toNonEmptyString(player.playerId)
          : null),
    });

    if (ownerNormalization.error) {
      return {
        success: false,
        message: ownerNormalization.error,
        ships: [],
      };
    }

    const owner = {
      ownerType: ownerNormalization.ownerType,
      playerId: ownerNormalization.playerId,
      characterId: ownerNormalization.characterId,
      npcId: ownerNormalization.npcId,
      factionId: ownerNormalization.factionId,
    };

    const ships = [];
    for (const [normalizedPlayerName, characters] of this.context.charactersByPlayer.entries()) {
      if (!Array.isArray(characters)) {
        continue;
      }

      const scopedPlayer = this.context.getPlayer(normalizedPlayerName);
      const scopedPlayerName =
        this.context.toNonEmptyString(scopedPlayer?.playerName) || normalizedPlayerName;
      const scopedPlayerId = this.context.toNonEmptyString(scopedPlayer?.playerId);

      for (const character of characters) {
        const characterId = this.context.toNonEmptyString(character?.id);
        const characterShips = Array.isArray(character?.ships) ? character.ships : [];
        for (const ship of characterShips) {
          const normalizedShip = this.context.normalizeShip(ship);
          const shipOwnership = normalizeOwnership(this.context, normalizedShip.ownership || {});
          if (shipOwnership.error) {
            return {
              success: false,
              message: 'Ship ownership metadata is required',
              ships: [],
            };
          }

          const normalizedOwnership = {
            ownerType: shipOwnership.ownerType,
            playerId: shipOwnership.playerId,
            characterId: shipOwnership.characterId,
            npcId: shipOwnership.npcId,
            factionId: shipOwnership.factionId,
          };

          if (matchesOwner(normalizedOwnership, owner)) {
            const ownerScopedShip = {
              ...normalizedShip,
              ownership: normalizedOwnership,
            };

            const hydratedShip = await this.context.hydrateShipAsync(ownerScopedShip, {
              correlationId,
              playerName: scopedPlayerName,
              characterId,
              owningPlayerId: scopedPlayerId,
              owningCharacterId: characterId,
            });

            ships.push(hydratedShip);
          }
        }
      }

      if (normalizedPlayerName === this.context.normalizePlayerName(playerName)) {
        // Continue scanning globally to support cross-owner queries while still anchored to session auth.
      }
    }

    return {
      success: true,
      message: 'Ship list by owner retrieved successfully',
      owner,
      ships,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('ship-list-by-owner-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = {
        success: false,
        reason: 'INVALID_SESSION',
        message: INVALID_SESSION_MESSAGE,
        ships: [],
      };
      socket.emit(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipListByOwnerMessageHandler,
};
