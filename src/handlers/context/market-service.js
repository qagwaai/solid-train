'use strict';

const {
  ITEM_STATE,
  ITEM_DAMAGE_STATUS,
  ITEM_CONTAINER_TYPE,
} = require('../../model/canonical-items');

const { MARKET_CATALOG_BY_ID } = require('../../model/market-catalog');
const { computeMidpointPrice } = require('../../model/market-pricing');
const {
  SOLAR_SYSTEM_MARKET_SEED_VERSION,
  buildSeededMarketsForSolarSystem,
} = require('../../model/solar-system-market-seed');
const {
  SHIP_MARKET_CATALOG_BY_ID,
  buildDefaultShipListings,
} = require('../../model/ship-market-catalog');

const DEFAULT_RESTOCK_INTERVAL_MINUTES = 60;
const ASTRONOMICAL_UNIT_KM = 149_597_870.7;

function getDefaultStockByRarity(rarity) {
  switch (rarity) {
    case 'Exotic':
      return 80;
    case 'Rare':
      return 260;
    case 'Uncommon':
      return 640;
    default:
      return 1200;
  }
}

function buildDefaultInventoryEntry(catalogEntry) {
  const maxStock = getDefaultStockByRarity(catalogEntry.rarity);

  return {
    itemId: catalogEntry.itemId,
    stock: maxStock,
    maxStock,
    restockPerInterval: Math.max(1, Math.round(maxStock * 0.08)),
    marketCanBuy: Boolean(catalogEntry.marketCanBuy),
    marketCanSell: Boolean(catalogEntry.marketCanSell),
  };
}

async function seedSolarSystemMarketsAsync(ctx, request = {}) {
  const solarSystemId = ctx.toNonEmptyString(request?.solarSystemId).toLowerCase() || 'sol';
  const asOf = ctx.toNonEmptyString(request?.asOf) || ctx.getCurrentTimestamp();
  const force = Boolean(request?.force);
  const seeded = buildSeededMarketsForSolarSystem(solarSystemId, asOf);

  if (seeded.length === 0) {
    return {
      success: false,
      reason: 'UNSUPPORTED_SOLAR_SYSTEM',
      solarSystemId,
      marketCount: 0,
    };
  }

  const payloads = seeded.map((market) => ctx.createSeedMarketPayload(market, asOf));

  if (!ctx.databaseService) {
    for (const market of payloads) {
      ctx.cacheMarket(market);
    }

    return {
      success: true,
      solarSystemId,
      seedVersion: SOLAR_SYSTEM_MARKET_SEED_VERSION,
      marketCount: payloads.length,
      source: 'in-memory',
    };
  }

  try {
    const existingSeedState =
      await ctx.databaseService.getSolarSystemMarketSeedState(solarSystemId);
    const isCurrentVersion =
      existingSeedState && existingSeedState.seedVersion === SOLAR_SYSTEM_MARKET_SEED_VERSION;

    if (!force && isCurrentVersion) {
      const persistedMarkets = await ctx.databaseService.getMarkets({ solarSystemId });
      if (Array.isArray(persistedMarkets) && persistedMarkets.length > 0) {
        const reseededMarkets = persistedMarkets.map((market) => ({
          ...market,
          shipListings: buildDefaultShipListings(asOf),
        }));

        for (const market of reseededMarkets) {
          await ctx.databaseService.upsertMarket(market);
          ctx.cacheMarket(market);
        }

        return {
          success: true,
          solarSystemId,
          seedVersion: SOLAR_SYSTEM_MARKET_SEED_VERSION,
          marketCount: reseededMarkets.length,
          source: 'database-reseed',
        };
      }
    }

    for (const market of payloads) {
      await ctx.databaseService.upsertMarket(market);
    }

    await ctx.databaseService.setSolarSystemMarketSeedState(
      solarSystemId,
      SOLAR_SYSTEM_MARKET_SEED_VERSION,
      asOf
    );

    const persistedMarkets = await ctx.databaseService.getMarkets({ solarSystemId });
    const marketsToCache = persistedMarkets.length > 0 ? persistedMarkets : payloads;
    for (const market of marketsToCache) {
      ctx.cacheMarket(market);
    }

    return {
      success: true,
      solarSystemId,
      seedVersion: SOLAR_SYSTEM_MARKET_SEED_VERSION,
      marketCount: marketsToCache.length,
      source: 'database-upsert',
    };
  } catch (error) {
    ctx.log(`[context] Error seeding solar system markets: ${error.message}`);

    for (const market of payloads) {
      ctx.cacheMarket(market);
    }

    return {
      success: true,
      solarSystemId,
      seedVersion: SOLAR_SYSTEM_MARKET_SEED_VERSION,
      marketCount: payloads.length,
      source: 'in-memory-fallback',
    };
  }
}

