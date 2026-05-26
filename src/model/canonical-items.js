// Canonical item definitions for the game: craftable, buyable, and raw materials.
// This module is the single source of truth for all item types.
// Extendable for future item types.

const ITEM_RARITY = Object.freeze({
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EXOTIC: 'exotic',
});

const ITEM_CATEGORY = Object.freeze({
  TOOL: 'tool',
  REPAIR: 'repair',
  MINING: 'mining',
  UNIT: 'unit',
  SUBSYSTEM: 'subsystem',
  STRUCTURAL: 'structural',
  INFRASTRUCTURE: 'infrastructure',
  REFINED: 'refined',
  ALLOY: 'alloy',
  COMPONENT: 'component',
  FUEL: 'fuel',
  MODULE: 'module',
  CAPITAL_UNIT: 'capital-unit',
  MANUFACTURED_COMPONENT: 'manufactured-component',
  RAW_MATERIAL: 'raw-material',
});

const ITEM_STATE = Object.freeze({
  CONTAINED: 'contained',
  DEPLOYED: 'deployed',
  DESTROYED: 'destroyed',
});

const ITEM_DAMAGE_STATUS = Object.freeze({
  INTACT: 'intact',
  DAMAGED: 'damaged',
  DISABLED: 'disabled',
  DESTROYED: 'destroyed',
});

const ITEM_CONTAINER_TYPE = Object.freeze({
  SHIP: 'ship',
  MARKET: 'market',
});

const ITEM_RARITY_VALUES = Object.freeze(Object.values(ITEM_RARITY));
const ITEM_CATEGORY_VALUES = Object.freeze(Object.values(ITEM_CATEGORY));
const ITEM_STATE_VALUES = Object.freeze(Object.values(ITEM_STATE));
const ITEM_DAMAGE_STATUS_VALUES = Object.freeze(Object.values(ITEM_DAMAGE_STATUS));
const ITEM_CONTAINER_TYPE_VALUES = Object.freeze(Object.values(ITEM_CONTAINER_TYPE));

const DEFAULT_TIER_BY_RARITY = Object.freeze({
  [ITEM_RARITY.COMMON]: 1,
  [ITEM_RARITY.UNCOMMON]: 2,
  [ITEM_RARITY.RARE]: 3,
  [ITEM_RARITY.EXOTIC]: 4,
});

const CATEGORY_ALIASES = Object.freeze({
  'fuel-liquid': ITEM_CATEGORY.FUEL,
});

