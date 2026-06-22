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
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'playerName is required',
        ships: [],
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
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
        reason: 'OWNERSHIP_VALIDATION_FAILED',
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

    if (
      owner.ownerType === 'player-character' &&
      owner.playerId !== this.context.toNonEmptyString(player.playerId)
    ) {
      return {
        success: false,
        reason: 'SHIP_LIST_OWNER_FORBIDDEN',
        message: 'Actor does not have permission to list ships for another player',
        ships: [],
      };
    }

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
              reason: 'OWNERSHIP_VALIDATION_FAILED',
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
            const ownershipHistory = Array.isArray(ship?.ownershipHistory) ? ship.ownershipHistory : [];
            const ownerScopedShip = {
              ...normalizedShip,
              ownership: normalizedOwnership,
              ownershipHistory,
            };

            const hydratedShip = await this.context.hydrateShipAsync(ownerScopedShip, {
              correlationId,
              playerName: scopedPlayerName,
              characterId,
              owningPlayerId: scopedPlayerId,
              owningCharacterId: characterId,
            });

            // Ensure ownershipHistory is preserved in the hydrated ship
            if (Array.isArray(ownershipHistory) && ownershipHistory.length > 0) {
              hydratedShip.ownershipHistory = ownershipHistory;
            }

            ships.push(hydratedShip);
          }
        }
      }

      if (normalizedPlayerName === this.context.normalizePlayerName(playerName)) {
        // Continue scanning globally to support cross-owner queries while still anchored to session auth.
      }
    }

    this.context.log(
      `[ship-list-by-owner-publish] correlationId=${correlationId} requester=${player.playerName} ownerType=${owner.ownerType} ownerPlayerId=${this.context.toNonEmptyString(owner.playerId) || '-'} ownerCharacterId=${this.context.toNonEmptyString(owner.characterId) || '-'} shipCount=${ships.length} shipIds=${ships.map((ship) => this.context.toNonEmptyString(ship?.id)).filter((value) => Boolean(value)).join(',') || '-'} projectedInventoryItemIds=${ships.map((ship) => {
        const ids = Array.isArray(ship?.inventory)
          ? ship.inventory
              .map((item) => this.context.toNonEmptyString(item?.id))
              .filter((value) => Boolean(value))
          : [];
        return `${this.context.toNonEmptyString(ship?.id) || '-'}:[${ids.join('|') || '-'}]`;
      }).join(',') || '-'}`,
      { level: 'trace' }
    );

    return {
      success: true,
      message: 'Ship list by owner retrieved successfully',
      owner,
      ships,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('ship-list-by-owner-request', payload, {
      level: 'debug',
    });


    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipListByOwnerMessageHandler,
};
