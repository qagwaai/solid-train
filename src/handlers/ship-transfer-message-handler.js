'use strict';

const { SHIP_TRANSFER_RESPONSE_EVENT } = require('../model/ship-transfer');
const { INVALID_SESSION_MESSAGE } = require('../model/session');
const { normalizeOwnership } = require('./context/ship-ownership');

function toOwnershipSnapshot(ownership) {
  return {
    ownerType: ownership.ownerType,
    playerId: ownership.playerId,
    characterId: ownership.characterId,
    npcId: ownership.npcId,
    factionId: ownership.factionId,
  };
}

function ownershipEquals(left, right) {
  if (!left || !right) {
    return false;
  }

  return (
    left.ownerType === right.ownerType &&
    left.playerId === right.playerId &&
    left.characterId === right.characterId &&
    left.npcId === right.npcId &&
    left.factionId === right.factionId
  );
}

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
    const actorPlayerId = this.context.toNonEmptyString(actorPlayer?.playerId);
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
    const currentOwnership = normalizeOwnership(this.context, normalizedExistingShip.ownership || {});
    if (currentOwnership.error) {
      const response = {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: currentOwnership.error,
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    const expectedFromOwnership = normalizeOwnership(this.context, payload?.fromOwner || {});
    if (expectedFromOwnership.error) {
      const response = {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: expectedFromOwnership.error,
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    const fromOwner = toOwnershipSnapshot(currentOwnership);
    const requestedFromOwner = toOwnershipSnapshot(expectedFromOwnership);
    if (!ownershipEquals(fromOwner, requestedFromOwner)) {
      const response = {
        success: false,
        reason: 'OWNERSHIP_TRANSFER_SOURCE_MISMATCH',
        message: 'fromOwner does not match current ship ownership',
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    const nextOwnership = normalizeOwnership(this.context, payload?.toOwner || {});
    if (nextOwnership.error) {
      const response = {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: nextOwnership.error,
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    const isClaimFlow =
      currentOwnership.ownerType === 'unknown' && nextOwnership.ownerType === 'player-character';
    const claimToken = this.context.toNonEmptyString(payload?.claimToken);
    if (isClaimFlow && !claimToken) {
      const response = {
        success: false,
        reason: 'OWNERSHIP_CLAIM_TOKEN_REQUIRED',
        message: 'Ownership transition unknown -> player-character requires claimToken',
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    if (isClaimFlow && currentOwnership.claimToken && currentOwnership.claimToken !== claimToken) {
      const response = {
        success: false,
        reason: 'OWNERSHIP_CLAIM_TOKEN_INVALID',
        message: 'claimToken does not match current ownership claim token',
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    if (
      !isClaimFlow &&
      currentOwnership.ownerType === 'player-character' &&
      currentOwnership.playerId !== actorPlayerId
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

    if (isClaimFlow && nextOwnership.playerId !== actorPlayerId) {
      const response = {
        success: false,
        reason: 'SHIP_TRANSFER_FORBIDDEN',
        message: 'Actor does not have permission to claim ship for another player',
        shipId,
      };
      socket.emit(SHIP_TRANSFER_RESPONSE_EVENT, response);
      return response;
    }

    const toOwner = toOwnershipSnapshot(nextOwnership);
    const ownershipHistoryEntry = {
      at: new Date().toISOString(),
      reason: isClaimFlow ? 'claim' : this.context.toNonEmptyString(payload?.transferReason) || 'transfer',
      fromOwner,
      toOwner,
      actor: {
        ownerType: 'player-character',
        playerId: actorPlayerId || null,
        characterId: this.context.toNonEmptyString(payload?.actorCharacterId) || null,
      },
    };

    const existingHistory = Array.isArray(entry.ship?.ownershipHistory) ? entry.ship.ownershipHistory : [];
    const updatedShip = {
      ...entry.ship,
      ownership: { ...toOwner },
      ownershipHistory: [...existingHistory, ownershipHistoryEntry],
    };
    entry.ships[entry.shipIndex] = updatedShip;

    if (nextOwnership.ownerType === 'player-character') {
      const destinationCharacterId = this.context.toNonEmptyString(nextOwnership.characterId);
      const destinationPlayerId = this.context.toNonEmptyString(nextOwnership.playerId);
      const sourceCharacterId = this.context.toNonEmptyString(currentOwnership.characterId);
      const sourcePlayerId = this.context.toNonEmptyString(currentOwnership.playerId);
      if (
        destinationCharacterId &&
        destinationPlayerId &&
        (destinationCharacterId !== sourceCharacterId || destinationPlayerId !== sourcePlayerId)
      ) {
        // Find destination player and add ship to their character
        let found = false;
        for (const [normalizedPlayerName, characters] of this.context.charactersByPlayer.entries()) {
          if (!Array.isArray(characters) || found) {
            continue;
          }

          const player = this.context.getPlayer(normalizedPlayerName);
          let playerMatchesDestination = false;
          
          // Match by playerId if available, or fallback to normalized player name
          if (player) {
            const playerPlayerId = this.context.toNonEmptyString(player.playerId);
            if (playerPlayerId && playerPlayerId === destinationPlayerId) {
              playerMatchesDestination = true;
            } else if (!playerPlayerId && normalizedPlayerName === this.context.toNonEmptyString(destinationPlayerId).toLowerCase()) {
              // Fallback: match if playerName normalized matches destinationPlayerId
              playerMatchesDestination = true;
            }
          }

          if (playerMatchesDestination) {
            for (const character of characters) {
              if (this.context.toNonEmptyString(character?.id) === destinationCharacterId) {
                if (!Array.isArray(character.ships)) {
                  character.ships = [];
                }
                character.ships.push(updatedShip);
                found = true;
                break;
              }
            }
          }
        }
      }
    }

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
