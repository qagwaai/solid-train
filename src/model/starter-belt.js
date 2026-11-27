'use strict';

const { createHash } = require('node:crypto');

const STARTER_RULE = 'starter-belt-sol-xy-v1';
const AU_KM = 149597870.7;

function starterPosition(characterId) {
  const hash = createHash('sha256').update(characterId).digest();
  const angle = (hash.readUInt32BE(0) / 0x100000000) * Math.PI * 2;
  const radiusKm = (2.1 + (hash.readUInt32BE(4) / 0x100000000) * 1.2) * AU_KM;
  return { x: radiusKm * Math.cos(angle), y: radiusKm * Math.sin(angle), z: 0 };
}

module.exports = { STARTER_RULE, starterPosition };
