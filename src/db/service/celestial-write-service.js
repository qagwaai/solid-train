'use strict';

const {
  SURFACE_ARCHETYPE_VALUES,
  hasValidBodyClassification,
  CELESTIAL_BODY_STATE_VALUES,
} = require('../../model/celestial-body-upsert');
const { validateOrbitalElements } = require('../../model/celestial-orbital-elements');
const { validateCelestialBody } = require('../../model/celestial-body-validation');
const { assertCatalogIdentity, CatalogIdentityError } = require('../../model/catalog-identity');
const {
  assertUniverseMetadata,
  assertUniverseRelationships,
} = require('../../model/celestial-universe-metadata');
const {
  mergeCelestialSeed,
  seedMongoUpdate,
  assertUniverseTransition,
} = require('../../model/celestial-seed-ownership');

async function reserveCatalogIdentity(CelestialBody, body) {
  assertCatalogIdentity(body);
  if (!body.catalogIdentity) return;
  const { namespace, key } = body.catalogIdentity;
  const scope = { solarSystemId: body.spatial.solarSystemId, namespace, key };
  const Assignment = CelestialBody.db.model('CatalogIdentityAssignment');
  await Assignment.init();
  let assignment;
  try {
    assignment = await Assignment.findOneAndUpdate(
      scope,
      { $setOnInsert: { catalogId: body.catalogId } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    ).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    assignment = await Assignment.findOne(scope).lean();
  }
  if (!assignment || assignment.catalogId !== body.catalogId) {
    throw new CatalogIdentityError(
      `Duplicate catalogIdentity ${namespace}/${key} for distinct curated sources in ${scope.solarSystemId}`
    );
  }
}

/**
 * Upsert celestial body by id, or by scan+creator+mission identity for mission-generated bodies.
 * @param {Object} ctx
 * @param {Object} CelestialBody
 * @param {Object} celestialBodyData
 * @returns {Promise<Object|null>}
 */
async function addOrUpdateCelestialBody(ctx, CelestialBody, celestialBodyData, options = {}) {
  try {
    if (
      !SURFACE_ARCHETYPE_VALUES.includes(ctx.toNonEmptyString(celestialBodyData?.surfaceArchetype))
    ) {
      throw new Error(
        `Celestial body surfaceArchetype must be one of: ${SURFACE_ARCHETYPE_VALUES.join(', ')}`
      );
    }

    const upsertQuery = ctx.toNonEmptyString(celestialBodyData?.id)
      ? { id: ctx.toNonEmptyString(celestialBodyData.id) }
      : {
          sourceScanId: ctx.toNonEmptyString(celestialBodyData?.sourceScanId),
          createdByCharacterId: ctx.toNonEmptyString(celestialBodyData?.createdByCharacterId),
          missionId: ctx.toNonEmptyString(celestialBodyData?.missionId),
        };

    if (!upsertQuery.id) {
      if (
        !upsertQuery.sourceScanId ||
        !upsertQuery.createdByCharacterId ||
        !upsertQuery.missionId
      ) {
        throw new Error(
          'Celestial body upsert requires id or sourceScanId+createdByCharacterId+missionId'
        );
      }
    }

    if (!hasValidBodyClassification(celestialBodyData)) {
      throw new Error(
        'Celestial body bodyType and surfaceArchetype must be a supported canonical pair'
      );
    }
    if (!CELESTIAL_BODY_STATE_VALUES.includes(celestialBodyData.state)) {
      throw new Error('Celestial body state is required');
    }
    if (!validateOrbitalElements(celestialBodyData.orbitalElements ?? null)) {
      throw new Error('Celestial body orbitalElements must be complete typed elliptic elements');
    }
    if (!celestialBodyData.spatial || !celestialBodyData.observability) {
      throw new Error('Celestial body spatial and observability are required');
    }
    if (celestialBodyData.state !== 'unscanned' && !celestialBodyData.composition) {
      throw new Error('Celestial body composition is required unless state is unscanned');
    }
    if (!validateCelestialBody(celestialBodyData)) {
      throw new Error(
        `Invalid canonical celestial body: ${JSON.stringify(validateCelestialBody.errors)}`
      );
    }
    const previousBody = await CelestialBody.findOne(upsertQuery).lean();
    if (options.preserveGameplay === true) {
      if (celestialBodyData.spatial.solarSystemId === 'sol') {
        throw new Error('Non-Sol seed ownership mode cannot modify Sol');
      }
      celestialBodyData = mergeCelestialSeed(previousBody, celestialBodyData);
    } else if (celestialBodyData.universeMetadata === undefined && previousBody?.universeMetadata) {
      celestialBodyData = { ...celestialBodyData, universeMetadata: previousBody.universeMetadata };
    }
    assertUniverseMetadata(celestialBodyData);
    assertUniverseTransition(previousBody, celestialBodyData);
    if (celestialBodyData.universeMetadata) {
      const existingBodies = await CelestialBody.find({
        'spatial.solarSystemId': celestialBodyData.spatial.solarSystemId,
      }).lean();
      assertUniverseRelationships([
        ...existingBodies.filter((body) => body.id !== celestialBodyData.id),
        celestialBodyData,
      ]);
    }
    if (celestialBodyData.catalogIdentity === undefined) {
      const previous = await CelestialBody.findOne(upsertQuery).lean();
      if (previous?.catalogIdentity !== undefined) {
        celestialBodyData = { ...celestialBodyData, catalogIdentity: previous.catalogIdentity };
      }
    }
    await reserveCatalogIdentity(CelestialBody, celestialBodyData);
    const update =
      options.preserveGameplay === true ? seedMongoUpdate(celestialBodyData) : celestialBodyData;
    const celestialBody = await CelestialBody.findOneAndUpdate(upsertQuery, update, {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
      runValidators: true,
    });
    return celestialBody ? celestialBody.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error adding/updating celestial body: ${error.message}`);
    throw error;
  }
}

/**
 * Delete a celestial body by logical id.
 * @param {Object} ctx
 * @param {Object} CelestialBody
 * @param {string} celestialBodyId
 * @returns {Promise<boolean>}
 */
async function deleteCelestialBodyById(ctx, CelestialBody, celestialBodyId) {
  try {
    if (!celestialBodyId || typeof celestialBodyId !== 'string') {
      return false;
    }

    const result = await CelestialBody.deleteOne({ id: celestialBodyId.trim() });
    return result.deletedCount > 0;
  } catch (error) {
    ctx.log(`[db-service] Error deleting celestial body by id: ${error.message}`);
    throw error;
  }
}

module.exports = {
  addOrUpdateCelestialBody,
  deleteCelestialBodyById,
  reserveCatalogIdentity,
};
