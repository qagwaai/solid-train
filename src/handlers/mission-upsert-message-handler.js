'use strict';

const { MISSION_UPSERT_RESPONSE_EVENT } = require('../model/mission-upsert');
const {
  DEFAULT_STARTER_MISSION_ID,
  MISSION_CATALOG_IDS,
  MISSION_CATALOG_ID_SET,
  MISSION_PREREQUISITES_BY_ID,
  MISSION_STATUS_VALUES,
  MISSION_UNLOCK_SOURCE_STATUSES,
} = require('../model/mission');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { DEFAULT_SOLAR_SYSTEM_ID } = require('../model/celestial-body-upsert');
const {
  resolveCorrelationId,
  normalizeRequestIdentity: normalizeCorrelationRequestIdentity,
} = require('./correlation-metadata');

const STARTER_MISSION_ASTEROID_STATE = 'unscanned';
const STARTER_MISSION_ASTEROID_COUNT = 10;
const STARTER_MISSION_ACTIVATION_STATUSES = new Set(['started', 'in-progress']);
const MISSION_STATUS_SET = new Set(MISSION_STATUS_VALUES);
const STARTER_MISSION_CLUSTER_ID = 'first-target-primary-cluster';
const STARTER_MISSION_CLUSTER_CENTER_KM = Object.freeze({ x: 0, y: 0, z: 0 });
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
  { rarity: 'Uncommon', material: 'Crystalline Quartz', textureColor: '#cfd8e6' },
];

class MissionUpsertMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeCorrelationRequestIdentity(
      {
        requestIdentity,
        operation: 'mission-upsert',
        entityTypeCandidates: ['mission'],
        containerIdCandidates: [payload?.characterId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  attachRequestId(response, payload) {
    const requestId = this.context.toNonEmptyString(payload?.requestId);
    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  formatMissionForResponse(mission) {
    const normalized = this.context.normalizeMission(mission);
    const responseMission = {
      missionId: normalized.missionId,
      status: normalized.status,
    };

    const optionalFields = [
      'startedAt',
      'inProgressAt',
      'failedAt',
      'completedAt',
      'updatedAt',
      'failureReason',
      'statusDetail',
    ];

    for (const field of optionalFields) {
      if (normalized[field] !== undefined) {
        responseMission[field] = normalized[field];
      }
    }

    return responseMission;
  }

  resolveUnlockedMissionIds(missionsById) {
    const unlocked = [];

    for (const missionId of MISSION_CATALOG_IDS) {
      if (missionsById.has(missionId)) {
        continue;
      }

      const prerequisites = MISSION_PREREQUISITES_BY_ID[missionId] || [];
      const allSatisfied = prerequisites.every((prerequisiteId) => {
        const prerequisite = missionsById.get(prerequisiteId);
        return prerequisite && MISSION_UNLOCK_SOURCE_STATUSES.has(prerequisite.status);
      });

      if (allSatisfied) {
        unlocked.push(missionId);
      }
    }

    return unlocked;
  }

  /**
   * Validate payload and produce canonical mission upsert response payload.
   * @param {Object} payload
   * @returns {Object}
   */
  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const missionId = this.context.toNonEmptyString(payload?.missionId);
    const status = this.context.toNonEmptyString(payload?.status);
    const statusDetail =
      typeof payload?.statusDetail === 'string' ? payload.statusDetail : undefined;

    if (!playerName || !characterId || !missionId || !status) {
      return this.attachRequestId(
        {
          success: false,
          message: 'playerName, characterId, missionId, and status are required',
          playerName,
          characterId,
        },
        payload
      );
    }

    if (!MISSION_CATALOG_ID_SET.has(missionId)) {
      return this.attachRequestId(
        {
          success: false,
          message: `missionId must be one of: ${MISSION_CATALOG_IDS.join(', ')}`,
          playerName,
          characterId,
        },
        payload
      );
    }

    if (!MISSION_STATUS_SET.has(status)) {
      return this.attachRequestId(
        {
          success: false,
          message: `status must be one of: ${MISSION_STATUS_VALUES.join(', ')}`,
          playerName,
          characterId,
        },
        payload
      );
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return this.attachRequestId(
        {
          success: false,
          message: 'Player is not registered',
          playerName,
          characterId,
        },
        payload
      );
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      return this.attachRequestId(
        {
          success: false,
          message: 'Character is not in player list',
          playerName: player.playerName,
          characterId,
        },
        payload
      );
    }

    return this.attachRequestId(
      {
        success: true,
        message: 'Mission recorded successfully',
        playerName: player.playerName,
        characterId,
        mission: {
          missionId,
          status,
          ...(statusDetail !== undefined ? { statusDetail } : {}),
        },
      },
      payload
    );
  }

  /**
   * Add status-specific timestamps while preserving existing milestone values.
   * @param {Object} mission
   * @param {Object|undefined} existingMission
   * @param {string} timestamp
   * @returns {Object}
   */
  enrichMissionTimestamps(mission, existingMission, timestamp) {
    const nextMission = {
      ...(existingMission || {}),
      ...mission,
      updatedAt: timestamp,
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

  async ensureUnlockedMissionsAsync(parsed) {
    if (!MISSION_UNLOCK_SOURCE_STATUSES.has(parsed.status)) {
      return;
    }

    const timestamp = this.context.getCurrentTimestamp();
    const missions = await this.context.getMissionsAsync(parsed.playerName, parsed.characterId);
    const missionsById = new Map(missions.map((mission) => [mission.missionId, mission]));

    const unlockedMissionIds = this.resolveUnlockedMissionIds(missionsById);
    for (const missionId of unlockedMissionIds) {
      const unlockedMission = {
        missionId,
        status: 'available',
        updatedAt: timestamp,
      };

      await this.context.addOrUpdateMissionAsync(
        parsed.playerName,
        parsed.characterId,
        unlockedMission
      );
      missionsById.set(missionId, unlockedMission);
    }
  }

  calculateDistanceKmFromOrigin(positionKm) {
    return Math.sqrt(
      positionKm.x * positionKm.x + positionKm.y * positionKm.y + positionKm.z * positionKm.z
    );
  }

  formatStarterAsteroidDisplayName(sequence) {
    return `First Target Asteroid ${sequence}`;
  }

  buildStarterAsteroidTextureKey(materialProfile) {
    const material = this.context
      .toNonEmptyString(materialProfile?.material)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return material ? `asteroid-${material}` : 'asteroid-generic';
  }

  createStarterMissionAsteroidField(parsed) {
    const missionId = DEFAULT_STARTER_MISSION_ID;
    const baseCharacterId = this.context.toNonEmptyString(parsed.characterId);
    const timestamp = this.context.getCurrentTimestamp();

    return Array.from({ length: STARTER_MISSION_ASTEROID_COUNT }, (_, index) => {
      const sequence = index + 1;
      const angle = (Math.PI * 2 * index) / STARTER_MISSION_ASTEROID_COUNT;
      const radiusKm = 250 + index * 40;
      const materialProfile =
        STARTER_MISSION_ASTEROID_MATERIALS[index % STARTER_MISSION_ASTEROID_MATERIALS.length];
      const sourceScanId = `sample-a${sequence}`;
      const positionKm = {
        x: Math.round(Math.cos(angle) * radiusKm),
        y: Math.round(Math.sin(angle) * radiusKm),
        z: Math.round((index - 4.5) * 12),
      };
      const localOffsetKm = {
        x: positionKm.x - STARTER_MISSION_CLUSTER_CENTER_KM.x,
        y: positionKm.y - STARTER_MISSION_CLUSTER_CENTER_KM.y,
        z: positionKm.z - STARTER_MISSION_CLUSTER_CENTER_KM.z,
      };
      const estimatedDiameterM = 110 + index * 12;
      const estimatedMassKg = 22000000000 + index * 3500000000;

      return {
        id: `cb-${baseCharacterId}-${missionId}-a${sequence}`,
        catalogId: `FIRST-TARGET-A${sequence}`,
        bodyType: 'asteroid',
        displayName: this.formatStarterAsteroidDisplayName(sequence),
        sourceScanId,
        createdByCharacterId: baseCharacterId,
        missionId,
        missionInstanceId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        spatial: {
          solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
          frame: 'barycentric',
          positionKm,
          epochMs: new Date(timestamp).getTime(),
        },
        clusterId: `${STARTER_MISSION_CLUSTER_ID}-${baseCharacterId}`,
        clusterCenterKm: { ...STARTER_MISSION_CLUSTER_CENTER_KM },
        localOffsetKm,
        distanceFromClusterCenterKm: Number(
          this.calculateDistanceKmFromOrigin(localOffsetKm).toFixed(3)
        ),
        motion: {
          velocityKmPerSec: {
            x: Number((Math.sin(angle) * 0.03).toFixed(4)),
            y: Number((Math.cos(angle) * 0.03).toFixed(4)),
            z: Number((((index % 3) - 1) * 0.005).toFixed(4)),
          },
          angularVelocityRadPerSec: {
            x: Number((0.0008 + index * 0.0001).toFixed(6)),
            y: Number((0.001 + index * 0.00008).toFixed(6)),
            z: Number((0.0006 + index * 0.00009).toFixed(6)),
          },
        },
        physical: {
          estimatedMassKg,
          estimatedDiameterM,
        },
        physicalCatalog: {
          estimatedMassKg,
          estimatedDiameterM,
          radiusKm: Number((estimatedDiameterM / 2000).toFixed(3)),
        },
        visualization: {
          colorHex: materialProfile.textureColor,
          textureKey: this.buildStarterAsteroidTextureKey(materialProfile),
        },
        observability: {
          visibility: 'visible',
          scanState: 'unscanned',
        },
        composition: { ...materialProfile },
        state: STARTER_MISSION_ASTEROID_STATE,
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
      missionId: DEFAULT_STARTER_MISSION_ID,
    });

    if (existingField.length > 0) {
      return;
    }

    const seededField = this.createStarterMissionAsteroidField(parsed);
    await Promise.all(
      seededField.map((celestialBody) => this.context.addOrUpdateCelestialBodyAsync(celestialBody))
    );
  }

  /**
   * Persist mission state, apply unlock side effects, and emit mission-upsert-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('add-mission-request', payload);
    const correlationId = resolveCorrelationId(
      payload,
      this.context.toNonEmptyString.bind(this.context)
    );
    const requestIdentity = this.normalizeRequestIdentity(payload?.requestIdentity, payload);

    const logCharacterShipInventorySnapshot = (phase, playerName, characterId) => {
      const character = this.context.findCharacter(playerName, characterId);
      const ships = Array.isArray(character?.ships) ? character.ships : [];
      const shipInventorySnapshots = ships.map((ship) => {
        const inventory = Array.isArray(ship?.inventory) ? ship.inventory : [];
        const inventoryItemIds = inventory
          .map((entry) => this.context.toNonEmptyString(entry?.itemId))
          .filter((value) => Boolean(value));
        const hullPatchItemIds = inventory
          .filter((entry) => this.context.toNonEmptyString(entry?.itemType) === 'hull-patch-kit')
          .map((entry) => this.context.toNonEmptyString(entry?.itemId))
          .filter((value) => Boolean(value));

        return {
          shipId: this.context.toNonEmptyString(ship?.id) || '-',
          inventoryItemIds,
          hullPatchItemIds,
        };
      });

      this.context.log(
        `[mission-upsert-diag] phase=${phase} correlationId=${correlationId} player=${this.context.toNonEmptyString(playerName) || '-'} characterId=${this.context.toNonEmptyString(characterId) || '-'} shipInventories=${JSON.stringify(shipInventorySnapshots)}`
      );
    };

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = this.buildResponse(payload);
    response.correlationId = correlationId;
    response.requestIdentity = requestIdentity;

    if (response.success) {
      try {
        logCharacterShipInventorySnapshot(
          'before-mission-upsert',
          payload?.playerName,
          payload?.characterId
        );

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

        // Primary mission write happens before unlock and starter-field side effects.
        await this.context.addOrUpdateMissionAsync(
          payload?.playerName,
          payload?.characterId,
          missionWithTimestamps
        );

        await this.ensureUnlockedMissionsAsync({
          playerName: payload?.playerName,
          characterId: payload?.characterId,
          missionId: response.mission.missionId,
          status: response.mission.status,
        });

        await this.ensureStarterMissionAsteroidsAsync({
          missionId: response.mission.missionId,
          status: response.mission.status,
          characterId: response.characterId,
        });

        logCharacterShipInventorySnapshot(
          'after-mission-upsert',
          payload?.playerName,
          payload?.characterId
        );

        response.mission = this.formatMissionForResponse(missionWithTimestamps);
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
  MissionUpsertMessageHandler,
};
