'use strict';

/**
 * Read/query operations for globally persisted items.
 */

/**
 * Fetch items by ids.
 * @param {Object} ctx
 * @param {Object} Item
 * @param {string[]} itemIds
 * @returns {Promise<Object[]>}
 */
async function getItemsByIds(ctx, Item, itemIds) {
  try {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return [];
    }

    return await Item.find({ id: { $in: itemIds } }).lean();
  } catch (error) {
    ctx.log(`[db-service] Error fetching items: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch items currently assigned to a specific container.
 * @param {Object} ctx
 * @param {Object} Item
 * @param {string} containerType
 * @param {string} containerId
 * @returns {Promise<Object[]>}
 */
async function getItemsByContainer(ctx, Item, containerType, containerId) {
  try {
    return await Item.find({
      'container.containerType': containerType,
      'container.containerId': containerId,
    }).lean();
  } catch (error) {
    ctx.log(`[db-service] Error fetching items by container: ${error.message}`);
    throw error;
  }
}

/**
 * Find items within radius using DB bounds prefilter plus exact distance check.
 * @param {Object} ctx
 * @param {Object} Item
 * @param {{ solarSystemId?: string, positionKm?: Object, distanceKm?: number, itemType?: string }} query
 * @returns {Promise<Array<{ item: Object, distanceKm: number }>>}
 */
async function findItemsNearPosition(ctx, Item, query) {
  const solarSystemId = typeof query?.solarSystemId === 'string' ? query.solarSystemId.trim() : '';
  const positionKm = query?.positionKm;
  const distanceKm = query?.distanceKm;
  const itemType = typeof query?.itemType === 'string' ? query.itemType.trim() : '';

  if (
    !solarSystemId ||
    !ctx.isTriple(positionKm) ||
    !ctx.isFiniteNumber(distanceKm) ||
    distanceKm < 0
  ) {
    return [];
  }

  try {
    const boundsQuery = {
      state: 'deployed',
      'spatial.solarSystemId': solarSystemId,
      'spatial.positionKm.x': {
        $gte: positionKm.x - distanceKm,
        $lte: positionKm.x + distanceKm,
      },
      'spatial.positionKm.y': {
        $gte: positionKm.y - distanceKm,
        $lte: positionKm.y + distanceKm,
      },
      'spatial.positionKm.z': {
        $gte: positionKm.z - distanceKm,
        $lte: positionKm.z + distanceKm,
      },
    };

    if (itemType) {
      boundsQuery.itemType = itemType;
    }

    // Bounds query reduces candidate count before exact Euclidean distance filtering.
    const candidates = await Item.find(boundsQuery).lean();

    return candidates
      .map((item) => {
        const itemPositionKm = item?.spatial?.positionKm;
        if (!ctx.isTriple(itemPositionKm)) {
          return null;
        }

        const candidateDistanceKm = ctx.calculateDistanceKm(positionKm, itemPositionKm);
        if (candidateDistanceKm > distanceKm) {
          return null;
        }

        return {
          item,
          distanceKm: candidateDistanceKm,
        };
      })
      .filter((entry) => Boolean(entry))
      .sort((left, right) => left.distanceKm - right.distanceKm);
  } catch (error) {
    ctx.log(`[db-service] Error finding items near position: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getItemsByIds,
  getItemsByContainer,
  findItemsNearPosition,
};
