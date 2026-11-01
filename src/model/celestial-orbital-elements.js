'use strict';

const { createSchemaValidator } = require('./schema-validator');
const schema = require('../../api/schemas/orbital-elements.schema.json');

// One validator for socket writes, direct persistence, and canonical reads.
const validateOrbitalElements = createSchemaValidator({
  allErrors: true,
  strictNumbers: true,
}).compile(schema);

module.exports = { validateOrbitalElements };
