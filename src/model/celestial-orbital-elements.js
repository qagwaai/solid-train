'use strict';

const Ajv = require('ajv');
const schema = require('../../api/schemas/orbital-elements.schema.json');

// One validator for socket writes, direct persistence, and canonical reads.
const validateOrbitalElements = new Ajv({ allErrors: true, strictNumbers: true }).compile(schema);

module.exports = { validateOrbitalElements };