function applyMarketRestock(ctx, market, nowTimestamp) {
  const asOf = new Date(nowTimestamp);
  const lastRestock = new Date(market.lastRestockAt);
  if (Number.isNaN(asOf.getTime()) || Number.isNaN(lastRestock.getTime())) {
    market.lastRestockAt = ctx.getCurrentTimestamp();
    return market;
  }

  const elapsedMinutes = Math.floor((asOf.getTime() - lastRestock.getTime()) / (60 * 1000));
  const intervalMinutes = Math.max(1, market.restockIntervalMinutes);
  const intervals = Math.floor(elapsedMinutes / intervalMinutes);
  if (intervals <= 0) {
    return market;
  }

  market.inventory = market.inventory.map((entry) => ({
    ...entry,
    stock: Math.min(entry.maxStock, entry.stock + entry.restockPerInterval * intervals),
  }));

  const advancedAt = new Date(lastRestock.getTime() + intervals * intervalMinutes * 60 * 1000);
  market.lastRestockAt = advancedAt.toISOString();
  ctx.cacheMarket(market);
  return market;
}

async function getMarketsAsync(ctx, query = {}) {
  const normalizedSolarSystemId = ctx.toNonEmptyString(query?.solarSystemId).toLowerCase();
  const nowTimestamp = ctx.toNonEmptyString(query?.asOf) || ctx.getCurrentTimestamp();

  return Array.from(ctx.marketsByKey.values())
    .filter((market) => {
      if (!normalizedSolarSystemId) {
        return true;
      }

      const marketSolarSystemId = ctx.toNonEmptyString(market?.solarSystemId).toLowerCase();
      return marketSolarSystemId === normalizedSolarSystemId;
    })
    .map((market) => applyMarketRestock(ctx, { ...market }, nowTimestamp))
    .sort((left, right) => left.marketName.localeCompare(right.marketName));
}

async function getMarketsByLocationAsync(ctx, query = {}) {
  const solarSystemId = ctx.toNonEmptyString(query?.solarSystemId).toLowerCase();
  const positionKm = query?.positionKm;
  const distanceAu = query?.distanceAu;
  const asOf = ctx.toNonEmptyString(query?.asOf) || ctx.getCurrentTimestamp();
  const limit = Number.isInteger(query?.limit) && query.limit > 0 ? query.limit : null;
  const locationTypes = Array.isArray(query?.locationTypes)
    ? query.locationTypes
        .map((value) => ctx.toNonEmptyString(value).toLowerCase())
        .filter((value) => Boolean(value))
    : [];

  if (
    !solarSystemId ||
    !ctx.isTriple(positionKm) ||
    !ctx.isFiniteNumber(distanceAu) ||
    distanceAu < 0
  ) {
    return [];
  }

  const maxDistanceKm = distanceAu * ASTRONOMICAL_UNIT_KM;
  let systemMarkets = await getMarketsAsync(ctx, { solarSystemId, asOf });

  if (systemMarkets.length === 0) {
    const seededMarkets = buildSeededMarketsForSolarSystem(solarSystemId, asOf);
    if (seededMarkets.length > 0) {
      for (const seededMarket of seededMarkets) {
        ctx.cacheMarket(ctx.createSeedMarketPayload(seededMarket, asOf));
      }

      systemMarkets = await getMarketsAsync(ctx, { solarSystemId, asOf });
    }
  }

  const results = [];

  for (const market of systemMarkets) {
    const normalizedLocationType = ctx.inferMarketSiteType(market);
    if (locationTypes.length > 0 && !locationTypes.includes(normalizedLocationType)) {
      continue;
    }

    const marketPositionKm = await ctx.resolveMarketPositionKmAsync(market, asOf);
    const computedDistanceKm = ctx.calculateDistanceKm(positionKm, marketPositionKm);

    if (computedDistanceKm > maxDistanceKm) {
      continue;
    }

    const computedDistanceAu = parseFloat((computedDistanceKm / ASTRONOMICAL_UNIT_KM).toFixed(6));
    const epochMs = Date.parse(asOf);
    results.push({
      ...market,
      positionKm: marketPositionKm,
      spatial: {
        solarSystemId: market.solarSystemId,
        frame: 'barycentric',
        positionKm: marketPositionKm,
        epochMs: Number.isNaN(epochMs) ? 0 : epochMs,
      },
      _sortKey: 0,
      _sortSecondary: computedDistanceKm,
      distanceAu: computedDistanceAu,
      route: { kind: 'in-system' },
    });
  }

  const sorted = results.sort((a, b) => {
    if (a._sortKey !== b._sortKey) return a._sortKey - b._sortKey;
    return a._sortSecondary - b._sortSecondary;
  });
  const limited = limit ? sorted.slice(0, limit) : sorted;
  return limited.map(({ _sortKey: _k, _sortSecondary: _s, ...rest }) => rest);
}