function slugifyCategory(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeRarity(rawRarity) {
  if (rawRarity === null || rawRarity === undefined || rawRarity === '') {
    return null;
  }

  const normalized = String(rawRarity).trim().toLowerCase();
  if (!ITEM_RARITY_VALUES.includes(normalized)) {
    throw new Error(`Unsupported item rarity: ${rawRarity}`);
  }

  return normalized;
}

function normalizeCategory(rawCategory, fallbackCategory = null) {
  const candidate = rawCategory ?? fallbackCategory;
  if (candidate === null || candidate === undefined || candidate === '') {
    return null;
  }

  const normalizedSlug = slugifyCategory(candidate);
  const normalized = CATEGORY_ALIASES[normalizedSlug] || normalizedSlug;
  if (!ITEM_CATEGORY_VALUES.includes(normalized)) {
    throw new Error(`Unsupported item category: ${candidate}`);
  }

  return normalized;
}

function normalizeCatalogItem(item, options = {}) {
  const rarity = normalizeRarity(item.rarity);
  const category = normalizeCategory(item.category, options.defaultCategory);
  const tier = Number.isInteger(item.tier)
    ? item.tier
    : category === ITEM_CATEGORY.RAW_MATERIAL && rarity
      ? DEFAULT_TIER_BY_RARITY[rarity] || null
      : null;

  return {
    ...item,
    rarity,
    category,
    tier,
  };
}

const craftableItemsSource = [
  // All craftable items from CSV
  {
    itemType: '3d-printer',
    displayName: '3D Printer',
    description: 'Use raw materials to print objects',
    category: ITEM_CATEGORY.TOOL,
    tier: 1,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'conduit-seals',
    displayName: 'Conduit Seals',
    description:
      'Pressure-rated sealing sleeves for rerouting damaged ship conduits and stabilizing subsystem junctions.',
    category: ITEM_CATEGORY.MANUFACTURED_COMPONENT,
    tier: 1,
    rarity: ITEM_RARITY.COMMON,
    stackable: true,
    massKg: 2,
    volumeM3: 0.02,
    baseValueCredits: 250,
    launchable: false,
    state: ITEM_STATE.CONTAINED,
    damageStatus: ITEM_DAMAGE_STATUS.INTACT,
    container: null,
    fabrication: {
      durationMs: 600000,
      requiredMaterials: [
        { itemType: 'copper', quantity: 2 },
        { itemType: 'polymer', quantity: 1 },
      ],
    },
    craftingRequirements: [],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'expendable-dart-drone',
    displayName: 'Expendable Dart Drone',
    description: 'One shot mining tool',
    category: ITEM_CATEGORY.MINING,
    tier: 1,
    rarity: ITEM_RARITY.COMMON,
    launchable: true,
    craftingRequirements: [{ material: 'Iron', quantity: 1 }],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'scavenger-dart',
    displayName: 'Scavenger Dart',
    description: '',
    category: ITEM_CATEGORY.UNIT,
    tier: 1,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [
      { material: 'Iron Ore', quantity: 1 },
      { material: 'Carbon', quantity: 1 },
    ],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'propulsion-manifold',
    displayName: 'Propulsion Manifold',
    description:
      'Starter ship propulsion control subsystem. Cold-boot ships begin with a damaged unit installed.',
    category: ITEM_CATEGORY.SUBSYSTEM,
    tier: 1,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'sensor-array',
    displayName: 'Sensor Array',
    description:
      'Starter ship sensor subsystem. Cold-boot ships begin with a damaged unit installed.',
    category: ITEM_CATEGORY.SUBSYSTEM,
    tier: 1,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'power-distribution-bus',
    displayName: 'Power Distribution Bus',
    description:
      'Starter ship power routing subsystem. Cold-boot ships begin with a damaged unit installed.',
    category: ITEM_CATEGORY.SUBSYSTEM,
    tier: 1,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'ship-tractor-beam',
    displayName: 'Tractor Beam',
    description: 'Ship utility subsystem used for close-range salvage retrieval and object towing.',
    category: ITEM_CATEGORY.SUBSYSTEM,
    tier: 1,
    rarity: ITEM_RARITY.COMMON,
    launchable: false,
    state: ITEM_STATE.CONTAINED,
    damageStatus: ITEM_DAMAGE_STATUS.INTACT,
    container: null,
    craftingRequirements: [],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'hull-patch-kit',
    displayName: 'Hull Patch Kit',
    description:
      'Structural repair kit for hull breach patching and restoring ship integrity. Required for the Scavenger Pod repair mission step.',
    category: ITEM_CATEGORY.REPAIR,
    tier: 1,
    rarity: ITEM_RARITY.COMMON,
    launchable: false,
    state: ITEM_STATE.CONTAINED,
    damageStatus: ITEM_DAMAGE_STATUS.INTACT,
    requiredMaterials: [
      {
        material: 'Iron',
        quantity: 1,
        acceptedItemTypes: ['iron', 'iron-ore', 'iron-raw-material'],
      },
    ],
    craftingRequirements: [
      {
        material: 'Iron',
        quantity: 1,
      },
    ],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'extruder-tool',
    displayName: 'Extruder Tool',
    description: '',
    category: ITEM_CATEGORY.TOOL,
    tier: 2,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [
      { material: 'Iron', quantity: 1 },
      { material: 'Copper Ore', quantity: 1 },
    ],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'basic-filter',
    displayName: 'Basic Filter',
    description: '',
    category: ITEM_CATEGORY.TOOL,
    tier: 2,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [
      { material: 'Nickel', quantity: 1 },
      { material: 'Carbon', quantity: 1 },
    ],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'filter-frame',
    displayName: 'Filter Frame',
    description: '',
    category: ITEM_CATEGORY.STRUCTURAL,
    tier: 3,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [
      { material: 'Iron', quantity: 1 },
      { material: 'Nickel', quantity: 1 },
    ],
    dependentItems: ['extruder-tool'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'induction-forge',
    displayName: 'Induction Forge',
    description: '',
    category: ITEM_CATEGORY.INFRASTRUCTURE,
    tier: 3,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [
      { material: 'Iron', quantity: 1 },
      { material: 'Magnesium', quantity: 1 },
    ],
    dependentItems: ['filter-frame'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'iron-nickel-ingot',
    displayName: 'Iron / Nickel Ingot',
    description: '',
    category: ITEM_CATEGORY.REFINED,
    tier: 4,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [{ material: 'Iron / Nickel Ore', quantity: 1 }],
    dependentItems: ['induction-forge'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'arc-welder',
    displayName: 'Arc Welder',
    description: '',
    category: ITEM_CATEGORY.TOOL,
    tier: 5,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [
      { material: 'Copper', quantity: 1 },
      { material: 'Magnesium', quantity: 1 },
    ],
    dependentItems: ['induction-forge', 'copper-wiring'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'steel-ingot',
    displayName: 'Steel Ingot',
    description: '',
    category: ITEM_CATEGORY.ALLOY,
    tier: 6,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [
      { material: 'Iron Ingot', quantity: 1 },
      { material: 'Carbon', quantity: 1 },
    ],
    dependentItems: ['induction-forge'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'chemical-mixer',
    displayName: 'Chemical Mixer',
    description: '',
    category: ITEM_CATEGORY.INFRASTRUCTURE,
    tier: 6,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [
      { material: 'Glass', quantity: 1 },
      { material: 'Nickel', quantity: 1 },
    ],
    dependentItems: ['basic-filter', 'forge'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'silver-contact',
    displayName: 'Silver Contact',
    description: '',
    category: ITEM_CATEGORY.COMPONENT,
    tier: 7,
    rarity: ITEM_RARITY.RARE,
    craftingRequirements: [
      { material: 'Silver', quantity: 1 },
      { material: 'Copper', quantity: 1 },
    ],
    dependentItems: ['extruder-tool', 'induction-forge'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'logic-chip-t1',
    displayName: 'Logic Chip (T1)',
    description: '',
    category: ITEM_CATEGORY.COMPONENT,
    tier: 8,
    rarity: ITEM_RARITY.RARE,
    craftingRequirements: [
      { material: 'Silicon', quantity: 1 },
      { material: 'Wiring', quantity: 1 },
    ],
    dependentItems: ['silver-contact', 'acid-etchant'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'fuel-synth-module',
    displayName: 'Fuel Synth Module',
    description: '',
    category: ITEM_CATEGORY.INFRASTRUCTURE,
    tier: 9,
    rarity: ITEM_RARITY.UNCOMMON,
    craftingRequirements: [
      { material: 'Lithium', quantity: 1 },
      { material: 'Mercury', quantity: 1 },
    ],
    dependentItems: ['chemical-mixer'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'hydrazine',
    displayName: 'Hydrazine',
    description: '',
    category: ITEM_CATEGORY.FUEL,
    tier: 11,
    rarity: ITEM_RARITY.UNCOMMON,
    craftingRequirements: [
      { material: 'Nitrogen', quantity: 1 },
      { material: 'Hydrogen', quantity: 1 },
    ],
    dependentItems: ['chemical-mixer', 'fuel-synth'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'cooling-unit',
    displayName: 'Cooling Unit',
    description: '',
    category: ITEM_CATEGORY.INFRASTRUCTURE,
    tier: 12,
    rarity: ITEM_RARITY.UNCOMMON,
    craftingRequirements: [
      { material: 'Aluminum', quantity: 1 },
      { material: 'Copper', quantity: 1 },
    ],
    dependentItems: ['arc-welder', 'chemical-mixer'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'heat-sink',
    displayName: 'Heat Sink',
    description: '',
    category: ITEM_CATEGORY.COMPONENT,
    tier: 13,
    rarity: ITEM_RARITY.UNCOMMON,
    craftingRequirements: [
      { material: 'Copper', quantity: 1 },
      { material: 'Magnesium', quantity: 1 },
    ],
    dependentItems: ['extruder-tool', 'cooling-unit'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'heavy-hauler',
    displayName: 'Heavy Hauler',
    description: '',
    category: ITEM_CATEGORY.UNIT,
    tier: 15,
    rarity: ITEM_RARITY.UNCOMMON,
    craftingRequirements: [{ material: 'Reinforced Plate', quantity: 1 }],
    dependentItems: ['hydrazine', 'containment-unit'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'basic-mining-laser',
    displayName: 'Basic Mining Laser',
    description: '',
    category: ITEM_CATEGORY.TOOL,
    tier: 2,
    rarity: ITEM_RARITY.COMMON,
    craftingRequirements: [
      { material: 'Nickel', quantity: 1 },
      { material: 'Copper', quantity: 1 },
    ],
    dependentItems: [],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'lithography-kit',
    displayName: 'Lithography Kit',
    description: '',
    category: ITEM_CATEGORY.INFRASTRUCTURE,
    tier: 18,
    rarity: ITEM_RARITY.RARE,
    craftingRequirements: [
      { material: 'Silver', quantity: 1 },
      { material: 'Glass', quantity: 1 },
    ],
    dependentItems: ['precision-nozzle', 'logic-chip-t1'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'ion-engine-core',
    displayName: 'Ion Engine Core',
    description: '',
    category: ITEM_CATEGORY.COMPONENT,
    tier: 20,
    rarity: ITEM_RARITY.RARE,
    craftingRequirements: [
      { material: 'Mercury', quantity: 1 },
      { material: 'Silver', quantity: 1 },
    ],
    dependentItems: ['fuel-synth', 'heat-sink'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'nano-lathe',
    displayName: 'Nano Lathe',
    description: '',
    category: ITEM_CATEGORY.INFRASTRUCTURE,
    tier: 22,
    rarity: ITEM_RARITY.EXOTIC,
    craftingRequirements: [
      { material: 'Silver', quantity: 1 },
      { material: 'Palladium', quantity: 1 },
    ],
    dependentItems: ['lithography-kit', 'arc-welder'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'ai-processor-t2',
    displayName: 'AI Processor (T2)',
    description: '',
    category: ITEM_CATEGORY.COMPONENT,
    tier: 25,
    rarity: ITEM_RARITY.EXOTIC,
    craftingRequirements: [
      { material: 'Cobalt', quantity: 1 },
      { material: 'Gold', quantity: 1 },
    ],
    dependentItems: ['nano-lathe', 'silver-contact'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'shield-platform',
    displayName: 'Shield Platform',
    description: '',
    category: ITEM_CATEGORY.UNIT,
    tier: 28,
    rarity: ITEM_RARITY.EXOTIC,
    craftingRequirements: [
      { material: 'Cobalt', quantity: 1 },
      { material: 'Chromium', quantity: 1 },
    ],
    dependentItems: ['reinforced-plate', 'ai-processor-t2'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'fusion-reactor',
    displayName: 'Fusion Reactor',
    description: '',
    category: ITEM_CATEGORY.MODULE,
    tier: 30,
    rarity: ITEM_RARITY.EXOTIC,
    craftingRequirements: [
      { material: 'Uranium', quantity: 1 },
      { material: 'Palladium', quantity: 1 },
    ],
    dependentItems: ['fuel-synth', 'cooling-unit'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'advanced-heat-sink',
    displayName: 'Advanced Heat Sink',
    description: '',
    category: ITEM_CATEGORY.COMPONENT,
    tier: 32,
    rarity: ITEM_RARITY.EXOTIC,
    craftingRequirements: [
      { material: 'Tungsten', quantity: 1 },
      { material: 'Rhodium', quantity: 1 },
    ],
    dependentItems: ['nano-lathe', 'cooling-unit'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'precision-fabricator',
    displayName: 'Precision Fabricator',
    description: '',
    category: ITEM_CATEGORY.INFRASTRUCTURE,
    tier: 35,
    rarity: ITEM_RARITY.EXOTIC,
    craftingRequirements: [
      { material: 'Rhodium', quantity: 1 },
      { material: 'Gold', quantity: 1 },
    ],
    dependentItems: ['nano-lathe', 'lithography-kit'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'synthesis-engine',
    displayName: 'Synthesis Engine',
    description: '',
    category: ITEM_CATEGORY.INFRASTRUCTURE,
    tier: 40,
    rarity: ITEM_RARITY.EXOTIC,
    craftingRequirements: [
      { material: 'Antimony', quantity: 1 },
      { material: 'Platinum', quantity: 1 },
    ],
    dependentItems: ['dark-matter-refiner', 'neural-link'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'warp-drive',
    displayName: 'Warp Drive',
    description: '',
    category: ITEM_CATEGORY.MODULE,
    tier: 45,
    rarity: ITEM_RARITY.EXOTIC,
    craftingRequirements: [
      { material: 'Gold', quantity: 1 },
      { material: 'Iridium', quantity: 1 },
    ],
    dependentItems: ['synthesis-engine', 'advanced-heat-sink'],
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'the-hive-mind',
    displayName: 'The Hive-Mind',
    description: '',
    category: ITEM_CATEGORY.CAPITAL_UNIT,
    tier: 50,
    rarity: ITEM_RARITY.EXOTIC,
    craftingRequirements: [{ material: 'All Exotic Mats', quantity: 1 }],
    dependentItems: ['warp-drive', 'precision-fabricator'],
    buyPrice: null,
    sellPrice: null,
  },
];

const rawMaterialsSource = [
  // All raw materials from CSV
  {
    itemType: 'polymer',
    displayName: 'Polymer',
    description: 'Used to manufacture other items',
    rarity: ITEM_RARITY.COMMON,
    miningRequirement: null,
    typicalLocation: null,
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'carbon',
    displayName: 'Carbon',
    description: 'Structural frames, basic plating',
    rarity: ITEM_RARITY.COMMON,
    miningRequirement: 'Basic Mining Laser (Tier 1)',
    typicalLocation: 'Asteroid Belts',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'iron',
    displayName: 'Iron',
    description: 'Structural frames, basic plating',
    rarity: ITEM_RARITY.COMMON,
    miningRequirement: 'Basic Mining Laser (Tier 1)',
    typicalLocation: 'Asteroid Belts',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'copper',
    displayName: 'Copper',
    description: 'Power conduits, basic wiring',
    rarity: ITEM_RARITY.COMMON,
    miningRequirement: 'Basic Mining Laser (Tier 1)',
    typicalLocation: 'Rocky Planetoids',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'magnesium',
    displayName: 'Magnesium',
    description: 'Lightweight structural flares',
    rarity: ITEM_RARITY.COMMON,
    miningRequirement: 'Basic Mining Laser (Tier 1)',
    typicalLocation: 'Surface Crusts',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'nickel',
    displayName: 'Nickel',
    description: 'Circuitry, low-tier drone shells',
    rarity: ITEM_RARITY.COMMON,
    miningRequirement: 'Basic Mining Laser (Tier 1)',
    typicalLocation: 'Moons',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'silicon',
    displayName: 'Silicon',
    description: 'Circuitry, low-tier drone shells',
    rarity: ITEM_RARITY.COMMON,
    miningRequirement: 'Basic Mining Laser (Tier 1)',
    typicalLocation: '',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'lithium',
    displayName: 'Lithium',
    description: 'High-density battery cells',
    rarity: ITEM_RARITY.UNCOMMON,
    miningRequirement: 'Pulse Drill (Tier 2)',
    typicalLocation: 'Brine Flats',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'mercury',
    displayName: 'Mercury',
    description: 'Ion engine propellant',
    rarity: ITEM_RARITY.UNCOMMON,
    miningRequirement: 'Pulse Drill (Tier 2)',
    typicalLocation: 'Liquid Pockets (Low-Temp)',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'chromium',
    displayName: 'Chromium',
    description: 'Anti-corrosive coatings',
    rarity: ITEM_RARITY.UNCOMMON,
    miningRequirement: 'Pulse Drill (Tier 2)',
    typicalLocation: 'Metallic Asteroids',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'tungsten',
    displayName: 'Tungsten',
    description: 'Heat-resistant plating',
    rarity: ITEM_RARITY.UNCOMMON,
    miningRequirement: 'Heavy Pulse Drill (Tier 2)',
    typicalLocation: 'High-Gravity Planets',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'titanium',
    displayName: 'Titanium',
    description: 'Lightweight drone armor',
    rarity: ITEM_RARITY.UNCOMMON,
    miningRequirement: 'Pulse Drill (Tier 2)',
    typicalLocation: 'Volcanic Moons',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'silver',
    displayName: 'Silver',
    description: 'Precision sensors, AI signals',
    rarity: ITEM_RARITY.RARE,
    miningRequirement: 'Thermal Beam (Tier 3)',
    typicalLocation: 'Glacial / Icy Asteroids',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'cobalt',
    displayName: 'Cobalt',
    description: 'Magnetic stabilizers, AI cores',
    rarity: ITEM_RARITY.RARE,
    miningRequirement: 'Thermal Beam (Tier 3)',
    typicalLocation: 'Blue Nebula Clouds',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'palladium',
    displayName: 'Palladium',
    description: 'Fuel cells, catalyst systems',
    rarity: ITEM_RARITY.RARE,
    miningRequirement: 'Thermal Beam (Tier 3)',
    typicalLocation: 'Frozen Tundra Worlds',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'uranium',
    displayName: 'Uranium',
    description: 'Fission cores (mid-tier)',
    rarity: ITEM_RARITY.RARE,
    miningRequirement: 'Radiation-Shielded Drill (Tier 3)',
    typicalLocation: 'Radioactive Zones',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'iridium',
    displayName: 'Iridium',
    description: 'Extreme impact shielding',
    rarity: ITEM_RARITY.EXOTIC,
    miningRequirement: 'Plasma Extractor (Tier 4)',
    typicalLocation: 'Impact Craters',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'platinum',
    displayName: 'Platinum',
    description: 'High-end conductors (Lvl 15+)',
    rarity: ITEM_RARITY.EXOTIC,
    miningRequirement: 'Plasma Extractor (Tier 4)',
    typicalLocation: 'Deep Core Deposits',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'gold',
    displayName: 'Gold',
    description: 'High-end conductors (Lvl 15+)',
    rarity: ITEM_RARITY.EXOTIC,
    miningRequirement: 'Plasma Extractor (Tier 4)',
    typicalLocation: 'Deep Core Deposits',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'rhodium',
    displayName: 'Rhodium',
    description: 'Reflective shielding / Stealth',
    rarity: ITEM_RARITY.EXOTIC,
    miningRequirement: 'Plasma Extractor (Tier 4)',
    typicalLocation: 'White Dwarf Remnants',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'antimony',
    displayName: 'Antimony',
    description: 'Level 25+ Synthesis',
    rarity: ITEM_RARITY.EXOTIC,
    miningRequirement: 'Plasma Extractor (Tier 4)',
    typicalLocation: 'Super-dense Planetoids',
    buyPrice: null,
    sellPrice: null,
  },
  {
    itemType: 'unobtainium',
    displayName: 'Unobtainium',
    description: 'Ultimate-tier units',
    rarity: ITEM_RARITY.EXOTIC,
    miningRequirement: 'Dark Matter Siphon (Tier 5)',
    typicalLocation: 'Event Horizon Clusters',
    buyPrice: null,
    sellPrice: null,
  },
];

const buyableItemsSource = [
  // Add buyable-only items here as needed
];

const craftableItems = craftableItemsSource.map((item) =>
  normalizeCatalogItem(item, { defaultCategory: ITEM_CATEGORY.MANUFACTURED_COMPONENT })
);

const rawMaterials = rawMaterialsSource.map((item) =>
  normalizeCatalogItem(item, { defaultCategory: ITEM_CATEGORY.RAW_MATERIAL })
);

const buyableItems = buyableItemsSource.map((item) => normalizeCatalogItem(item));

// Combine all items into a single canonical list
const ALL_ITEMS = [...craftableItems, ...rawMaterials, ...buyableItems];

// Lookup by itemType
function getItemByType(itemType) {
  return ALL_ITEMS.find((item) => item.itemType === itemType) || null;
}

// Export for use in handlers and contract endpoints
module.exports = {
  ALL_ITEMS,
  getItemByType,
  craftableItems,
  rawMaterials,
  buyableItems,
  ITEM_RARITY,
  ITEM_CATEGORY,
  ITEM_STATE,
  ITEM_DAMAGE_STATUS,
  ITEM_CONTAINER_TYPE,
  ITEM_RARITY_VALUES,
  ITEM_CATEGORY_VALUES,
  ITEM_STATE_VALUES,
  ITEM_DAMAGE_STATUS_VALUES,
  ITEM_CONTAINER_TYPE_VALUES,
};
