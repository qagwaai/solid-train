// Canonical item definitions for the game: craftable, buyable, and raw materials.
// This module is the single source of truth for all item types.
// Extendable for future item types.

const craftableItems = [
  // All craftable items from CSV
  { itemType: 'scavenger-dart', displayName: 'Scavenger Dart', description: '', category: 'Unit', tier: 1, rarity: 'Common', craftingRequirements: [ { material: 'Iron Ore', quantity: 1 }, { material: 'Carbon', quantity: 1 } ], dependentItems: [], buyPrice: null, sellPrice: null },
  { itemType: 'extruder-tool', displayName: 'Extruder Tool', description: '', category: 'Tool', tier: 2, rarity: 'Common', craftingRequirements: [ { material: 'Iron', quantity: 1 }, { material: 'Copper Ore', quantity: 1 } ], dependentItems: [], buyPrice: null, sellPrice: null },
  { itemType: 'basic-filter', displayName: 'Basic Filter', description: '', category: 'Tool', tier: 2, rarity: 'Common', craftingRequirements: [ { material: 'Nickel', quantity: 1 }, { material: 'Carbon', quantity: 1 } ], dependentItems: [], buyPrice: null, sellPrice: null },
  { itemType: 'filter-frame', displayName: 'Filter Frame', description: '', category: 'Structural', tier: 3, rarity: 'Common', craftingRequirements: [ { material: 'Iron', quantity: 1 }, { material: 'Nickel', quantity: 1 } ], dependentItems: ['extruder-tool'], buyPrice: null, sellPrice: null },
  { itemType: 'induction-forge', displayName: 'Induction Forge', description: '', category: 'Infrastructure', tier: 3, rarity: 'Common', craftingRequirements: [ { material: 'Iron', quantity: 1 }, { material: 'Magnesium', quantity: 1 } ], dependentItems: ['filter-frame'], buyPrice: null, sellPrice: null },
  { itemType: 'iron-nickel-ingot', displayName: 'Iron / Nickel Ingot', description: '', category: 'Refined', tier: 4, rarity: 'Common', craftingRequirements: [ { material: 'Iron / Nickel Ore', quantity: 1 } ], dependentItems: ['induction-forge'], buyPrice: null, sellPrice: null },
  { itemType: 'arc-welder', displayName: 'Arc Welder', description: '', category: 'Tool', tier: 5, rarity: 'Common', craftingRequirements: [ { material: 'Copper', quantity: 1 }, { material: 'Magnesium', quantity: 1 } ], dependentItems: ['induction-forge', 'copper-wiring'], buyPrice: null, sellPrice: null },
  { itemType: 'steel-ingot', displayName: 'Steel Ingot', description: '', category: 'Alloy', tier: 6, rarity: 'Common', craftingRequirements: [ { material: 'Iron Ingot', quantity: 1 }, { material: 'Carbon', quantity: 1 } ], dependentItems: ['induction-forge'], buyPrice: null, sellPrice: null },
  { itemType: 'chemical-mixer', displayName: 'Chemical Mixer', description: '', category: 'Infrastructure', tier: 6, rarity: 'Common', craftingRequirements: [ { material: 'Glass', quantity: 1 }, { material: 'Nickel', quantity: 1 } ], dependentItems: ['basic-filter', 'forge'], buyPrice: null, sellPrice: null },
  { itemType: 'silver-contact', displayName: 'Silver Contact', description: '', category: 'Component', tier: 7, rarity: 'Rare', craftingRequirements: [ { material: 'Silver', quantity: 1 }, { material: 'Copper', quantity: 1 } ], dependentItems: ['extruder-tool', 'induction-forge'], buyPrice: null, sellPrice: null },
  { itemType: 'logic-chip-t1', displayName: 'Logic Chip (T1)', description: '', category: 'Component', tier: 8, rarity: 'Rare', craftingRequirements: [ { material: 'Silicon', quantity: 1 }, { material: 'Wiring', quantity: 1 } ], dependentItems: ['silver-contact', 'acid-etchant'], buyPrice: null, sellPrice: null },
  { itemType: 'fuel-synth-module', displayName: 'Fuel Synth Module', description: '', category: 'Infrastructure', tier: 9, rarity: 'Uncommon', craftingRequirements: [ { material: 'Lithium', quantity: 1 }, { material: 'Mercury', quantity: 1 } ], dependentItems: ['chemical-mixer'], buyPrice: null, sellPrice: null },
  { itemType: 'hydrazine', displayName: 'Hydrazine', description: '', category: 'Fuel (Liquid)', tier: 11, rarity: 'Uncommon', craftingRequirements: [ { material: 'Nitrogen', quantity: 1 }, { material: 'Hydrogen', quantity: 1 } ], dependentItems: ['chemical-mixer', 'fuel-synth'], buyPrice: null, sellPrice: null },
  { itemType: 'cooling-unit', displayName: 'Cooling Unit', description: '', category: 'Infrastructure', tier: 12, rarity: 'Uncommon', craftingRequirements: [ { material: 'Aluminum', quantity: 1 }, { material: 'Copper', quantity: 1 } ], dependentItems: ['arc-welder', 'chemical-mixer'], buyPrice: null, sellPrice: null },
  { itemType: 'heat-sink', displayName: 'Heat Sink', description: '', category: 'Component', tier: 13, rarity: 'Uncommon', craftingRequirements: [ { material: 'Copper', quantity: 1 }, { material: 'Magnesium', quantity: 1 } ], dependentItems: ['extruder-tool', 'cooling-unit'], buyPrice: null, sellPrice: null },
  { itemType: 'heavy-hauler', displayName: 'Heavy Hauler', description: '', category: 'Unit', tier: 15, rarity: 'Uncommon', craftingRequirements: [ { material: 'Reinforced Plate', quantity: 1 } ], dependentItems: ['hydrazine', 'containment-unit'], buyPrice: null, sellPrice: null },
  { itemType: 'lithography-kit', displayName: 'Lithography Kit', description: '', category: 'Infrastructure', tier: 18, rarity: 'Rare', craftingRequirements: [ { material: 'Silver', quantity: 1 }, { material: 'Glass', quantity: 1 } ], dependentItems: ['precision-nozzle', 'logic-chip-t1'], buyPrice: null, sellPrice: null },
  { itemType: 'ion-engine-core', displayName: 'Ion Engine Core', description: '', category: 'Component', tier: 20, rarity: 'Rare', craftingRequirements: [ { material: 'Mercury', quantity: 1 }, { material: 'Silver', quantity: 1 } ], dependentItems: ['fuel-synth', 'heat-sink'], buyPrice: null, sellPrice: null },
  { itemType: 'nano-lathe', displayName: 'Nano Lathe', description: '', category: 'Infrastructure', tier: 22, rarity: 'Exotic', craftingRequirements: [ { material: 'Silver', quantity: 1 }, { material: 'Palladium', quantity: 1 } ], dependentItems: ['lithography-kit', 'arc-welder'], buyPrice: null, sellPrice: null },
  { itemType: 'ai-processor-t2', displayName: 'AI Processor (T2)', description: '', category: 'Component', tier: 25, rarity: 'Exotic', craftingRequirements: [ { material: 'Cobalt', quantity: 1 }, { material: 'Gold', quantity: 1 } ], dependentItems: ['nano-lathe', 'silver-contact'], buyPrice: null, sellPrice: null },
  { itemType: 'shield-platform', displayName: 'Shield Platform', description: '', category: 'Unit', tier: 28, rarity: 'Exotic', craftingRequirements: [ { material: 'Cobalt', quantity: 1 }, { material: 'Chromium', quantity: 1 } ], dependentItems: ['reinforced-plate', 'ai-processor-t2'], buyPrice: null, sellPrice: null },
  { itemType: 'fusion-reactor', displayName: 'Fusion Reactor', description: '', category: 'Module', tier: 30, rarity: 'Exotic', craftingRequirements: [ { material: 'Uranium', quantity: 1 }, { material: 'Palladium', quantity: 1 } ], dependentItems: ['fuel-synth', 'cooling-unit'], buyPrice: null, sellPrice: null },
  { itemType: 'advanced-heat-sink', displayName: 'Advanced Heat Sink', description: '', category: 'Component', tier: 32, rarity: 'Exotic', craftingRequirements: [ { material: 'Tungsten', quantity: 1 }, { material: 'Rhodium', quantity: 1 } ], dependentItems: ['nano-lathe', 'cooling-unit'], buyPrice: null, sellPrice: null },
  { itemType: 'precision-fabricator', displayName: 'Precision Fabricator', description: '', category: 'Infrastructure', tier: 35, rarity: 'Exotic', craftingRequirements: [ { material: 'Rhodium', quantity: 1 }, { material: 'Gold', quantity: 1 } ], dependentItems: ['nano-lathe', 'lithography-kit'], buyPrice: null, sellPrice: null },
  { itemType: 'synthesis-engine', displayName: 'Synthesis Engine', description: '', category: 'Infrastructure', tier: 40, rarity: 'Exotic', craftingRequirements: [ { material: 'Antimony', quantity: 1 }, { material: 'Platinum', quantity: 1 } ], dependentItems: ['dark-matter-refiner', 'neural-link'], buyPrice: null, sellPrice: null },
  { itemType: 'warp-drive', displayName: 'Warp Drive', description: '', category: 'Module', tier: 45, rarity: 'Exotic', craftingRequirements: [ { material: 'Gold', quantity: 1 }, { material: 'Iridium', quantity: 1 } ], dependentItems: ['synthesis-engine', 'advanced-heat-sink'], buyPrice: null, sellPrice: null },
  { itemType: 'the-hive-mind', displayName: 'The Hive-Mind', description: '', category: 'Capital Unit', tier: 50, rarity: 'Exotic', craftingRequirements: [ { material: 'All Exotic Mats', quantity: 1 } ], dependentItems: ['warp-drive', 'precision-fabricator'], buyPrice: null, sellPrice: null },
];