async function getMarketQuoteAsync(ctx, request = {}) {
  const marketId = ctx.toNonEmptyString(request.marketId);
  const solarSystemId = ctx.toNonEmptyString(request.solarSystemId);
  const itemId = ctx.toNonEmptyString(request.itemId).toLowerCase();
  const direction = ctx.toNonEmptyString(request.direction).toLowerCase();
  const quantity = Number.isInteger(request.quantity) ? request.quantity : Number(request.quantity);
  const asOf = ctx.toNonEmptyString(request.asOf) || ctx.getCurrentTimestamp();

  const market = ctx.getMarket(marketId, solarSystemId);
  if (!market) {
    return { success: false, reason: 'MARKET_NOT_FOUND' };
  }

  const catalogEntry = MARKET_CATALOG_BY_ID.get(itemId);
  if (!catalogEntry) {
    return { success: false, reason: 'ITEM_NOT_FOUND' };
  }

  if (direction !== 'buy' && direction !== 'sell') {
    return { success: false, reason: 'INVALID_DIRECTION' };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, reason: 'INVALID_QUANTITY' };
  }

  const hydratedMarket = applyMarketRestock(ctx, { ...market }, asOf);
  const inventoryEntry = hydratedMarket.inventory.find((entry) => entry.itemId === itemId);
  if (!inventoryEntry || !inventoryEntry.marketCanSell) {
    return { success: false, reason: 'ITEM_NOT_TRADEABLE' };
  }

  if (direction === 'sell' && !inventoryEntry.marketCanBuy) {
    return { success: false, reason: 'MARKET_DOES_NOT_BUY_ITEM' };
  }

  const pricing = computeMidpointPrice({
    baseMidpointPrice: catalogEntry.baseMidpointPrice,
    marketMultiplier: hydratedMarket.priceMultiplier,
    marketId: hydratedMarket.marketId,
    itemId,
    timestamp: asOf,
    driftPercentPerHour: hydratedMarket.driftPercentPerHour,
  });

  return {
    success: true,
    quote: {
      marketId: hydratedMarket.marketId,
      solarSystemId: hydratedMarket.solarSystemId,
      itemId,
      itemType: catalogEntry.itemType,
      displayName: catalogEntry.displayName,
      rarity: catalogEntry.rarity,
      direction,
      quantity,
      unitPrice: pricing.midpointPrice,
      totalPrice: pricing.midpointPrice * quantity,
      availableStock: inventoryEntry.stock,
      marketCanBuy: inventoryEntry.marketCanBuy,
      marketCanSell: inventoryEntry.marketCanSell,
      marketMultiplier: hydratedMarket.priceMultiplier,
      driftMultiplier: pricing.driftMultiplier,
      quotedAt: asOf,
    },
  };
}

async function getMarketInventoryAsync(ctx, query = {}) {
  const marketId = ctx.toNonEmptyString(query?.marketId);
  const solarSystemId = ctx.toNonEmptyString(query?.solarSystemId);
  const offset = Number.isInteger(query?.offset) && query.offset >= 0 ? query.offset : 0;
  const limit = Number.isInteger(query?.limit) && query.limit > 0 ? query.limit : 50;
  const asOf = ctx.toNonEmptyString(query?.asOf) || ctx.getCurrentTimestamp();

  const market = ctx.getMarket(marketId, solarSystemId);
  if (!market) {
    return {
      success: false,
      reason: 'MARKET_NOT_FOUND',
      inventory: [],
      total: 0,
      offset,
      limit,
    };
  }

  const hydratedMarket = applyMarketRestock(ctx, { ...market }, asOf);
  const inventory = hydratedMarket.inventory
    .map((entry) => {
      const catalogEntry = MARKET_CATALOG_BY_ID.get(entry.itemId);
      if (!catalogEntry) {
        return null;
      }

      return {
        itemId: entry.itemId,
        itemType: catalogEntry.itemType,
        displayName: catalogEntry.displayName,
        rarity: catalogEntry.rarity,
        stock: entry.stock,
        maxStock: entry.maxStock,
        restockPerInterval: entry.restockPerInterval,
        marketCanBuy: entry.marketCanBuy,
        marketCanSell: entry.marketCanSell,
      };
    })
    .filter((entry) => Boolean(entry))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return {
    success: true,
    marketId: hydratedMarket.marketId,
    solarSystemId: hydratedMarket.solarSystemId,
    marketName: hydratedMarket.marketName,
    inventory: inventory.slice(offset, offset + limit),
    total: inventory.length,
    offset,
    limit,
    asOf,
  };
}

