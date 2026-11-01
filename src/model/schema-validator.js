'use strict';

const Ajv = require('ajv').default;
const addFormats = require('ajv-formats').default;

/** @param {import('ajv').Options} [options] */
function createSchemaValidator(options = {}) {
  const ajv = new Ajv(options);
  addFormats(ajv, { mode: 'full' });
  return ajv;
}

module.exports = { createSchemaValidator };
