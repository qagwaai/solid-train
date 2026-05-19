'use strict';

const { CHARACTER_ADD_RESPONSE_EVENT } = require('../model/character-add');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { DEFAULT_MISSION_STATUS, DEFAULT_STARTER_MISSION_ID } = require('../model/mission');
const { ITEM_STATE, ITEM_DAMAGE_STATUS, ITEM_CONTAINER_TYPE } = require('../model/canonical-items');

class CharacterAddMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate payload and produce base character-add response payload.
   * @param {Object} payload
   * @returns {Object}
   */
  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterName = this.context.toNonEmptyString(payload?.characterName);

    if (!playerName || !characterName) {
      return {
        success: false,
        message: 'playerName and characterName are required',
        playerName,
      };
    }

    const player = this.context.getPlayer(playerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
      };
    }

    const characterId = this.context.createId();

    return {
      success: true,
      message: 'Character added successfully',
      playerName: player.playerName,
      characterName,
      characterId,
    };
  }

  /**
   * Add a character and starter assets, then emit character-add-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('character-add-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = this.buildResponse(payload);

    if (response.success) {
      let createdItemIds = [];

      try {
        // Starter cargo is created first so character ship inventory can reference concrete item ids.
        const createdAt = this.context.getCurrentTimestamp();
        const starterShipId = `${response.characterId}-ship-1`;
        const starterDroneId = `${starterShipId}-item-1`;
        const owningPlayerId =
          this.context.toNonEmptyString(this.context.getPlayer(response.playerName)?.playerId) ||
          this.context.toNonEmptyString(response.playerName);
        const starterSubsystemItems = [
          {
            id: `${starterShipId}-starter-propulsion-manifold`,
            itemType: 'propulsion-manifold',
            displayName: 'Propulsion Manifold',
            state: ITEM_STATE.CONTAINED,
            damageStatus: ITEM_DAMAGE_STATUS.DAMAGED,
            launchable: false,
            container: {
              containerType: ITEM_CONTAINER_TYPE.SHIP,
              containerId: starterShipId,
            },
            owningPlayerId,
            owningCharacterId: response.characterId,
            spatial: null,
            createdAt,
            updatedAt: createdAt,
            destroyedAt: null,
            destroyedReason: null,
          },
          {
            id: `${starterShipId}-starter-sensor-array`,
            itemType: 'sensor-array',
            displayName: 'Sensor Array',
            state: ITEM_STATE.CONTAINED,
            damageStatus: ITEM_DAMAGE_STATUS.DAMAGED,
            launchable: false,
            container: {
              containerType: ITEM_CONTAINER_TYPE.SHIP,
              containerId: starterShipId,
            },
            owningPlayerId,
            owningCharacterId: response.characterId,
            spatial: null,
            createdAt,
            updatedAt: createdAt,
            destroyedAt: null,
            destroyedReason: null,
          },
          {
            id: `${starterShipId}-starter-power-distribution-bus`,
            itemType: 'power-distribution-bus',
            displayName: 'Power Distribution Bus',
            state: ITEM_STATE.CONTAINED,
            damageStatus: ITEM_DAMAGE_STATUS.DAMAGED,
            launchable: false,
            container: {
              containerType: ITEM_CONTAINER_TYPE.SHIP,
              containerId: starterShipId,
            },
            owningPlayerId,
            owningCharacterId: response.characterId,
            spatial: null,
            createdAt,
            updatedAt: createdAt,
            destroyedAt: null,
            destroyedReason: null,
          },
        ];
        const starterItems = [
          {
            id: starterDroneId,
            itemType: 'expendable-dart-drone',
            displayName: 'Expendable Dart Drone',
            state: ITEM_STATE.CONTAINED,
            damageStatus: ITEM_DAMAGE_STATUS.INTACT,
            container: {
              containerType: ITEM_CONTAINER_TYPE.SHIP,
              containerId: starterShipId,
            },
            owningPlayerId,
            owningCharacterId: response.characterId,
            spatial: null,
            createdAt,
            updatedAt: createdAt,
            destroyedAt: null,
            destroyedReason: null,
          },
          ...starterSubsystemItems,
        ];

        await this.context.addItemsAsync(starterItems);
        createdItemIds = starterItems.map((item) => item.id);

        const characterData = {
          id: response.characterId,
          characterName: response.characterName,
          createdAt,
          ships: [
            {
              id: starterShipId,
              shipName: `${response.characterName} Ship 1`,
              model: 'Scavenger Pod',
              tier: 1,
              createdAt,
              inventory: [
                {
                  itemId: starterDroneId,
                  itemType: 'expendable-dart-drone',
                },
                {
                  itemId: `${starterShipId}-starter-propulsion-manifold`,
                  itemType: 'propulsion-manifold',
                },
                {
                  itemId: `${starterShipId}-starter-sensor-array`,
                  itemType: 'sensor-array',
                },
                {
                  itemId: `${starterShipId}-starter-power-distribution-bus`,
                  itemType: 'power-distribution-bus',
                },
              ],
              spatial: {
                solarSystemId: 'sol',
                frame: 'barycentric',
                positionKm: { x: 0, y: 0, z: 0 },
                epochMs: Date.parse(createdAt),
              },
            },
          ],
          missions: [
            {
              missionId: DEFAULT_STARTER_MISSION_ID,
              status: DEFAULT_MISSION_STATUS,
              updatedAt: createdAt,
            },
          ],
          creditLedger: [
            {
              type: 'put',
              amount: 425,
              description: 'Starting credits',
              timestamp: createdAt,
              referenceId: null,
            },
          ],
        };
        await this.context.addCharacterAsync(payload?.playerName, characterData);
      } catch (error) {
        if (createdItemIds.length > 0) {
          try {
            await this.context.deleteItemsAsync(createdItemIds);
          } catch (cleanupError) {
            this.context.log(
              `[character-add-handler] Failed to roll back starter items: ${cleanupError.message}`
            );
          }
        }
        this.context.log(`[character-add-handler] Failed to add character: ${error.message}`);
        response.success = false;
        response.message = 'Failed to add character: database error';
        delete response.characterId;
        delete response.characterName;
      }
    }

    socket.emit(CHARACTER_ADD_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterAddMessageHandler,
};