async function getMarketLedgerAsync(ctx, query = {}) {
  const marketId = ctx.toNonEmptyString(query?.marketId);
  const solarSystemId = ctx.toNonEmptyString(query?.solarSystemId);
  const characterId = ctx.toNonEmptyString(query?.characterId);
  const itemId = ctx.toNonEmptyString(query?.itemId).toLowerCase();
  const direction = ctx.toNonEmptyString(query?.direction).toLowerCase();
  const offset = Number.isInteger(query?.offset) && query.offset >= 0 ? query.offset : 0;
  const limit = Number.isInteger(query?.limit) && query.limit > 0 ? query.limit : 50;
  const startAt = ctx.toNonEmptyString(query?.startAt);
  const endAt = ctx.toNonEmptyString(query?.endAt);

  const market = ctx.getMarket(marketId, solarSystemId);
  if (!market) {
    return {
      success: false,
      reason: 'MARKET_NOT_FOUND',
      entries: [],
      total: 0,
      offset,
      limit,
    };
  }

  const startAtMs = startAt ? Date.parse(startAt) : Number.NEGATIVE_INFINITY;
  const endAtMs = endAt ? Date.parse(endAt) : Number.POSITIVE_INFINITY;

  const filtered = market.ledger
    .filter((entry) => {
      if (characterId && entry.characterId !== characterId) {
        return false;
      }
      if (itemId && entry.itemId !== itemId) {
        return false;
      }
      if (direction && entry.direction !== direction) {
        return false;
      }

      const timestampMs = Date.parse(entry.timestamp);
      if (!Number.isNaN(startAtMs) && timestampMs < startAtMs) {
        return false;
      }
      if (!Number.isNaN(endAtMs) && timestampMs > endAtMs) {
        return false;
      }
      return true;
    })
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

  return {
    success: true,
    marketId: market.marketId,
    solarSystemId: market.solarSystemId,
    entries: filtered.slice(offset, offset + limit),
    total: filtered.length,
    offset,
    limit,
  };
}

async function getCharacterTradeItemsAsync(ctx, playerName, characterId, itemId) {
  const character = ctx.findCharacter(playerName, characterId);
  if (!character) {
    return [];
  }

  const ships = Array.isArray(character.ships) ? character.ships : [];
  const containers = await Promise.all(
    ships.map((ship) =>
      ctx.getItemsByContainerAsync(ITEM_CONTAINER_TYPE.SHIP, ctx.toNonEmptyString(ship.id))
    )
  );

  return containers
    .flat()
    .map((item) => ctx.normalizeItem(item))
    .filter(
      (item) =>
        item.owningCharacterId === characterId &&
        item.state === ITEM_STATE.CONTAINED &&
        item.itemType === itemId
    );
}

async function applyMarketStockDeltaAsync(ctx, marketId, solarSystemId, itemId, delta) {
  const market = ctx.getMarket(marketId, solarSystemId);
  if (!market) {
    return false;
  }

  const nextMarket = ctx.normalizeMarket({ ...market });
  nextMarket.inventory = nextMarket.inventory.map((entry) => {
    if (entry.itemId !== itemId) {
      return entry;
    }

    const nextStock = Math.max(0, Math.min(entry.maxStock, entry.stock + delta));
    return {
      ...entry,
      stock: nextStock,
    };
  });

  ctx.cacheMarket(nextMarket);
  return true;
}

async function appendCharacterLedgerEntryAsync(ctx, playerName, characterId, entry) {
  const character = ctx.findCharacter(playerName, characterId);
  if (!character) {
    return false;
  }

  const creditLedger = Array.isArray(character.creditLedger) ? [...character.creditLedger] : [];
  creditLedger.push(ctx.normalizeCreditLedgerEntry(entry));
  await ctx.updateCharacterAsync(playerName, characterId, {
    creditLedger,
    credits: ctx.calculateCharacterCredits({ creditLedger }),
  });
  return true;
}

async function appendMarketLedgerEntryAsync(ctx, marketId, solarSystemId, entry) {
  const market = ctx.getMarket(marketId, solarSystemId);
  if (!market) {
    return false;
  }

  const nextMarket = ctx.normalizeMarket({ ...market });
  nextMarket.ledger = [...nextMarket.ledger, ctx.normalizeMarketLedgerEntry(entry)];
  ctx.cacheMarket(nextMarket);
  return true;
}

