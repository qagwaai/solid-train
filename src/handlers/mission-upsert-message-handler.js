'use strict';

const {
  MISSION_UPSERT_RESPONSE_EVENT
} = require('../model/mission-upsert');
const {
  DEFAULT_STARTER_MISSION_ID
} = require('../model/mission');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');
const {
  DEFAULT_SOLAR_SYSTEM_ID
} = require('../model/celestial-body-upsert');

const STARTER_MISSION_ASTEROID_STATE = 'unscanned';
const STARTER_MISSION_ASTEROID_COUNT = 10;
const STARTER_MISSION_ACTIVATION_STATUSES = new Set(['started', 'in-progress']);
const STARTER_MISSION_ASTEROID_MATERIALS = [
  { rarity: 'Common', material: 'Iron', textureColor: '#8f99a7' },
  { rarity: 'Common', material: 'Nickel-Iron', textureColor: '#8da6b3' },
  { rarity: 'Uncommon', material: 'Silicate', textureColor: '#b9b2a3' },
  { rarity: 'Uncommon', material: 'Carbonaceous', textureColor: '#4e545f' },
  { rarity: 'Rare', material: 'Platinum Ore', textureColor: '#d4d7de' },
  { rarity: 'Rare', material: 'Cobalt Ore', textureColor: '#5f89c7' },
  { rarity: 'Exotic', material: 'Iridium Vein', textureColor: '#9bb0ff' },
  { rarity: 'Exotic', material: 'Palladium Core', textureColor: '#e0caa1' },
  { rarity: 'Common', material: 'Basaltic Rock', textureColor: '#5c5a63' },
  { rarity: 'Uncommon', material: 'Crystalline Quartz', textureColor: '#cfd8e6' }
];

class MissionUpsertMessageHandler {
  constructor(context) {
    this.context = context;
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const missionId = this.context.toNonEmptyString(payload?.missionId);
    const status = this.context.toNonEmptyString(payload?.status);

    if (!playerName || !characterId || !missionId || !status) {
      return {
        success: false,
        message: 'playerName, characterId, missionId, and status are required',
        playerName,
        characterId
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characterId
      };
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName,
        characterId
      };
    }

    return {
      success: true,
      message: 'Mission recorded successfully',
      playerName: player.playerName,
      characterId,
      mission: {
        missionId,
        status
      }
    };
  }

  enrichMissionTimestamps(mission, existingMission, timestamp) {
    const nextMission = {
      ...(existingMission || {}),
      ...mission,
      updatedAt: timestamp
    };

    if (mission.status === 'started' && !nextMission.startedAt) {
      nextMission.startedAt = timestamp;
    }
    if (mission.status === 'in-progress' && !nextMission.inProgressAt) {
      nextMission.inProgressAt = timestamp;
    }
    if (mission.status === 'failed' && !nextMission.failedAt) {
      nextMission.failedAt = timestamp;
    }
    if (mission.status === 'completed' && !nextMission.completedAt) {
      nextMission.completedAt = timestamp;
    }

    return nextMission;
  }

  createStarterMissionAsteroidField(parsed) {
    const missionId = DEFAULT_STARTER_MISSION_ID;
    const baseCharacterId = this.context.toNonEmptyString(parsed.characterId);
    const timestamp = this.context.getCurrentTimestamp();

    return Array.from({ length: STARTER_MISSION_ASTEROID_COUNT }, (_, index) => {
      const sequence = index + 1;
      const angle = (Math.PI * 2 * index) / STARTER_MISSION_ASTEROID_COUNT;
      const radiusKm = 250 + (index * 40);
      const materialProfile = STARTER_MISSION_ASTEROID_MATERIALS[index % STARTER_MISSION_ASTEROID_MATERIALS.length];
      const sourceScanId = `sample-a${sequence}`;

      return {
        id: `cb-${baseCharacterId}-${missionId}-a${sequence}`,
        catalogId: `FIRST-TARGET-A${sequence}`,
        solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
        sourceScanId,
        createdByCharacterId: baseCharacterId,
        missionId,
        missionInstanceId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        location: {
          positionKm: {
            x: Math.round(Math.cos(angle) * radiusKm),
            y: Math.round(Math.sin(angle) * radiusKm),
            z: Math.round((index - 4.5) * 12)
          }
        },
        kinematics: {
          velocityKmPerSec: {
            x: Number((Math.sin(angle) * 0.03).toFixed(4)),
            y: Number((Math.cos(angle) * 0.03).toFixed(4)),
            z: Number((((index % 3) - 1) * 0.005).toFixed(4))
          },
          angularVelocityRadPerSec: {
            x: Number((0.0008 + (index * 0.0001)).toFixed(6)),
            y: Number((0.001 + (index * 0.00008)).toFixed(6)),
            z: Number((0.0006 + (index * 0.00009)).toFixed(6))
          },
          estimatedMassKg: 22000000000 + (index * 3500000000),
          estimatedDiameterM: 110 + (index * 12)
        },
        composition: { ...materialProfile },
        state: STARTER_MISSION_ASTEROID_STATE
      };
    });
  }

  async ensureStarterMissionAsteroidsAsync(parsed) {
    if (parsed.missionId !== DEFAULT_STARTER_MISSION_ID) {
      return;
    }

    if (!STARTER_MISSION_ACTIVATION_STATUSES.has(parsed.status)) {
      return;
    }

    const existingField = await this.context.getCelestialBodiesAsync({
      createdByCharacterId: parsed.characterId,
      missionId: DEFAULT_STARTER_MISSION_ID
    });

    if (existingField.length > 0) {
      return;
    }

    const seededField = this.createStarterMissionAsteroidField(parsed);
    await Promise.all(
      seededField.map((celestialBody) => this.context.addOrUpdateCelestialBodyAsync(celestialBody))
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('add-mission-request', payload);

    if (!await this.context.hasValidSessionAsync(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = this.buildResponse(payload);

    if (response.success) {
      try {
        const existingMissions = await this.context.getMissionsAsync(
          payload?.playerName,
          payload?.characterId
        );
        const existingMission = existingMissions.find(
          (mission) => mission.missionId === response.mission.missionId
        );

        const missionWithTimestamps = this.enrichMissionTimestamps(
          response.mission,
          existingMission,
          this.context.getCurrentTimestamp()
        );

        await this.context.addOrUpdateMissionAsync(
          payload?.playerName,
          payload?.characterId,
          missionWithTimestamps
        );

        await this.ensureStarterMissionAsteroidsAsync({
          missionId: response.mission.missionId,
          status: response.mission.status,
          characterId: response.characterId
        });

        response.mission = { ...missionWithTimestamps };
      } catch (error) {
        this.context.log(`[mission-upsert-handler] Failed to upsert mission: ${error.message}`);
        response.success = false;
        response.message = 'Failed to record mission: database error';
        delete response.mission;
      }
    }

    socket.emit(MISSION_UPSERT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MissionUpsertMessageHandler
};