const rawMaterials = [
  // All raw materials from CSV
  { itemType: 'carbon', displayName: 'Carbon', description: 'Structural frames, basic plating', rarity: 'Common', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Asteroid Belts', buyPrice: null, sellPrice: null },
  { itemType: 'iron', displayName: 'Iron', description: 'Structural frames, basic plating', rarity: 'Common', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Asteroid Belts', buyPrice: null, sellPrice: null },
  { itemType: 'copper', displayName: 'Copper', description: 'Power conduits, basic wiring', rarity: 'Common', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Rocky Planetoids', buyPrice: null, sellPrice: null },
  { itemType: 'magnesium', displayName: 'Magnesium', description: 'Lightweight structural flares', rarity: 'Common', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Surface Crusts', buyPrice: null, sellPrice: null },
  { itemType: 'nickel', displayName: 'Nickel', description: 'Circuitry, low-tier drone shells', rarity: 'Common', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Moons', buyPrice: null, sellPrice: null },
  { itemType: 'silicon', displayName: 'Silicon', description: 'Circuitry, low-tier drone shells', rarity: 'Common', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: '', buyPrice: null, sellPrice: null },
  { itemType: 'lithium', displayName: 'Lithium', description: 'High-density battery cells', rarity: 'Uncommon', miningRequirement: 'Pulse Drill (Tier 2)', typicalLocation: 'Brine Flats', buyPrice: null, sellPrice: null },
  { itemType: 'mercury', displayName: 'Mercury', description: 'Ion engine propellant', rarity: 'Uncommon', miningRequirement: 'Pulse Drill (Tier 2)', typicalLocation: 'Liquid Pockets (Low-Temp)', buyPrice: null, sellPrice: null },
  { itemType: 'chromium', displayName: 'Chromium', description: 'Anti-corrosive coatings', rarity: 'Uncommon', miningRequirement: 'Pulse Drill (Tier 2)', typicalLocation: 'Metallic Asteroids', buyPrice: null, sellPrice: null },
  { itemType: 'tungsten', displayName: 'Tungsten', description: 'Heat-resistant plating', rarity: 'Uncommon', miningRequirement: 'Heavy Pulse Drill (Tier 2)', typicalLocation: 'High-Gravity Planets', buyPrice: null, sellPrice: null },
  { itemType: 'titanium', displayName: 'Titanium', description: 'Lightweight drone armor', rarity: 'Uncommon', miningRequirement: 'Pulse Drill (Tier 2)', typicalLocation: 'Volcanic Moons', buyPrice: null, sellPrice: null },
  { itemType: 'silver', displayName: 'Silver', description: 'Precision sensors, AI signals', rarity: 'Rare', miningRequirement: 'Thermal Beam (Tier 3)', typicalLocation: 'Glacial / Icy Asteroids', buyPrice: null, sellPrice: null },
  { itemType: 'cobalt', displayName: 'Cobalt', description: 'Magnetic stabilizers, AI cores', rarity: 'Rare', miningRequirement: 'Thermal Beam (Tier 3)', typicalLocation: 'Blue Nebula Clouds', buyPrice: null, sellPrice: null },
  { itemType: 'palladium', displayName: 'Palladium', description: 'Fuel cells, catalyst systems', rarity: 'Rare', miningRequirement: 'Thermal Beam (Tier 3)', typicalLocation: 'Frozen Tundra Worlds', buyPrice: null, sellPrice: null },
  { itemType: 'uranium', displayName: 'Uranium', description: 'Fission cores (mid-tier)', rarity: 'Rare', miningRequirement: 'Radiation-Shielded Drill (Tier 3)', typicalLocation: 'Radioactive Zones', buyPrice: null, sellPrice: null },
  { itemType: 'iridium', displayName: 'Iridium', description: 'Extreme impact shielding', rarity: 'Exotic', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'Impact Craters', buyPrice: null, sellPrice: null },
  { itemType: 'platinum', displayName: 'Platinum', description: 'High-end conductors (Lvl 15+)', rarity: 'Exotic', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'Deep Core Deposits', buyPrice: null, sellPrice: null },
  { itemType: 'gold', displayName: 'Gold', description: 'High-end conductors (Lvl 15+)', rarity: 'Exotic', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'Deep Core Deposits', buyPrice: null, sellPrice: null },
  { itemType: 'rhodium', displayName: 'Rhodium', description: 'Reflective shielding / Stealth', rarity: 'Exotic', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'White Dwarf Remnants', buyPrice: null, sellPrice: null },
  { itemType: 'antimony', displayName: 'Antimony', description: 'Level 25+ Synthesis', rarity: 'Exotic', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'Super-dense Planetoids', buyPrice: null, sellPrice: null },
  { itemType: 'unobtainium', displayName: 'Unobtainium', description: 'Ultimate-tier units', rarity: 'Exotic', miningRequirement: 'Dark Matter Siphon (Tier 5)', typicalLocation: 'Event Horizon Clusters', buyPrice: null, sellPrice: null },
];

const buyableItems = [
  // Add buyable-only items here as needed
];

// Combine all items into a single canonical list
const ALL_ITEMS = [
  ...craftableItems,
  ...rawMaterials,
  ...buyableItems,
];

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
};