async function addTradeItemToCharacterAsync(ctx, player, character, itemId, quantity) {
  const normalizedItemId = ctx.toNonEmptyString(itemId).toLowerCase();
  const tradeItems = await getCharacterTradeItemsAsync(
    ctx,
    player.playerName,
    character.id,
    normalizedItemId
  );
  const now = ctx.getCurrentTimestamp();

  if (tradeItems.length > 0) {
    const target = tradeItems[0];
    await ctx.updateItemAsync(target.id, {
      quantity: target.quantity + quantity,
      updatedAt: now,
    });
    return true;
  }

  const ships = Array.isArray(character.ships) ? character.ships : [];
  const targetShipId = ctx.toNonEmptyString(ships[0]?.id);
  if (!targetShipId) {
    return false;
  }

  const catalogEntry = MARKET_CATALOG_BY_ID.get(normalizedItemId);
  const newItem = {
    id: `${character.id}-${normalizedItemId}-${ctx.createId()}`,
    itemType: normalizedItemId,
    displayName: catalogEntry?.displayName || normalizedItemId,
    state: ITEM_STATE.CONTAINED,
    damageStatus: ITEM_DAMAGE_STATUS.INTACT,
    container: {
      containerType: ITEM_CONTAINER_TYPE.SHIP,
      containerId: targetShipId,
    },
    owningPlayerId: ctx.toNonEmptyString(player.playerId),
    owningCharacterId: character.id,
    spatial: null,
    createdAt: now,
    updatedAt: now,
    destroyedAt: null,
    destroyedReason: null,
    launchable: false,
    quantity,
  };

  await ctx.addItemsAsync([newItem]);
  return true;
}

async function removeTradeItemFromCharacterAsync(ctx, playerName, characterId, itemId, quantity) {
  let remaining = quantity;
  const tradeItems = await getCharacterTradeItemsAsync(ctx, playerName, characterId, itemId);
  const normalizedItems = tradeItems.sort((left, right) => left.id.localeCompare(right.id));

  for (const item of normalizedItems) {
    if (remaining <= 0) {
      break;
    }

    if (item.quantity > remaining) {
      await ctx.updateItemAsync(item.id, {
        quantity: item.quantity - remaining,
        updatedAt: ctx.getCurrentTimestamp(),
      });
      remaining = 0;
      break;
    }

    remaining -= item.quantity;
    await ctx.syncShipInventoryReferenceForItemAsync(playerName, item, {
      ...item,
      container: null,
    });
    await ctx.deleteItemsAsync([item.id]);
  }

  return remaining === 0;
}

async function applyMarketShipListingAvailabilityAsync(
  ctx,
  marketId,
  solarSystemId,
  itemId,
  quantityAvailable,
  status
) {
  const market = ctx.getMarket(marketId, solarSystemId);
  if (!market) {
    return false;
  }

  const nextMarket = ctx.normalizeMarket({ ...market });
  const normalizedItemId = ctx.toNonEmptyString(itemId).toLowerCase();
  let listingFound = false;
  nextMarket.shipListings = (Array.isArray(nextMarket.shipListings) ? nextMarket.shipListings : []).map(
    (listing) => {
      if (ctx.toNonEmptyString(listing?.itemId).toLowerCase() !== normalizedItemId) {
        return listing;
      }

      listingFound = true;
      const normalizedQuantity =
        Number.isInteger(quantityAvailable) && quantityAvailable >= 0 ? quantityAvailable : 0;
      const normalizedStatus =
        ctx.toNonEmptyString(status).toLowerCase() === 'available' && normalizedQuantity > 0
          ? 'available'
          : 'sold';

      return {
        ...listing,
        quantityAvailable: normalizedQuantity,
        status: normalizedStatus,
      };
    }
  );

  if (!listingFound) {
    return false;
  }

  ctx.cacheMarket(nextMarket);
  return true;
}

