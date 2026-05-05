'use strict';

const RAW_MATERIALS = [
  { id: 'carbon', rarity: 'Common', material: 'Carbon', primaryUse: 'Structural frames, basic plating', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Asteroid Belts' },
  { id: 'iron', rarity: 'Common', material: 'Iron', primaryUse: 'Structural frames, basic plating', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Asteroid Belts' },
  { id: 'copper', rarity: 'Common', material: 'Copper', primaryUse: 'Power conduits, basic wiring', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Rocky Planetoids' },
  { id: 'magnesium', rarity: 'Common', material: 'Magnesium', primaryUse: 'Lightweight structural flares', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Surface Crusts' },
  { id: 'nickel', rarity: 'Common', material: 'Nickel', primaryUse: 'Circuitry, low-tier drone shells', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Moons' },
  { id: 'silicon', rarity: 'Common', material: 'Silicon', primaryUse: 'Circuitry, low-tier drone shells', miningRequirement: 'Basic Mining Laser (Tier 1)', typicalLocation: 'Moons' },
  { id: 'lithium', rarity: 'Uncommon', material: 'Lithium', primaryUse: 'High-density battery cells', miningRequirement: 'Pulse Drill (Tier 2)', typicalLocation: 'Brine Flats' },
  { id: 'mercury', rarity: 'Uncommon', material: 'Mercury', primaryUse: 'Ion engine propellant', miningRequirement: 'Pulse Drill (Tier 2)', typicalLocation: 'Liquid Pockets (Low-Temp)' },
  { id: 'chromium', rarity: 'Uncommon', material: 'Chromium', primaryUse: 'Anti-corrosive coatings', miningRequirement: 'Pulse Drill (Tier 2)', typicalLocation: 'Metallic Asteroids' },
  { id: 'tungsten', rarity: 'Uncommon', material: 'Tungsten', primaryUse: 'Heat-resistant plating', miningRequirement: 'Heavy Pulse Drill (Tier 2)', typicalLocation: 'High-Gravity Planets' },
  { id: 'titanium', rarity: 'Uncommon', material: 'Titanium', primaryUse: 'Lightweight drone armor', miningRequirement: 'Pulse Drill (Tier 2)', typicalLocation: 'Volcanic Moons' },
  { id: 'silver', rarity: 'Rare', material: 'Silver', primaryUse: 'Precision sensors, AI signals', miningRequirement: 'Thermal Beam (Tier 3)', typicalLocation: 'Glacial / Icy Asteroids' },
  { id: 'cobalt', rarity: 'Rare', material: 'Cobalt', primaryUse: 'Magnetic stabilizers, AI cores', miningRequirement: 'Thermal Beam (Tier 3)', typicalLocation: 'Blue Nebula Clouds' },
  { id: 'palladium', rarity: 'Rare', material: 'Palladium', primaryUse: 'Fuel cells, catalyst systems', miningRequirement: 'Thermal Beam (Tier 3)', typicalLocation: 'Frozen Tundra Worlds' },
  { id: 'uranium', rarity: 'Rare', material: 'Uranium', primaryUse: 'Fission cores (mid-tier)', miningRequirement: 'Radiation-Shielded Drill (Tier 3)', typicalLocation: 'Radioactive Zones' },
  { id: 'iridium', rarity: 'Exotic', material: 'Iridium', primaryUse: 'Extreme impact shielding', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'Impact Craters' },
  { id: 'platinum', rarity: 'Exotic', material: 'Platinum', primaryUse: 'High-end conductors (Lvl 15+)', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'Deep Core Deposits' },
  { id: 'gold', rarity: 'Exotic', material: 'Gold', primaryUse: 'High-end conductors (Lvl 15+)', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'Deep Core Deposits' },
  { id: 'rhodium', rarity: 'Exotic', material: 'Rhodium', primaryUse: 'Reflective shielding / Stealth', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'White Dwarf Remnants' },
  { id: 'antimony', rarity: 'Exotic', material: 'Antimony', primaryUse: 'Level 25+ Synthesis', miningRequirement: 'Plasma Extractor (Tier 4)', typicalLocation: 'Super-dense Planetoids' },
  { id: 'unobtainium', rarity: 'Exotic', material: 'Unobtainium', primaryUse: 'Ultimate-tier units', miningRequirement: 'Dark Matter Siphon (Tier 5)', typicalLocation: 'Event Horizon Clusters' }
];

const RARITY_BASE_PRICE = {
  Common: 24,
  Uncommon: 52,
  Rare: 130,
  Exotic: 320
};

const MARKET_CATALOG = RAW_MATERIALS.map((material, index) => ({
  itemId: material.id,
  itemType: 'raw-material',
  displayName: material.material,
  rarity: material.rarity,
  primaryUse: material.primaryUse,
  miningRequirement: material.miningRequirement,
  typicalLocation: material.typicalLocation,
  baseMidpointPrice: RARITY_BASE_PRICE[material.rarity] + index,
  marketCanBuy: true,
  marketCanSell: true
}));

const MARKET_CATALOG_BY_ID = new Map(
  MARKET_CATALOG.map((entry) => [entry.itemId, entry])
);

module.exports = {
  MARKET_CATALOG,
  MARKET_CATALOG_BY_ID
};
