'use strict';

async function addOrUpdateCelestialBody(ctx, CelestialBody, celestialBodyData) {
  try {
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

    const celestialBody = await CelestialBody.findOneAndUpdate(upsertQuery, celestialBodyData, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    return celestialBody ? celestialBody.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error adding/updating celestial body: ${error.message}`);
    throw error;
  }
}

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
};