async function addPurchasedShipToCharacterAsync(
  ctx,
  player,
  character,
  market,
  shipCatalogEntry,
  transactionId
) {
  const now = ctx.getCurrentTimestamp();
  const owningPlayerId = ctx.toNonEmptyString(player.playerId) || ctx.toNonEmptyString(player.playerName);
  const generatedShipId = `${character.id}-ship-${ctx.createId()}`;
  const starterInventory = Array.isArray(shipCatalogEntry?.starterInventory)
    ? shipCatalogEntry.starterInventory
    : [];

  const createdItems = starterInventory.map((entry, index) => ({
    id: `${generatedShipId}-starter-${ctx.toNonEmptyString(entry.itemType)}-${index + 1}`,
    itemType: ctx.toNonEmptyString(entry.itemType),
    displayName: ctx.toNonEmptyString(entry.displayName) || ctx.toNonEmptyString(entry.itemType),
    tier: Number.isInteger(entry.tier) && entry.tier > 0 ? entry.tier : 1,
    state: ITEM_STATE.CONTAINED,
    damageStatus: ITEM_DAMAGE_STATUS.INTACT,
    container: {
      containerType: ITEM_CONTAINER_TYPE.SHIP,
      containerId: generatedShipId,
    },
    owningPlayerId,
    owningCharacterId: character.id,
    spatial: null,
    createdAt: now,
    updatedAt: now,
    destroyedAt: null,
    destroyedReason: null,
    launchable: Boolean(entry.launchable),
    quantity: Number.isInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1,
  }));

  await ctx.addItemsAsync(createdItems);

  const marketPosition = ctx.normalizeSpatialState(market?.spatial) || {
    solarSystemId: market.solarSystemId,
    frame: 'barycentric',
    positionKm: { x: 0, y: 0, z: 0 },
    epochMs: Date.parse(now),
  };

  const createdShip = {
    id: generatedShipId,
    shipName: `${character.characterName} ${shipCatalogEntry.displayName}`,
    model: shipCatalogEntry.shipModel,
    tier: shipCatalogEntry.tier,
    status: 'docked',
    createdAt: now,
    inventory: createdItems.map((item) => ({
      itemId: item.id,
      itemType: item.itemType,
    })),
    spatial: {
      ...marketPosition,
      epochMs: Number.isFinite(Date.parse(now)) ? Date.parse(now) : marketPosition.epochMs,
    },
    launchable: true,
    damageProfile: null,
    ownership: {
      ownerType: 'player-character',
      playerId: owningPlayerId,
      characterId: character.id,
      npcId: null,
      factionId: null,
    },
    purchaseMetadata: {
      source: 'market-seeded-listing',
      marketId: market.marketId,
      solarSystemId: market.solarSystemId,
      transactionId,
      purchasedAt: now,
    },
  };

  const nextShips = Array.isArray(character.ships) ? [...character.ships, createdShip] : [createdShip];
  try {
    await ctx.updateCharacterAsync(player.playerName, character.id, { ships: nextShips });
  } catch (error) {
    await ctx.deleteItemsAsync(createdItems.map((item) => item.id));
    throw error;
  }

  return {
    ship: createdShip,
    itemIds: createdItems.map((item) => item.id),
  };
}

async function executeShipPurchaseTransactionAsync(ctx, request = {}, player, character) {
  const marketId = ctx.toNonEmptyString(request.marketId);
  const solarSystemId = ctx.toNonEmptyString(request.solarSystemId);
  const itemId = ctx.toNonEmptyString(request.itemId).toLowerCase();
  const quantity = Number.isInteger(request.quantity) ? request.quantity : Number(request.quantity);
  const requestId = ctx.toNonEmptyString(request.requestId) || null;

  if (!Number.isInteger(quantity) || quantity !== 1) {
    return { success: false, reason: 'INVALID_QUANTITY' };
  }

  const market = ctx.getMarket(marketId, solarSystemId);
  if (!market) {
    return { success: false, reason: 'MARKET_NOT_FOUND' };
  }

  const shipCatalogEntry = SHIP_MARKET_CATALOG_BY_ID.get(itemId);
  if (!shipCatalogEntry) {
    return { success: false, reason: 'ITEM_NOT_FOUND' };
  }

  const shipListings = Array.isArray(market.shipListings) ? market.shipListings : [];
  const listing = shipListings.find(
    (entry) =>
      ctx.toNonEmptyString(entry?.itemId).toLowerCase() === itemId &&
      ctx.toNonEmptyString(entry?.status).toLowerCase() === 'available' &&
      Number.isInteger(entry?.quantityAvailable) &&
      entry.quantityAvailable > 0
  );

  if (!listing) {
    return { success: false, reason: 'ITEM_NOT_TRADEABLE' };
  }

  const totalPrice = Number.isFinite(listing.unitPrice) ? listing.unitPrice : 0;
  if (ctx.calculateCharacterCredits(character) < totalPrice) {
    return { success: false, reason: 'INSUFFICIENT_CREDITS' };
  }

  const transactionId = ctx.toNonEmptyString(request.transactionId) || ctx.createId();
  const timestamp = ctx.getCurrentTimestamp();
  const characterLedgerEntry = {
    type: 'take',
    amount: totalPrice,
    description: `Market buy: ${shipCatalogEntry.displayName} x1`,
    timestamp,
    referenceId: transactionId,
  };
  const marketLedgerEntry = {
    transactionId,
    requestId,
    characterId: character.id,
    itemId,
    direction: 'buy',
    quantity: 1,
    unitPrice: totalPrice,
    totalPrice,
    timestamp,
    reversalOfTransactionId: null,
  };

  let listingApplied = false;
  let shipApplied = false;
  let characterLedgerApplied = false;
  let marketLedgerApplied = false;
  let createdShip = null;
  let createdItemIds = [];

  try {
    const listingUpdated = await applyMarketShipListingAvailabilityAsync(
      ctx,
      marketId,
      solarSystemId,
      itemId,
      0,
      'sold'
    );
    if (!listingUpdated) {
      throw new Error('Ship listing mutation failed');
    }
    listingApplied = true;

    const shipCreation = await addPurchasedShipToCharacterAsync(
      ctx,
      player,
      character,
      market,
      shipCatalogEntry,
      transactionId
    );
    createdShip = shipCreation.ship;
    createdItemIds = shipCreation.itemIds;
    shipApplied = true;

    await appendCharacterLedgerEntryAsync(
      ctx,
      player.playerName,
      character.id,
      characterLedgerEntry
    );
    characterLedgerApplied = true;

    await appendMarketLedgerEntryAsync(ctx, marketId, solarSystemId, marketLedgerEntry);
    marketLedgerApplied = true;

    const updatedCharacter = ctx.findCharacter(player.playerName, character.id);
    return {
      success: true,
      transaction: {
        transactionId,
        requestId,
        marketId,
        solarSystemId,
        characterId: character.id,
        itemId,
        direction: 'buy',
        quantity: 1,
        unitPrice: totalPrice,
        totalPrice,
        timestamp,
        characterCredits: updatedCharacter ? ctx.calculateCharacterCredits(updatedCharacter) : null,
        marketStock: 0,
        purchasedShip: {
          id: createdShip.id,
          shipName: createdShip.shipName,
          model: createdShip.model,
          tier: createdShip.tier,
          inventory: createdShip.inventory,
          ownership: createdShip.ownership,
        },
      },
    };
  } catch (error) {
    if (marketLedgerApplied) {
      await appendMarketLedgerEntryAsync(ctx, marketId, solarSystemId, {
        ...marketLedgerEntry,
        transactionId: ctx.createId(),
        direction: 'reversal',
        reversalOfTransactionId: transactionId,
        timestamp: ctx.getCurrentTimestamp(),
      });
    }

    if (characterLedgerApplied) {
      await appendCharacterLedgerEntryAsync(ctx, player.playerName, character.id, {
        type: 'put',
        amount: totalPrice,
        description: `Reversal for transaction ${transactionId}`,
        timestamp: ctx.getCurrentTimestamp(),
        referenceId: transactionId,
      });
    }

    if (shipApplied && createdShip) {
      const refreshedCharacter = ctx.findCharacter(player.playerName, character.id);
      const nextShips = Array.isArray(refreshedCharacter?.ships)
        ? refreshedCharacter.ships.filter((ship) => ship.id !== createdShip.id)
        : [];
      await ctx.updateCharacterAsync(player.playerName, character.id, { ships: nextShips });
      if (createdItemIds.length > 0) {
        await ctx.deleteItemsAsync(createdItemIds);
      }
    }

    if (listingApplied) {
      await applyMarketShipListingAvailabilityAsync(
        ctx,
        marketId,
        solarSystemId,
        itemId,
        1,
        'available'
      );
    }

    ctx.log(`[context] Ship market transaction failed: ${error.message}`);
    return {
      success: false,
      reason:
        characterLedgerApplied || marketLedgerApplied
          ? 'PARTIAL_WRITE_REVERSED'
          : 'TRANSACTION_FAILED',
    };
  }
}

