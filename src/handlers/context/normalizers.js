'use strict';

const { getItemByType } = require('../../model/canonical-items');
const {
  assertCanonicalRuntimeItemType,
} = require('../../model/canonical-item-type-registry');

const ALWAYS_LAUNCHABLE_ITEM_TYPES = new Set(['expendable-dart-drone']);

const { MARKET_CATALOG, MARKET_CATALOG_BY_ID } = require('../../model/market-catalog');

const SUPPORTED_LOCALES = new Set(['en', 'it']);
const DEFAULT_RESTOCK_INTERVAL_MINUTES = 60;

function toPlainObject(_ctx, value) {
  if (value && typeof value.toObject === 'function') {
    return value.toObject();
  }

  return value;
}

function isFiniteNumber(_ctx, value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTriple(ctx, value) {
  return (
    Boolean(value) &&
    isFiniteNumber(ctx, value.x) &&
    isFiniteNumber(ctx, value.y) &&
    isFiniteNumber(ctx, value.z)
  );
}

function normalizeTriple(ctx, value) {
  if (!isTriple(ctx, value)) {
    return null;
  }

  return {
    x: value.x,
    y: value.y,
    z: value.z,
  };
}

function toNonEmptyString(_ctx, value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeLocale(ctx, value) {
  const raw = toNonEmptyString(ctx, value).toLowerCase();
  if (!raw) {
    return 'en';
  }

  const base = raw.split('-')[0];
  return SUPPORTED_LOCALES.has(base) ? base : 'en';
}

function normalizePlayerName(ctx, value) {
  const playerName = toNonEmptyString(ctx, value);

  if (!playerName) {
    return '';
  }

  return playerName.toLowerCase();
}

// ============ Market Normalizers ============

function normalizeMarketOrbit(ctx, value) {
  const source = toPlainObject(ctx, value);
  if (!source || typeof source !== 'object') {
    return null;
  }

  const hasOrbitInput = Boolean(
    toNonEmptyString(ctx, source.anchorBodyId) ||
    toNonEmptyString(ctx, source.anchorBodyName) ||
    toNonEmptyString(ctx, source.orbitType) ||
    isFiniteNumber(ctx, source.semiMajorAxisKm) ||
    isFiniteNumber(ctx, source.eccentricity) ||
    isFiniteNumber(ctx, source.inclinationDeg) ||
    isFiniteNumber(ctx, source.longitudeOfAscendingNodeDeg) ||
    isFiniteNumber(ctx, source.argumentOfPeriapsisDeg) ||
    isFiniteNumber(ctx, source.meanAnomalyAtEpochDeg) ||
    isFiniteNumber(ctx, source.orbitalPeriodSec) ||
    toNonEmptyString(ctx, source.epoch)
  );

  if (!hasOrbitInput) {
    return null;
  }

  return {
    anchorBodyId: toNonEmptyString(ctx, source.anchorBodyId),
    anchorBodyName: toNonEmptyString(ctx, source.anchorBodyName),
    orbitType: toNonEmptyString(ctx, source.orbitType) || 'elliptical',
    semiMajorAxisKm: isFiniteNumber(ctx, source.semiMajorAxisKm) ? source.semiMajorAxisKm : 0,
    eccentricity: isFiniteNumber(ctx, source.eccentricity) ? source.eccentricity : 0,
    inclinationDeg: isFiniteNumber(ctx, source.inclinationDeg) ? source.inclinationDeg : 0,
    longitudeOfAscendingNodeDeg: isFiniteNumber(ctx, source.longitudeOfAscendingNodeDeg)
      ? source.longitudeOfAscendingNodeDeg
      : 0,
    argumentOfPeriapsisDeg: isFiniteNumber(ctx, source.argumentOfPeriapsisDeg)
      ? source.argumentOfPeriapsisDeg
      : 0,
    meanAnomalyAtEpochDeg: isFiniteNumber(ctx, source.meanAnomalyAtEpochDeg)
      ? source.meanAnomalyAtEpochDeg
      : 0,
    orbitalPeriodSec: isFiniteNumber(ctx, source.orbitalPeriodSec) ? source.orbitalPeriodSec : 0,
    epoch: toNonEmptyString(ctx, source.epoch) || ctx.getCurrentTimestamp(),
  };
}

function normalizeSpatialState(ctx, value) {
  const source = toPlainObject(ctx, value) || {};
  const solarSystemId = toNonEmptyString(ctx, source.solarSystemId);
  const frame = toNonEmptyString(ctx, source.frame) || 'barycentric';
  const positionKm = normalizeTriple(ctx, source.positionKm);
  const epochMs = isFiniteNumber(ctx, source.epochMs) ? source.epochMs : 0;

  if (!solarSystemId || frame !== 'barycentric' || !positionKm) {
    return null;
  }

  return {
    solarSystemId,
    frame: 'barycentric',
    positionKm,
    epochMs,
  };
}

function normalizeMotionState(ctx, value) {
  if (!value) {
    return null;
  }

  const source = toPlainObject(ctx, value);
  const velocityKmPerSec = normalizeTriple(ctx, source.velocityKmPerSec);
  const angularVelocityRadPerSec = normalizeTriple(ctx, source.angularVelocityRadPerSec);

  if (!velocityKmPerSec) {
    return null;
  }

  return {
    velocityKmPerSec,
    ...(angularVelocityRadPerSec ? { angularVelocityRadPerSec } : {}),
  };
}

function normalizePhysicalState(ctx, value) {
  if (!value) {
    return null;
  }

  const source = toPlainObject(ctx, value);
  const estimatedMassKg = isFiniteNumber(ctx, source.estimatedMassKg)
    ? source.estimatedMassKg
    : undefined;
  const estimatedDiameterM = isFiniteNumber(ctx, source.estimatedDiameterM)
    ? source.estimatedDiameterM
    : undefined;

  if (estimatedMassKg === undefined && estimatedDiameterM === undefined) {
    return null;
  }

  return {
    ...(estimatedMassKg !== undefined ? { estimatedMassKg } : {}),
    ...(estimatedDiameterM !== undefined ? { estimatedDiameterM } : {}),
  };
}

function normalizeObservabilityState(ctx, value) {
  const source = toPlainObject(ctx, value) || {};
  const visibility = toNonEmptyString(ctx, source.visibility);
  const scanState = toNonEmptyString(ctx, source.scanState);

  return {
    visibility: ['visible', 'not-visible', 'cloaked'].includes(visibility)
      ? visibility
      : 'not-visible',
    scanState: ['unscanned', 'scanned'].includes(scanState) ? scanState : 'unscanned',
  };
}

function normalizeTrajectoryDescriptor(ctx, value) {
  if (!value) {
    return null;
  }

  const source = toPlainObject(ctx, value);
  const kind = toNonEmptyString(ctx, source.kind);

  if (!['static', 'orbital-elements'].includes(kind)) {
    return null;
  }

  const trajectory = {
    kind,
  };

  if (kind === 'orbital-elements' && source.orbit) {
    const orbit = normalizeMarketOrbit(ctx, source.orbit);
    if (orbit) {
      trajectory.orbit = orbit;
    }
  }

  return trajectory;
}

function normalizeMarketSiteTypeValue(ctx, value) {
  const normalized = toNonEmptyString(ctx, value).toLowerCase();
  if (!normalized) {
    return '';
  }

  if (
    normalized === 'station' ||
    normalized === 'surface-settlement' ||
    normalized === 'free-floating'
  ) {
    return normalized;
  }

  if (normalized.includes('station') || normalized.includes('orbital')) {
    return 'station';
  }

  if (normalized.includes('surface') || normalized.includes('settlement')) {
    return 'surface-settlement';
  }

  if (normalized.includes('free') || normalized.includes('belt') || normalized.includes('drift')) {
    return 'free-floating';
  }

  return '';
}

function inferMarketSiteType(ctx, source) {
  const explicit = normalizeMarketSiteTypeValue(ctx, source.siteType);
  if (explicit) {
    return explicit;
  }

  const marketId = toNonEmptyString(ctx, source.marketId).toLowerCase();
  const marketName = toNonEmptyString(ctx, source.marketName).toLowerCase();
  const siteName = toNonEmptyString(ctx, source.siteName).toLowerCase();

  const combined = `${marketId} ${marketName} ${siteName}`;
  if (combined.includes('belt') || combined.includes('drift')) {
    return 'free-floating';
  }

  if (combined.includes('surface') || combined.includes('settlement')) {
    return 'surface-settlement';
  }

  return 'station';
}

function normalizeMarketInventoryEntry(ctx, entry) {
  const source = toPlainObject(ctx, entry) || {};
  const catalogEntry = MARKET_CATALOG_BY_ID.get(toNonEmptyString(ctx, source.itemId));
  const defaults = catalogEntry
    ? getDefaultInventoryEntry(catalogEntry)
    : {
        itemId: toNonEmptyString(ctx, source.itemId),
        stock: 0,
        maxStock: 0,
        restockPerInterval: 0,
        marketCanBuy: false,
        marketCanSell: false,
      };

  return {
    itemId: defaults.itemId,
    stock: Number.isInteger(source.stock) && source.stock >= 0 ? source.stock : defaults.stock,
    maxStock:
      Number.isInteger(source.maxStock) && source.maxStock >= 0
        ? source.maxStock
        : defaults.maxStock,
    restockPerInterval:
      Number.isInteger(source.restockPerInterval) && source.restockPerInterval >= 0
        ? source.restockPerInterval
        : defaults.restockPerInterval,
    marketCanBuy:
      source.marketCanBuy != null ? Boolean(source.marketCanBuy) : defaults.marketCanBuy,
    marketCanSell:
      source.marketCanSell != null ? Boolean(source.marketCanSell) : defaults.marketCanSell,
  };
}

function normalizeMarketLedgerEntry(ctx, entry) {
  const source = toPlainObject(ctx, entry) || {};

  return {
    transactionId: toNonEmptyString(ctx, source.transactionId),
    requestId: toNonEmptyString(ctx, source.requestId) || null,
    characterId: toNonEmptyString(ctx, source.characterId),
    itemId: toNonEmptyString(ctx, source.itemId),
    direction: toNonEmptyString(ctx, source.direction),
    quantity: Number.isInteger(source.quantity) ? source.quantity : 0,
    unitPrice: Number.isInteger(source.unitPrice) ? source.unitPrice : 0,
    totalPrice: Number.isInteger(source.totalPrice) ? source.totalPrice : 0,
    timestamp: toNonEmptyString(ctx, source.timestamp),
    reversalOfTransactionId: toNonEmptyString(ctx, source.reversalOfTransactionId) || null,
  };
}

function normalizeMarketShipListingStarterInventoryEntry(ctx, entry) {
  const source = toPlainObject(ctx, entry) || {};
  const itemType = toNonEmptyString(ctx, source.itemType);
  const displayName = toNonEmptyString(ctx, source.displayName) || itemType;
  const quantity = Number.isInteger(source.quantity) && source.quantity > 0 ? source.quantity : 1;

  if (!itemType) {
    return null;
  }

  return {
    itemType,
    displayName,
    tier: Number.isInteger(source.tier) && source.tier > 0 ? source.tier : 1,
    quantity,
    launchable: Boolean(source.launchable),
  };
}

function normalizeMarketShipListingEntry(ctx, entry) {
  const source = toPlainObject(ctx, entry) || {};
  const itemId = toNonEmptyString(ctx, source.itemId).toLowerCase();
  const shipModel = toNonEmptyString(ctx, source.shipModel);
  const displayName = toNonEmptyString(ctx, source.displayName) || shipModel;

  if (!itemId || !shipModel) {
    return null;
  }

  const starterInventory = Array.isArray(source.starterInventory)
    ? source.starterInventory
        .map((inventoryEntry) => normalizeMarketShipListingStarterInventoryEntry(ctx, inventoryEntry))
        .filter((inventoryEntry) => Boolean(inventoryEntry))
    : [];

  return {
    listingId: toNonEmptyString(ctx, source.listingId) || `seed-ship-${itemId}`,
    itemId,
    shipModel,
    displayName,
    tier: Number.isInteger(source.tier) && source.tier > 0 ? source.tier : 1,
    unitPrice: isFiniteNumber(ctx, source.unitPrice) && source.unitPrice > 0 ? source.unitPrice : 0,
    quantityAvailable:
      Number.isInteger(source.quantityAvailable) && source.quantityAvailable >= 0
        ? source.quantityAvailable
        : 0,
    status:
      toNonEmptyString(ctx, source.status).toLowerCase() === 'available' &&
      Number.isInteger(source.quantityAvailable) &&
      source.quantityAvailable > 0
        ? 'available'
        : 'sold',
    starterInventory,
    createdAt: toNonEmptyString(ctx, source.createdAt) || ctx.getCurrentTimestamp(),
  };
}

function normalizeMarket(ctx, market) {
  const source = toPlainObject(ctx, market) || {};
  const marketId = toNonEmptyString(ctx, source.marketId);
  const solarSystemId = toNonEmptyString(ctx, source.solarSystemId).toLowerCase();
  const spatial = normalizeSpatialState(ctx, source.spatial);
  const trajectory = normalizeTrajectoryDescriptor(ctx, source.trajectory);
  const rawInventory = Array.isArray(source.inventory)
    ? source.inventory
    : MARKET_CATALOG.map((catalogEntry) => getDefaultInventoryEntry(catalogEntry));
  const inventory = rawInventory
    .map((entry) => normalizeMarketInventoryEntry(ctx, entry))
    .filter((entry) => Boolean(entry.itemId));
  const ledger = Array.isArray(source.ledger)
    ? source.ledger.map((entry) => normalizeMarketLedgerEntry(ctx, entry))
    : [];
  const shipListings = Array.isArray(source.shipListings)
    ? source.shipListings
        .map((entry) => normalizeMarketShipListingEntry(ctx, entry))
        .filter((entry) => Boolean(entry))
    : [];

  const result = {
    marketId,
    solarSystemId,
    marketName: toNonEmptyString(ctx, source.marketName),
    siteType: inferMarketSiteType(ctx, source),
    siteName: toNonEmptyString(ctx, source.siteName) || toNonEmptyString(ctx, source.marketName),
    isStarterMarket: Boolean(source.isStarterMarket),
    priceMultiplier:
      isFiniteNumber(ctx, source.priceMultiplier) && source.priceMultiplier > 0
        ? source.priceMultiplier
        : 1,
    driftPercentPerHour:
      isFiniteNumber(ctx, source.driftPercentPerHour) && source.driftPercentPerHour >= 0
        ? source.driftPercentPerHour
        : 0,
    restockIntervalMinutes:
      Number.isInteger(source.restockIntervalMinutes) && source.restockIntervalMinutes > 0
        ? source.restockIntervalMinutes
        : DEFAULT_RESTOCK_INTERVAL_MINUTES,
    lastRestockAt: toNonEmptyString(ctx, source.lastRestockAt) || ctx.getCurrentTimestamp(),
    inventory,
    ledger,
    shipListings,
  };

  if (spatial) {
    result.spatial = spatial;
  }

  if (trajectory) {
    result.trajectory = trajectory;
  }

  return result;
}

// ============ Item & Ship Normalizers ============

function normalizeInventoryItemReference(ctx, reference) {
  const source = toPlainObject(ctx, reference) || {};
  const itemId = toNonEmptyString(ctx, source.itemId);
  const itemType = toNonEmptyString(ctx, source.itemType);

  if (!itemId || !itemType) {
    return null;
  }

  return {
    itemId,
    itemType,
  };
}

function normalizeDriveProfile(ctx, profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const id = toNonEmptyString(ctx, profile.id);
  const name = toNonEmptyString(ctx, profile.name);
  const rangeAu = profile.rangeAu;
  const cruiseSpeedAuPerHour = profile.cruiseSpeedAuPerHour;
  const fuelCostPerAu = profile.fuelCostPerAu;

  if (
    !id ||
    !name ||
    typeof rangeAu !== 'number' ||
    !Number.isFinite(rangeAu) ||
    rangeAu <= 0 ||
    typeof cruiseSpeedAuPerHour !== 'number' ||
    !Number.isFinite(cruiseSpeedAuPerHour) ||
    cruiseSpeedAuPerHour <= 0 ||
    typeof fuelCostPerAu !== 'number' ||
    !Number.isFinite(fuelCostPerAu) ||
    fuelCostPerAu <= 0
  ) {
    ctx.log('[normalizeShip] driveProfile failed validation; omitting field');
    return null;
  }

  return { id, name, rangeAu, cruiseSpeedAuPerHour, fuelCostPerAu };
}

function normalizeShip(ctx, ship) {
  const source = toPlainObject(ctx, ship) || {};
  const shipName = toNonEmptyString(ctx, source.name) || toNonEmptyString(ctx, source.shipName);
  const inventory = Array.isArray(source.inventory)
    ? source.inventory
        .map((entry) => normalizeInventoryItemReference(ctx, entry))
        .filter((entry) => Boolean(entry))
    : [];

  const spatial = normalizeSpatialState(ctx, source.spatial);
  const motion = normalizeMotionState(ctx, source.motion);

  // If still no spatial, this is an error
  if (!spatial) {
    throw new Error(
      "Ship: spatial state is required. Provide spatial with solarSystemId, frame:'barycentric', positionKm, and epochMs."
    );
  }

  const ownershipSource =
    source.ownership && typeof source.ownership === 'object' ? source.ownership : null;
  let ownership = ownershipSource
    ? {
        ownerType: toNonEmptyString(ctx, ownershipSource.ownerType),
        playerId: toNonEmptyString(ctx, ownershipSource.playerId) || null,
        characterId: toNonEmptyString(ctx, ownershipSource.characterId) || null,
        npcId: toNonEmptyString(ctx, ownershipSource.npcId) || null,
        factionId: toNonEmptyString(ctx, ownershipSource.factionId) || null,
      }
    : null;

  // Backfill canonical ownership from legacy owningPlayerId/owningCharacterId fields
  if (!ownership) {
    const legacyPlayerId = toNonEmptyString(ctx, source.owningPlayerId) || null;
    const legacyCharacterId = toNonEmptyString(ctx, source.owningCharacterId) || null;
    if (legacyPlayerId && legacyCharacterId) {
      ownership = {
        ownerType: 'player-character',
        playerId: legacyPlayerId,
        characterId: legacyCharacterId,
        npcId: null,
        factionId: null,
      };
    }
  }

  return {
    id: toNonEmptyString(ctx, source.id),
    name: shipName || source.name || source.shipName || '',
    status: toNonEmptyString(ctx, source.status) || null,
    model: toNonEmptyString(ctx, source.model) || 'Scavenger Pod',
    tier: Number.isInteger(source.tier) && source.tier >= 1 && source.tier <= 10 ? source.tier : 1,
    createdAt: toNonEmptyString(ctx, source.createdAt),
    inventory,
    spatial,
    ...(motion ? { motion } : {}),
    launchable: source.launchable != null ? Boolean(source.launchable) : true,
    damageProfile: source.damageProfile != null ? source.damageProfile : null,
    ...(ownership ? { ownership } : {}),
    ...(normalizeDriveProfile(ctx, source.driveProfile) !== null
      ? { driveProfile: normalizeDriveProfile(ctx, source.driveProfile) }
      : {}),
  };
}

function convertLegacyItemKinematics(ctx, kinematics) {
  if (!kinematics || typeof kinematics !== 'object') {
    return { spatial: null, motion: null };
  }

  const reference = kinematics.reference || {};
  const solarSystemId = toNonEmptyString(ctx, reference.solarSystemId);
  const positionKm = normalizeTriple(ctx, kinematics.position);
  const epochMs = isFiniteNumber(ctx, reference.epochMs) ? reference.epochMs : null;

  const spatial =
    solarSystemId && positionKm && epochMs !== null
      ? {
          solarSystemId,
          frame: 'barycentric',
          positionKm,
          epochMs,
        }
      : null;

  const velocityKmPerSec = normalizeTriple(ctx, kinematics.velocity);
  const motion = velocityKmPerSec ? { velocityKmPerSec } : null;

  return { spatial, motion };
}

function normalizeItem(ctx, item) {
  const source = toPlainObject(ctx, item) || {};
  const itemType = toNonEmptyString(ctx, source.itemType);
  assertCanonicalRuntimeItemType(itemType);
  const canonicalItem = itemType ? getItemByType(itemType) : null;

  if (!canonicalItem) {
    throw new Error(`Unsupported runtime item type: ${itemType || '(missing itemType)'}`);
  }

  if (!Number.isInteger(canonicalItem.tier) || canonicalItem.tier < 1) {
    throw new Error(`Canonical item tier is missing for itemType: ${itemType}`);
  }

  const normalizedTier =
    Number.isInteger(source.tier) && source.tier >= 1 && source.tier <= 20
      ? source.tier
      : canonicalItem.tier;

  const normalizedContainer = source.container
    ? {
        containerType: toNonEmptyString(ctx, source.container.containerType),
        containerId: toNonEmptyString(ctx, source.container.containerId),
      }
    : null;

  let spatial = normalizeSpatialState(ctx, source.spatial);
  let motion = normalizeMotionState(ctx, source.motion);

  if (!spatial && source.kinematics) {
    const converted = convertLegacyItemKinematics(ctx, source.kinematics);
    spatial = spatial || converted.spatial;
    motion = motion || converted.motion;
  }

  const { kinematics: _legacyKinematics, ...rest } = source;
  const launchable = ALWAYS_LAUNCHABLE_ITEM_TYPES.has(itemType)
    ? true
    : source.launchable != null
      ? Boolean(source.launchable)
      : canonicalItem.launchable != null
        ? Boolean(canonicalItem.launchable)
        : true;

  return {
    ...rest,
    id: toNonEmptyString(ctx, source.id),
    itemType,
    displayName: toNonEmptyString(ctx, source.displayName),
    tier: normalizedTier,
    state: toNonEmptyString(ctx, source.state),
    damageStatus: toNonEmptyString(ctx, source.damageStatus),
    container: normalizedContainer,
    owningPlayerId: toNonEmptyString(ctx, source.owningPlayerId),
    owningCharacterId: toNonEmptyString(ctx, source.owningCharacterId),
    ownership: (() => {
      if (source.ownership && typeof source.ownership === 'object') {
        return {
          ownerType: toNonEmptyString(ctx, source.ownership.ownerType),
          playerId: toNonEmptyString(ctx, source.ownership.playerId) || null,
          characterId: toNonEmptyString(ctx, source.ownership.characterId) || null,
          npcId: toNonEmptyString(ctx, source.ownership.npcId) || null,
          factionId: toNonEmptyString(ctx, source.ownership.factionId) || null,
        };
      }
      const legacyPlayerId = toNonEmptyString(ctx, source.owningPlayerId) || null;
      const legacyCharacterId = toNonEmptyString(ctx, source.owningCharacterId) || null;
      if (legacyPlayerId && legacyCharacterId) {
        return {
          ownerType: 'player-character',
          playerId: legacyPlayerId,
          characterId: legacyCharacterId,
          npcId: null,
          factionId: null,
        };
      }
      return null;
    })(),
    spatial,
    ...(motion ? { motion } : {}),
    createdAt: toNonEmptyString(ctx, source.createdAt),
    updatedAt: toNonEmptyString(ctx, source.updatedAt),
    destroyedAt: toNonEmptyString(ctx, source.destroyedAt) || null,
    destroyedReason: toNonEmptyString(ctx, source.destroyedReason) || null,
    launchable,
    quantity: Number.isInteger(source.quantity) && source.quantity > 0 ? source.quantity : 1,
  };
}

// ============ Character & Mission Normalizers ============

function normalizeCreditLedgerEntry(ctx, entry) {
  const source = toPlainObject(ctx, entry) || {};

  return {
    type: toNonEmptyString(ctx, source.type),
    amount: typeof source.amount === 'number' ? source.amount : 0,
    description: toNonEmptyString(ctx, source.description),
    timestamp: toNonEmptyString(ctx, source.timestamp),
    referenceId: toNonEmptyString(ctx, source.referenceId) || null,
  };
}

function calculateCharacterCredits(ctx, character) {
  const source = toPlainObject(ctx, character) || {};
  const creditLedger = Array.isArray(source.creditLedger)
    ? source.creditLedger.map((entry) => normalizeCreditLedgerEntry(ctx, entry))
    : [];

  return creditLedger.reduce((total, entry) => {
    return entry.type === 'put' ? total + entry.amount : total - entry.amount;
  }, 0);
}

function normalizeMission(ctx, mission) {
  const source = toPlainObject(ctx, mission) || {};

  return {
    ...source,
    missionId: toNonEmptyString(ctx, source.missionId),
    status: toNonEmptyString(ctx, source.status),
    updatedAt: toNonEmptyString(ctx, source.updatedAt) || undefined,
  };
}

function normalizeCharacter(ctx, character) {
  const source = toPlainObject(ctx, character) || {};
  const characterName =
    toNonEmptyString(ctx, source.characterName) || toNonEmptyString(ctx, source.name);
  const ships = Array.isArray(source.ships)
    ? source.ships.map((ship) => normalizeShip(ctx, ship))
    : [];
  const missions = Array.isArray(source.missions)
    ? source.missions.map((mission) => normalizeMission(ctx, mission))
    : [];
  const creditLedger = Array.isArray(source.creditLedger)
    ? source.creditLedger.map((entry) => normalizeCreditLedgerEntry(ctx, entry))
    : [];
  const credits = creditLedger.reduce((total, entry) => {
    return entry.type === 'put' ? total + entry.amount : total - entry.amount;
  }, 0);

  return {
    ...source,
    characterName: characterName || source.characterName || source.name || '',
    ships,
    missions,
    creditLedger,
    credits,
  };
}

// ============ Celestial Body Normalizer ============

function normalizeCelestialBody(ctx, celestialBody) {
  const source = toPlainObject(ctx, celestialBody) || {};

  const spatial = normalizeSpatialState(ctx, source.spatial);
  const motion = normalizeMotionState(ctx, source.motion);
  const physical = normalizePhysicalState(ctx, source.physical);
  const clusterCenterKm = normalizeTriple(ctx, source.clusterCenterKm);
  const localOffsetKm = normalizeTriple(ctx, source.localOffsetKm);

  if (!spatial) {
    throw new Error(
      "CelestialBody: spatial state is required. Provide spatial with solarSystemId, frame:'barycentric', positionKm, and epochMs."
    );
  }

  const observability = normalizeObservabilityState(ctx, source.observability);

  return {
    id: toNonEmptyString(ctx, source.id),
    catalogId: toNonEmptyString(ctx, source.catalogId),
    sourceScanId: toNonEmptyString(ctx, source.sourceScanId),
    createdByCharacterId: toNonEmptyString(ctx, source.createdByCharacterId),
    missionId: toNonEmptyString(ctx, source.missionId) || null,
    missionInstanceId: toNonEmptyString(ctx, source.missionInstanceId) || null,
    createdAt: toNonEmptyString(ctx, source.createdAt),
    updatedAt: toNonEmptyString(ctx, source.updatedAt),
    spatial,
    ...(motion ? { motion } : {}),
    ...(physical ? { physical } : {}),
    observability,
    composition: source.composition
      ? {
          rarity: toNonEmptyString(ctx, source.composition.rarity),
          material: toNonEmptyString(ctx, source.composition.material),
          textureColor: toNonEmptyString(ctx, source.composition.textureColor),
        }
      : null,
    ...(source.externalObjectDescriptor
      ? {
          externalObjectDescriptor: {
            descriptorId: toNonEmptyString(ctx, source.externalObjectDescriptor.descriptorId),
            schemaVersion: toNonEmptyString(ctx, source.externalObjectDescriptor.schemaVersion),
            domain: toNonEmptyString(ctx, source.externalObjectDescriptor.domain),
            objectFamily: toNonEmptyString(ctx, source.externalObjectDescriptor.objectFamily),
            roleCue: toNonEmptyString(ctx, source.externalObjectDescriptor.roleCue),
            factionCue: toNonEmptyString(ctx, source.externalObjectDescriptor.factionCue),
            fallbackTier: toNonEmptyString(ctx, source.externalObjectDescriptor.fallbackTier),
            displayLabel: toNonEmptyString(ctx, source.externalObjectDescriptor.displayLabel),
            silhouetteProfile: toNonEmptyString(ctx, source.externalObjectDescriptor.silhouetteProfile),
            materialProfile: toNonEmptyString(ctx, source.externalObjectDescriptor.materialProfile),
            emissiveProfile: toNonEmptyString(ctx, source.externalObjectDescriptor.emissiveProfile),
          },
        }
      : {}),
    state: toNonEmptyString(ctx, source.state) || 'active',
    destroyedAt: toNonEmptyString(ctx, source.destroyedAt) || null,
    destroyedReason: toNonEmptyString(ctx, source.destroyedReason) || null,
    debrisSeed: Number.isInteger(source.debrisSeed) ? source.debrisSeed : null,
    debris: Array.isArray(source.debris)
      ? source.debris.map((entry) => ({
          material: toNonEmptyString(ctx, entry?.material),
          rarity: toNonEmptyString(ctx, entry?.rarity),
          quantity: Number.isInteger(entry?.quantity) && entry.quantity > 0 ? entry.quantity : 1,
          itemType: toNonEmptyString(ctx, entry?.itemType),
          ...(entry?.externalObjectDescriptor
            ? {
                externalObjectDescriptor: {
                  descriptorId: toNonEmptyString(ctx, entry.externalObjectDescriptor.descriptorId),
                  schemaVersion: toNonEmptyString(ctx, entry.externalObjectDescriptor.schemaVersion),
                  domain: toNonEmptyString(ctx, entry.externalObjectDescriptor.domain),
                  objectFamily: toNonEmptyString(ctx, entry.externalObjectDescriptor.objectFamily),
                  roleCue: toNonEmptyString(ctx, entry.externalObjectDescriptor.roleCue),
                  factionCue: toNonEmptyString(ctx, entry.externalObjectDescriptor.factionCue),
                  fallbackTier: toNonEmptyString(ctx, entry.externalObjectDescriptor.fallbackTier),
                  displayLabel: toNonEmptyString(ctx, entry.externalObjectDescriptor.displayLabel),
                  silhouetteProfile: toNonEmptyString(ctx, entry.externalObjectDescriptor.silhouetteProfile),
                  materialProfile: toNonEmptyString(ctx, entry.externalObjectDescriptor.materialProfile),
                  emissiveProfile: toNonEmptyString(ctx, entry.externalObjectDescriptor.emissiveProfile),
                },
              }
            : {}),
        }))
      : [],
    ...(source.bodyType ? { bodyType: toNonEmptyString(ctx, source.bodyType) } : {}),
    ...(source.displayName ? { displayName: toNonEmptyString(ctx, source.displayName) } : {}),
    ...(source.parentBodyId !== undefined
      ? { parentBodyId: toNonEmptyString(ctx, source.parentBodyId) || null }
      : {}),
    ...(source.orbitalElements ? { orbitalElements: source.orbitalElements } : {}),
    ...(source.physicalCatalog ? { physicalCatalog: source.physicalCatalog } : {}),
    ...(source.atmosphere ? { atmosphere: source.atmosphere } : {}),
    ...(source.discovery ? { discovery: source.discovery } : {}),
    ...(source.magnitudes ? { magnitudes: source.magnitudes } : {}),
    ...(source.planetType ? { planetType: toNonEmptyString(ctx, source.planetType) } : {}),
    ...(source.hygId ? { hygId: toNonEmptyString(ctx, source.hygId) } : {}),
    ...(source.visualization
      ? {
          visualization: {
            ...(source.visualization.colorHex
              ? { colorHex: toNonEmptyString(ctx, source.visualization.colorHex) }
              : {}),
            ...(source.visualization.spectralClass
              ? { spectralClass: toNonEmptyString(ctx, source.visualization.spectralClass) }
              : {}),
            ...(source.visualization.textureKey
              ? { textureKey: toNonEmptyString(ctx, source.visualization.textureKey) }
              : {}),
          },
        }
      : {}),
    ...(source.clusterId ? { clusterId: toNonEmptyString(ctx, source.clusterId) } : {}),
    ...(clusterCenterKm ? { clusterCenterKm } : {}),
    ...(localOffsetKm ? { localOffsetKm } : {}),
    ...(isFiniteNumber(ctx, source.distanceFromClusterCenterKm)
      ? { distanceFromClusterCenterKm: source.distanceFromClusterCenterKm }
      : {}),
    ...(source.isCatalogBody ? { isCatalogBody: true } : {}),
  };
}

// ============ Helpers ============

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

function getDefaultInventoryEntry(catalogEntry) {
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

module.exports = {
  toPlainObject,
  isFiniteNumber,
  isTriple,
  normalizeTriple,
  toNonEmptyString,
  normalizeLocale,
  normalizePlayerName,
  normalizeMarketOrbit,
  normalizeSpatialState,
  normalizeMotionState,
  normalizePhysicalState,
  normalizeObservabilityState,
  normalizeTrajectoryDescriptor,
  normalizeMarketSiteTypeValue,
  inferMarketSiteType,
  normalizeMarketInventoryEntry,
  normalizeMarketLedgerEntry,
  normalizeMarketShipListingEntry,
  normalizeMarket,
  normalizeInventoryItemReference,
  normalizeDriveProfile,
  normalizeShip,
  convertLegacyItemKinematics,
  normalizeItem,
  normalizeCreditLedgerEntry,
  calculateCharacterCredits,
  normalizeMission,
  normalizeCharacter,
  normalizeCelestialBody,
  getDefaultStockByRarity,
  getDefaultInventoryEntry,
};
