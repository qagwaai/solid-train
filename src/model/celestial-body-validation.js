'use strict';

const Ajv = require('ajv');
const request = require('../../api/schemas/celestial-body-upsert-request.schema.json');

const ajv = new Ajv({ allErrors: true, strictNumbers: true });
for (const name of [
  'celestial-classification',
  'orbital-elements',
  'spatial-state',
  'celestial-physical-catalog',
  'celestial-physical-estimates',
  'external-object-descriptor',
]) {
  ajv.addSchema(require(`../../api/schemas/${name}.schema.json`), `${name}.schema.json`);
}

// Validate the source before normalization: no inferred state, observability,
// classification, orbital defaults, or Mongoose coercion on canonical writes.
const validateCelestialBody = ajv.compile(request.properties.celestialBody);

module.exports = { validateCelestialBody };
