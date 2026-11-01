'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSchemaValidator } = require('../src/model/schema-validator');
const { validateCelestialBody } = require('../src/model/celestial-body-validation');
const { createCelestialBody } = require('../test-support/message-handler-test-helpers');

test('schema validator preserves full date-time format validation', () => {
  const validate = createSchemaValidator().compile({ type: 'string', format: 'date-time' });
  for (const value of [
    '2024-02-29T12:34:56.789Z',
    '2026-11-01T12:34:56+02:30',
    '2026-11-01T12:34:56-07:00',
  ]) {
    assert.equal(validate(value), true, value);
  }
  for (const value of [
    'not-a-date',
    '2026-02-29T12:34:56Z',
    '2026-02-30T12:34:56Z',
    '2026-11-01',
    '2026-11-01T12:34:56',
    '2026-11-01T25:34:56Z',
  ]) {
    assert.equal(validate(value), false, value);
    assert.equal(validate.errors[0].keyword, 'format');
  }
});

test('schema validator preserves UUID format validation', () => {
  const validate = createSchemaValidator().compile({ type: 'string', format: 'uuid' });
  assert.equal(validate('3ea0bf17-59c2-4e3f-9617-d9df14da9a00'), true);
  assert.equal(validate('00000000-0000-0000-0000-000000000000'), true);
  for (const value of ['opaque-correlation-id', '3ea0bf1759c24e3f9617d9df14da9a00', '']) {
    assert.equal(validate(value), false, value);
  }
});

test('canonical celestial timestamps reject impossible dates under full format validation', () => {
  const body = createCelestialBody();
  assert.equal(validateCelestialBody(body), true, JSON.stringify(validateCelestialBody.errors));
  for (const field of ['createdAt', 'updatedAt']) {
    for (const value of ['2026-02-29T12:34:56Z', '2026-02-30T12:34:56Z']) {
      assert.equal(validateCelestialBody({ ...body, [field]: value }), false, `${field}: ${value}`);
      assert.ok(
        validateCelestialBody.errors.some(
          (error) => error.keyword === 'format' && error.instancePath === `/${field}`
        )
      );
    }
    assert.equal(validateCelestialBody({ ...body, [field]: '2024-02-29T12:34:56Z' }), true);
  }
});

test('schema validator rejects non-finite numbers without coercing or mutating input', () => {
  const validate = createSchemaValidator().compile({
    type: 'object',
    required: ['amount'],
    properties: { amount: { type: 'number' } },
    additionalProperties: false,
  });
  assert.equal(validate({ amount: 42 }), true);
  for (const amount of [NaN, Infinity, -Infinity, '42']) {
    const value = { amount };
    assert.equal(validate(value), false);
    assert.deepEqual(value, { amount });
  }
  const extra = { amount: 42, unexpected: true };
  assert.equal(validate(extra), false);
  assert.deepEqual(extra, { amount: 42, unexpected: true });
});

test('schema validator retains allErrors and independent schema registration', () => {
  const first = createSchemaValidator({ allErrors: true });
  const second = createSchemaValidator();
  const validate = first.compile({
    $id: 'urn:solid-train:test:required-fields',
    type: 'object',
    required: ['left', 'right'],
    properties: { left: { type: 'string' }, right: { type: 'string' } },
  });
  assert.equal(validate({}), false);
  assert.equal(validate.errors.length, 2);
  assert.equal(second.getSchema('urn:solid-train:test:required-fields'), undefined);
});

test('schema validator does not silently accept unknown keywords or formats', () => {
  assert.throws(
    () => createSchemaValidator().compile({ type: 'string', misspelledKeyword: true }),
    /unknown keyword/
  );
  assert.throws(
    () => createSchemaValidator().compile({ type: 'string', format: 'unregistered-format' }),
    /unknown format/
  );
});
