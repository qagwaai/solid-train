'use strict';

const { buildBackfilledSubsystemItems } = require('./starter-subsystem-items');

async function persistBackfilledItemsAsync(ctx, backfilledItems) {
  const normalizedBackfilledItems = Array.isArray(backfilledItems)
    ? backfilledItems.filter((item) => Boolean(item?.id))
    : [];

  if (normalizedBackfilledItems.length === 0) {
    return;
  }

  for (const item of normalizedBackfilledItems) {
    ctx.itemsById.set(item.id, ctx.normalizeItem(item));
  }

  await ctx.withDbOrNull('persisting cold-boot starter subsystem items', (databaseService) =>
    databaseService.addItems(normalizedBackfilledItems)
  );
}

async function resolveShipContainerOwnerContextAsync(
  ctx,
  containerType,
  containerId,
  options = {}
) {
  if (containerType !== 'ship') {
    return {
      ship: null,
      owningPlayerId: ctx.toNonEmptyString(options.owningPlayerId) || null,
      owningCharacterId: ctx.toNonEmptyString(options.owningCharacterId) || null,
    };
  }

  const explicitShip = options.ship ? ctx.normalizeShip(options.ship) : null;
  if (explicitShip) {
    return {
      ship: explicitShip,
      owningPlayerId: ctx.toNonEmptyString(options.owningPlayerId) || null,
      owningCharacterId: ctx.toNonEmptyString(options.owningCharacterId) || null,
    };
  }

  const playerName = ctx.toNonEmptyString(options.playerName);
  if (!playerName) {
    return {
      ship: null,
      owningPlayerId: ctx.toNonEmptyString(options.owningPlayerId) || null,
      owningCharacterId: ctx.toNonEmptyString(options.owningCharacterId) || null,
    };
  }

  if (typeof ctx.databaseService?.getCharacters === 'function') {
    await ctx.getCharactersAsync(playerName);
  }
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  const player = ctx.getPlayer(playerName);
  const characters = ctx.getCharacters(normalizedPlayerName);

  for (const character of characters) {
    const ships = Array.isArray(character?.ships) ? character.ships : [];
    const matchingShip = ships.find((ship) => ctx.toNonEmptyString(ship?.id) === containerId);
    if (matchingShip) {
      return {
        ship: ctx.normalizeShip(matchingShip),
        owningPlayerId:
          ctx.toNonEmptyString(options.owningPlayerId) ||
          ctx.toNonEmptyString(player?.playerId) ||
          null,
        owningCharacterId:
          ctx.toNonEmptyString(options.owningCharacterId) ||
          ctx.toNonEmptyString(character?.id) ||
          null,
      };
    }
  }

  return {
    ship: null,
    owningPlayerId:
      ctx.toNonEmptyString(options.owningPlayerId) ||
      ctx.toNonEmptyString(player?.playerId) ||
      null,
    owningCharacterId: ctx.toNonEmptyString(options.owningCharacterId) || null,
  };
}

function getItem(ctx, itemId) {
  const normalizedItemId = ctx.toNonEmptyString(itemId);

  if (!normalizedItemId) {
    return null;
  }

  return ctx.itemsById.get(normalizedItemId) || null;
}

function cacheItems(ctx, items) {
  const normalizedItems = Array.isArray(items)
    ? items.map((item) => ctx.normalizeItem(item)).filter((item) => Boolean(item.id))
    : [];

  for (const item of normalizedItems) {
    ctx.itemsById.set(item.id, item);
  }

  return normalizedItems;
}

async function getItemsByIdsAsync(ctx, itemIds) {
  const normalizedItemIds = Array.isArray(itemIds)
    ? itemIds.map((itemId) => ctx.toNonEmptyString(itemId)).filter((itemId) => Boolean(itemId))
    : [];

  if (normalizedItemIds.length === 0) {
    return [];
  }

  const cachedById = new Map(
    normalizedItemIds
      .map((itemId) => [itemId, getItem(ctx, itemId)])
      .filter(([, item]) => Boolean(item))
      .map(([itemId, item]) => [itemId, ctx.normalizeItem(item)])
  );

  const itemsFromDb = await ctx.withDbOrNull('fetching items from DB', (databaseService) =>
    databaseService.getItemsByIds(normalizedItemIds)
  );

  if (Array.isArray(itemsFromDb)) {
    const dbItems = cacheItems(ctx, itemsFromDb);
    for (const item of dbItems) {
      cachedById.set(item.id, item);
    }
  }

  return normalizedItemIds
    .map((itemId) => cachedById.get(itemId) || null)
    .filter((item) => Boolean(item))
    .map((item) => ctx.normalizeItem(item));
}