async function executeMarketTransactionAsync(ctx, request = {}) {
  const playerName = ctx.toNonEmptyString(request.playerName);
  const characterId = ctx.toNonEmptyString(request.characterId);
  const marketId = ctx.toNonEmptyString(request.marketId);
  const solarSystemId = ctx.toNonEmptyString(request.solarSystemId);
  const itemId = ctx.toNonEmptyString(request.itemId).toLowerCase();
  const direction = ctx.toNonEmptyString(request.direction).toLowerCase();
  const quantity = Number.isInteger(request.quantity) ? request.quantity : Number(request.quantity);
  const requestId = ctx.toNonEmptyString(request.requestId) || null;

  const player = ctx.getPlayer(playerName);
  if (!player) {
    return { success: false, reason: 'PLAYER_NOT_REGISTERED' };
  }

  const character = ctx.findCharacter(player.playerName, characterId);
  if (!character) {
    return { success: false, reason: 'CHARACTER_NOT_FOUND' };
  }

  const isShipPurchase = direction === 'buy' && SHIP_MARKET_CATALOG_BY_ID.has(itemId);
  if (isShipPurchase) {
    return executeShipPurchaseTransactionAsync(ctx, request, player, character);
  }

  const quoteResult = await getMarketQuoteAsync(ctx, {
    marketId,
    solarSystemId,
    itemId,
    direction,
    quantity,
    asOf: ctx.getCurrentTimestamp(),
  });
  if (!quoteResult.success) {
    return quoteResult;
  }

  const quote = quoteResult.quote;
  if (direction === 'buy' && quote.availableStock < quantity) {
    return { success: false, reason: 'INSUFFICIENT_MARKET_STOCK' };
  }

  if (direction === 'buy' && ctx.calculateCharacterCredits(character) < quote.totalPrice) {
    return { success: false, reason: 'INSUFFICIENT_CREDITS' };
  }

  const ownedItems =
    direction === 'sell'
      ? await getCharacterTradeItemsAsync(ctx, player.playerName, character.id, itemId)
      : [];
  const ownedQuantity = ownedItems.reduce((total, item) => total + item.quantity, 0);
  if (direction === 'sell' && ownedQuantity < quantity) {
    return { success: false, reason: 'INSUFFICIENT_ITEM_QUANTITY' };
  }

  if (direction === 'buy') {
    const ships = Array.isArray(character.ships) ? character.ships : [];
    if (ships.length === 0) {
      return { success: false, reason: 'NO_SHIP_AVAILABLE' };
    }
  }

  const transactionId = ctx.toNonEmptyString(request.transactionId) || ctx.createId();
  const timestamp = ctx.getCurrentTimestamp();
  const characterLedgerEntry = {
    type: direction === 'buy' ? 'take' : 'put',
    amount: quote.totalPrice,
    description: `Market ${direction}: ${quote.displayName} x${quantity}`,
    timestamp,
    referenceId: transactionId,
  };
  const marketLedgerEntry = {
    transactionId,
    requestId,
    characterId,
    itemId,
    direction,
    quantity,
    unitPrice: quote.unitPrice,
    totalPrice: quote.totalPrice,
    timestamp,
    reversalOfTransactionId: null,
  };

  let stockApplied = false;
  let itemsApplied = false;
  let characterLedgerApplied = false;
  let marketLedgerApplied = false;

  try {
    await applyMarketStockDeltaAsync(
      ctx,
      marketId,
      solarSystemId,
      itemId,
      direction === 'buy' ? -quantity : quantity
    );
    stockApplied = true;

    if (direction === 'buy') {
      itemsApplied = await addTradeItemToCharacterAsync(ctx, player, character, itemId, quantity);
    } else {
      itemsApplied = await removeTradeItemFromCharacterAsync(
        ctx,
        player.playerName,
        character.id,
        itemId,
        quantity
      );
    }

    if (!itemsApplied) {
      throw new Error('Item mutation failed');
    }

    await appendCharacterLedgerEntryAsync(
      ctx,
      player.playerName,
      character.id,
      characterLedgerEntry
    );
    characterLedgerApplied = true;

    await appendMarketLedgerEntryAsync(ctx, marketId, solarSystemId, marketLedgerEntry);
    marketLedgerApplied = true;

    const updatedCharacter = ctx.findCharacter(player.playerName, character.id);
    const updatedMarket = ctx.getMarket(marketId, solarSystemId);
    const inventoryEntry =
      updatedMarket?.inventory?.find((entry) => entry.itemId === itemId) || null;

    return {
      success: true,
      transaction: {
        transactionId,
        requestId,
        marketId,
        solarSystemId,
        characterId,
        itemId,
        direction,
        quantity,
        unitPrice: quote.unitPrice,
        totalPrice: quote.totalPrice,
        timestamp,
        characterCredits: updatedCharacter ? ctx.calculateCharacterCredits(updatedCharacter) : null,
        marketStock: inventoryEntry?.stock ?? null,
      },
    };
  } catch (error) {
    if (stockApplied) {
      await applyMarketStockDeltaAsync(
        ctx,
        marketId,
        solarSystemId,
        itemId,
        direction === 'buy' ? quantity : -quantity
      );
    }

    if (characterLedgerApplied) {
      await appendCharacterLedgerEntryAsync(ctx, player.playerName, character.id, {
        type: direction === 'buy' ? 'put' : 'take',
        amount: quote.totalPrice,
        description: `Reversal for transaction ${transactionId}`,
        timestamp: ctx.getCurrentTimestamp(),
        referenceId: transactionId,
      });
    }

    if (marketLedgerApplied) {
      await appendMarketLedgerEntryAsync(ctx, marketId, solarSystemId, {
        ...marketLedgerEntry,
        transactionId: ctx.createId(),
        direction: 'reversal',
        reversalOfTransactionId: transactionId,
        timestamp: ctx.getCurrentTimestamp(),
      });
    }

    ctx.log(`[context] Market transaction failed: ${error.message}`);
    return {
      success: false,
      reason:
        characterLedgerApplied || marketLedgerApplied
          ? 'PARTIAL_WRITE_REVERSED'
          : 'TRANSACTION_FAILED',
    };
  }
}

module.exports = {
  seedSolarSystemMarketsAsync,
  applyMarketRestock,
  getMarketsAsync,
  getMarketsByLocationAsync,
  getMarketQuoteAsync,
  getMarketInventoryAsync,
  getMarketLedgerAsync,
  getCharacterTradeItemsAsync,
  applyMarketStockDeltaAsync,
  appendCharacterLedgerEntryAsync,
  appendMarketLedgerEntryAsync,
  addTradeItemToCharacterAsync,
  removeTradeItemFromCharacterAsync,
  executeMarketTransactionAsync,
  buildDefaultInventoryEntry,
  DEFAULT_RESTOCK_INTERVAL_MINUTES,
};
