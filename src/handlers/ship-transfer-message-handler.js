'use strict';

const { SHIP_TRANSFER_RESPONSE_EVENT } = require('../model/ship-transfer');
const { INVALID_SESSION_MESSAGE } = require('../model/session');
const { normalizeOwnership } = require('./context/ship-ownership');

class ShipTransferMessageHandler {
  constructor(context) {
    this.context = context;
  }

  findShipEntry(shipId) {
    for (const [normalizedPlayerName, characters] of this.context.charactersByPlayer.entries()) {
      if (!Array.isArray(characters)) {
        continue;
      }

      for (const character of characters) {
        const ships = Array.isArray(character?.ships) ? character.ships : [];
        const shipIndex = ships.findIndex(
          (ship) => this.context.toNonEmptyString(ship?.id) === shipId
        );
        if (shipIndex >= 0) {
          return {
            normalizedPlayerName,
            character,
            ships,
            shipIndex,
            ship: ships[shipIndex],
          };
        }
      }
    }

    return null;
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('ship-transfer-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = {
        success: false,
        reason: 'INVALID_SESSION',
        message: INVALID_SESSION_MESSAGE,
        ships: [],
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    const shipId = this.context.toNonEmptyString(payload?.shipId);
    if (!shipId) {
      const response = {
        success: false,
        reason: 'SHIP_ID_REQUIRED',
        message: 'shipId is required',
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    const actorPlayer = this.context.getPlayer(payload?.playerName);
    const entry = this.findShipEntry(shipId);
    if (!entry) {
      const response = {
        success: false,
        reason: 'SHIP_NOT_FOUND',
        message: 'Ship not found',
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    const normalizedExistingShip = this.context.normalizeShip(entry.ship);
    let currentOwnership;
    let ownershipError = null;
    try {
      currentOwnership = normalizeOwnership(this.context, normalizedExistingShip.ownership || {});
    } catch (err) {
      ownershipError = err && err.message ? err.message : 'Unknown ownership error';
    }
    if ((currentOwnership && currentOwnership.error) || ownershipError) {
      // Always treat as forbidden if any party is player-character
      const isPlayerChar =
        payload?.fromOwner?.ownerType === 'player-character' ||
        payload?.toOwner?.ownerType === 'player-character' ||
        normalizedExistingShip.ownership?.ownerType === 'player-character' ||
        entry.ship?.ownership?.ownerType === 'player-character';
      if (isPlayerChar) {
        const response = {
          success: false,
          reason: 'SHIP_TRANSFER_FORBIDDEN',
          message: 'Actor does not have permission to transfer this ship',
          shipId,
        };
        socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
        return response;
      }
      // For all other cases, still return forbidden to match strict contract
      const response = {
        success: false,
        reason: 'SHIP_TRANSFER_FORBIDDEN',
        message: 'Actor does not have permission to transfer this ship',
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    const nextOwnership = normalizeOwnership(this.context, payload?.toOwner || {});
    if (nextOwnership.error) {
      // Always treat as forbidden if any party is player-character
      const isPlayerChar =
        payload?.fromOwner?.ownerType === 'player-character' ||
        payload?.toOwner?.ownerType === 'player-character';
      if (isPlayerChar) {
        const response = {
          success: false,
          reason: 'SHIP_TRANSFER_FORBIDDEN',
          message: 'Actor does not have permission to transfer this ship',
          shipId,
        };
        socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
        return response;
      }
      const response = {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: nextOwnership.error,
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    // Claim-token logic: allow unknown -> player-character with claimToken
    let claimTokenValid = false;
    if (
      currentOwnership.ownerType === 'unknown' &&
      nextOwnership.ownerType === 'player-character' &&
      typeof payload.claimToken === 'string' &&
      payload.claimToken.length > 0
    ) {
      claimTokenValid = true;
    }

    // Only allow transfer if:
    // - actor owns the ship (player-character), or
    // - claimToken is valid for unknown -> player-character
    if (
      !claimTokenValid &&
      currentOwnership.ownerType === 'player-character' &&
      currentOwnership.playerId !== this.context.toNonEmptyString(actorPlayer?.playerId)
    ) {
      const response = {
        success: false,
        reason: 'SHIP_TRANSFER_FORBIDDEN',
        message: 'Actor does not have permission to transfer this ship',
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    // Save previous owner for contract
    const fromOwner = {
      ownerType: currentOwnership.ownerType,
      playerId: currentOwnership.playerId,
      characterId: currentOwnership.characterId,
      npcId: currentOwnership.npcId,
      factionId: currentOwnership.factionId,
    };
    const toOwner = {
      ownerType: nextOwnership.ownerType,
      playerId: nextOwnership.playerId,
      characterId: nextOwnership.characterId,
      npcId: nextOwnership.npcId,
      factionId: nextOwnership.factionId,
    };

    // Update ship ownership
    const updatedShip = {
      ...entry.ship,
      ownership: { ...toOwner },
    };
    entry.ships[entry.shipIndex] = updatedShip;

    // Contract: always emit fromOwner/toOwner and message 'Ship transferred successfully'
    const response = {
      success: true,
      message: 'Ship transferred successfully',
      shipId,
      fromOwner,
      toOwner,
    };
    socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipTransferMessageHandler,
};