async function addItemsAsync(ctx, items) {
  const normalizedItems = cacheItems(ctx, items);

  const createdHullPatchItems = normalizedItems.filter(
    (item) => ctx.toNonEmptyString(item?.itemType) === 'hull-patch-kit'
  );
  if (createdHullPatchItems.length > 0) {
    ctx.log(
      `[item-lifecycle-diag] hull-patch-kit-created ids=${createdHullPatchItems.map((item) => item.id).join(',')} owningCharacterIds=${createdHullPatchItems.map((item) => ctx.toNonEmptyString(item.owningCharacterId) || '-').join(',')} containerIds=${createdHullPatchItems.map((item) => ctx.toNonEmptyString(item?.container?.containerId) || 'null').join(',')}`
    );
  }

  try {
    await ctx.withDb('adding items in DB', (databaseService) =>
      databaseService.addItems(normalizedItems)
    );
  } catch (error) {
    for (const item of normalizedItems) {
      ctx.itemsById.delete(item.id);
    }
    throw error;
  }

  return normalizedItems;
}

async function deleteItemsAsync(ctx, itemIds) {
  const normalizedItemIds = Array.isArray(itemIds)
    ? itemIds.map((itemId) => ctx.toNonEmptyString(itemId)).filter((itemId) => Boolean(itemId))
    : [];

  if (normalizedItemIds.length === 0) {
    return;
  }

  await ctx.withDb('deleting items in DB', (databaseService) =>
    databaseService.deleteItemsByIds(normalizedItemIds)
  );

  for (const itemId of normalizedItemIds) {
    ctx.itemsById.delete(itemId);
  }
}

async function updateItemAsync(ctx, itemId, updates) {
  const normalizedItemId = ctx.toNonEmptyString(itemId);
  if (!normalizedItemId) {
    return null;
  }

  const existing = getItem(ctx, normalizedItemId);
  if (!existing) {
    return null;
  }

  const updatedItem = ctx.normalizeItem({ ...existing, ...updates });
  ctx.itemsById.set(normalizedItemId, updatedItem);

  if (ctx.toNonEmptyString(updatedItem?.itemType) === 'hull-patch-kit') {
    ctx.log(
      `[item-lifecycle-diag] hull-patch-kit-updated id=${updatedItem.id} state=${ctx.toNonEmptyString(updatedItem.state) || '-'} damageStatus=${ctx.toNonEmptyString(updatedItem.damageStatus) || '-'} containerType=${ctx.toNonEmptyString(updatedItem?.container?.containerType) || 'null'} containerId=${ctx.toNonEmptyString(updatedItem?.container?.containerId) || 'null'} destroyedReason=${ctx.toNonEmptyString(updatedItem.destroyedReason) || 'null'}`
    );
  }

  await ctx.withDbOrNull('updating item in DB', (databaseService) =>
    databaseService.updateItemById(normalizedItemId, updatedItem)
  );

  return updatedItem;
}

async function getItemsByContainerAsync(ctx, containerType, containerId, options = {}) {
  const normalizedContainerType = ctx.toNonEmptyString(containerType);
  const normalizedContainerId = ctx.toNonEmptyString(containerId);

  if (!normalizedContainerType || !normalizedContainerId) {
    return [];
  }

  const cachedMatches = [...ctx.itemsById.values()].filter(
    (item) =>
      item.container?.containerType === normalizedContainerType &&
      item.container?.containerId === normalizedContainerId
  );

  const itemsFromDb = await ctx.withDbOrNull(
    'fetching items by container from DB',
    (databaseService) =>
      databaseService.getItemsByContainer(normalizedContainerType, normalizedContainerId)
  );

  if (Array.isArray(itemsFromDb)) {
    const dbItems = cacheItems(ctx, itemsFromDb);
    const dbHullPatchItems = dbItems.filter(
      (item) => ctx.toNonEmptyString(item?.itemType) === 'hull-patch-kit'
    );
    if (dbHullPatchItems.length > 0) {
      ctx.log(
        `[item-lifecycle-diag] hull-patch-kit-fetched-by-container containerType=${normalizedContainerType} containerId=${normalizedContainerId} ids=${dbHullPatchItems.map((item) => item.id).join(',')} states=${dbHullPatchItems.map((item) => ctx.toNonEmptyString(item.state) || '-').join(',')}`
      );
    }
    const mergedById = new Map();

    for (const item of cachedMatches) {
      mergedById.set(item.id, ctx.normalizeItem(item));
    }

    for (const item of dbItems) {
      mergedById.set(item.id, item);
    }

    const ownerContext = await resolveShipContainerOwnerContextAsync(
      ctx,
      normalizedContainerType,
      normalizedContainerId,
      options
    );
    const backfilledItems = ownerContext.ship
      ? buildBackfilledSubsystemItems(ctx, ownerContext.ship, [...mergedById.values()], {
          owningPlayerId: ownerContext.owningPlayerId,
          owningCharacterId: ownerContext.owningCharacterId,
          playerName: options.playerName,
          characterId: options.characterId,
        })
      : [];

    await persistBackfilledItemsAsync(ctx, backfilledItems);

    for (const item of backfilledItems) {
      mergedById.set(item.id, item);
    }

    return [...mergedById.values()];
  }

  const normalizedCachedMatches = cachedMatches.map((item) => ctx.normalizeItem(item));
  const ownerContext = await resolveShipContainerOwnerContextAsync(
    ctx,
    normalizedContainerType,
    normalizedContainerId,
    options
  );
  const backfilledItems = ownerContext.ship
    ? buildBackfilledSubsystemItems(ctx, ownerContext.ship, normalizedCachedMatches, {
        owningPlayerId: ownerContext.owningPlayerId,
        owningCharacterId: ownerContext.owningCharacterId,
        playerName: options.playerName,
        characterId: options.characterId,
      })
    : [];

  await persistBackfilledItemsAsync(ctx, backfilledItems);

  return [...normalizedCachedMatches, ...backfilledItems];
}

async function syncShipInventoryReferenceForItemAsync(
  ctx,
  playerName,
  previousItem,
  nextItem,
  options = {}
) {
  const isCharacterVersionConflictError = (error) => {
    const message = ctx.toNonEmptyString(error?.message).toLowerCase();
    if (!message) {
      return false;
    }

    return message.includes('no matching document found') && message.includes('version');
  };

  const computeNextShips = (ships, characterId, shouldAttachToShip, nextShipId, nextItem) => {
    let changed = false;
    const nextShips = ships.map((ship) => {
      const inventory = Array.isArray(ship.inventory) ? ship.inventory : [];
      const filteredInventory = inventory.filter((entry) => entry?.itemId !== nextItem.id);
      const wasRemoved = filteredInventory.length !== inventory.length;

      let nextInventory = filteredInventory;
      if (
        shouldAttachToShip &&
        characterId === nextItem.owningCharacterId &&
        ship.id === nextShipId
      ) {
        nextInventory = [
          ...filteredInventory,
          {
            itemId: nextItem.id,
            itemType: nextItem.itemType,
          },
        ];
      }

      if (wasRemoved || nextInventory.length !== inventory.length) {
        changed = true;
        return {
          ...ship,
          inventory: nextInventory,
        };
      }

      return ship;
    });

    return { nextShips, changed };
  };

  const canonicalPlayerName = ctx.toNonEmptyString(playerName);
  const correlationId = ctx.toNonEmptyString(options?.correlationId) || '-';
  if (!canonicalPlayerName || !nextItem?.id) {
    return;
  }

  await ctx.getCharactersAsync(canonicalPlayerName);

  const normalizedPreviousCharacterId = ctx.toNonEmptyString(previousItem?.owningCharacterId);
  const normalizedNextCharacterId = ctx.toNonEmptyString(nextItem?.owningCharacterId);
  const normalizedNextItemType = ctx.toNonEmptyString(nextItem?.itemType);
  const normalizedNextShipId = ctx.toNonEmptyString(nextItem?.container?.containerId);
  const shouldAttachToShip =
    ctx.toNonEmptyString(nextItem?.container?.containerType) === 'ship' &&
    Boolean(normalizedNextShipId) &&
    Boolean(normalizedNextCharacterId) &&
    Boolean(normalizedNextItemType);

  const candidateCharacterIds = new Set(
    [normalizedPreviousCharacterId, normalizedNextCharacterId].filter((value) => Boolean(value))
  );

  for (const characterId of candidateCharacterIds) {
    let attemptsUsed = 0;
    let attemptsRemaining = 2;

    while (attemptsRemaining > 0) {
      attemptsUsed += 1;
      const character = ctx.findCharacter(canonicalPlayerName, characterId);
      if (!character) {
        break;
      }

      const ships = Array.isArray(character.ships) ? character.ships : [];
      const { nextShips, changed } = computeNextShips(
        ships,
        characterId,
        shouldAttachToShip,
        normalizedNextShipId,
        {
          id: nextItem.id,
          itemType: normalizedNextItemType,
          owningCharacterId: normalizedNextCharacterId,
        }
      );

      if (!changed) {
        break;
      }

      try {
        await ctx.updateCharacterAsync(
          canonicalPlayerName,
          characterId,
          {
            ships: nextShips,
          },
          {
            correlationId,
          }
        );

        if (attemptsUsed > 1) {
          ctx.log(
            `[inventory-sync] recovered correlationId=${correlationId} player=${canonicalPlayerName} characterId=${characterId} itemId=${nextItem.id} attempts=${attemptsUsed}`
          );
        }
        break;
      } catch (error) {
        attemptsRemaining -= 1;
        if (isCharacterVersionConflictError(error)) {
          if (attemptsRemaining > 0) {
            ctx.log(
              `[inventory-sync] version-conflict correlationId=${correlationId} player=${canonicalPlayerName} characterId=${characterId} itemId=${nextItem.id} action=retry attemptsUsed=${attemptsUsed} error=${error.message}`
            );
            await ctx.getCharactersAsync(canonicalPlayerName);
            continue;
          }

          // Avoid failing item lifecycle operations when only embedded ship refs race.
          ctx.log(
            `[inventory-sync] version-conflict correlationId=${correlationId} player=${canonicalPlayerName} characterId=${characterId} itemId=${nextItem.id} action=skip-final-sync`
          );
          break;
        }

        throw error;
      }
    }
  }
}

async function getItemsNearPositionAsync(ctx, query) {
  const solarSystemId = ctx.toNonEmptyString(query?.solarSystemId);
  const positionKm = query?.positionKm;
  const distanceKm = query?.distanceKm;
  const itemType = ctx.toNonEmptyString(query?.itemType);
  const limit = query?.limit;

  if (
    !solarSystemId ||
    !ctx.isTriple(positionKm) ||
    !ctx.isFiniteNumber(distanceKm) ||
    distanceKm < 0
  ) {
    return [];
  }

  let results = [];

  const cacheResults = Array.from(ctx.itemsById.values())
    .map((item) => ctx.normalizeItem(item))
    .filter((item) => {
      if (item.state !== 'deployed') {
        return false;
      }

      if (item.spatial?.solarSystemId !== solarSystemId) {
        return false;
      }

      if (itemType && item.itemType !== itemType) {
        return false;
      }

      return true;
    })
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
    .filter((entry) => Boolean(entry));

  const fromDb = await ctx.withDbOrNull('finding items from DB', (databaseService) =>
    databaseService.findItemsNearPosition({
      solarSystemId,
      positionKm,
      distanceKm,
      itemType: itemType || undefined,
    })
  );

  if (Array.isArray(fromDb)) {
    const fromDbResults = fromDb.map((entry) => {
      const normalizedItem = ctx.normalizeItem(entry.item);
      ctx.itemsById.set(normalizedItem.id, normalizedItem);
      return {
        item: normalizedItem,
        distanceKm: entry.distanceKm,
      };
    });

    const mergedById = new Map();
    for (const entry of cacheResults) {
      mergedById.set(entry.item.id, entry);
    }
    for (const entry of fromDbResults) {
      mergedById.set(entry.item.id, entry);
    }

    results = [...mergedById.values()].sort((left, right) => left.distanceKm - right.distanceKm);
  } else {
    results = cacheResults.sort((left, right) => left.distanceKm - right.distanceKm);
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    return results;
  }

  return results.slice(0, limit);
}

module.exports = {
  getItem,
  cacheItems,
  getItemsByIdsAsync,
  addItemsAsync,
  deleteItemsAsync,
  updateItemAsync,
  getItemsByContainerAsync,
  syncShipInventoryReferenceForItemAsync,
  getItemsNearPositionAsync,
};
