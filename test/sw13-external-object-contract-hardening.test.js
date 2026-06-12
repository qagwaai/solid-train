'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  EXTERNAL_OBJECT_DOMAIN_VALUES,
  EXTERNAL_OBJECT_ROLE_CUE_VALUES,
  EXTERNAL_OBJECT_FACTION_CUE_VALUES,
  EXTERNAL_OBJECT_FALLBACK_TIER_VALUES,
  EXTERNAL_OBJECT_SILHOUETTE_PROFILE_VALUES,
  EXTERNAL_OBJECT_MATERIAL_PROFILE_VALUES,
  EXTERNAL_OBJECT_EMISSIVE_PROFILE_VALUES,
} = require('../src/model/external-object-descriptor');

const ROOT = path.resolve(__dirname, '..');
const OPENAPI_PATH = path.join(ROOT, 'api', 'openapi.yaml');
const SCHEMA_PATH = path.join(ROOT, 'api', 'schemas', 'external-object-descriptor.schema.json');
const CELESTIAL_UPSERT_REQUEST_PATH = path.join(
  ROOT,
  'api',
  'schemas',
  'celestial-body-upsert-request.schema.json'
);
const CELESTIAL_LIST_RESPONSE_PATH = path.join(
  ROOT,
  'api',
  'schemas',
  'celestial-body-list-response.schema.json'
);
const SOLAR_SYSTEM_GET_RESPONSE_PATH = path.join(
  ROOT,
  'api',
  'schemas',
  'solar-system-get-response.schema.json'
);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function sortValues(values) {
  return [...values].sort();
}

test('external object descriptor schema enums remain aligned with runtime taxonomy', () => {
  const descriptorSchema = readJson(SCHEMA_PATH);

  assert.deepEqual(
    sortValues(descriptorSchema.properties.domain.enum),
    sortValues(EXTERNAL_OBJECT_DOMAIN_VALUES)
  );
  assert.deepEqual(
    sortValues(descriptorSchema.properties.roleCue.enum),
    sortValues(EXTERNAL_OBJECT_ROLE_CUE_VALUES)
  );
  assert.deepEqual(
    sortValues(descriptorSchema.properties.factionCue.enum),
    sortValues(EXTERNAL_OBJECT_FACTION_CUE_VALUES)
  );
  assert.deepEqual(
    sortValues(descriptorSchema.properties.fallbackTier.enum),
    sortValues(EXTERNAL_OBJECT_FALLBACK_TIER_VALUES)
  );
  assert.deepEqual(
    sortValues(descriptorSchema.properties.silhouetteProfile.enum),
    sortValues(EXTERNAL_OBJECT_SILHOUETTE_PROFILE_VALUES)
  );
  assert.deepEqual(
    sortValues(descriptorSchema.properties.materialProfile.enum),
    sortValues(EXTERNAL_OBJECT_MATERIAL_PROFILE_VALUES)
  );
  assert.deepEqual(
    sortValues(descriptorSchema.properties.emissiveProfile.enum),
    sortValues(EXTERNAL_OBJECT_EMISSIVE_PROFILE_VALUES)
  );
  assert.equal(descriptorSchema.additionalProperties, false);
});

test('openapi registers external-object-descriptor component', () => {
  const openApiText = readText(OPENAPI_PATH);

  assert.match(
    openApiText,
    /\r?\n\s{4}ExternalObjectDescriptor:\r?\n\s{6}\$ref:\s*'\.\/openapi\/_shared\/schemas\.yaml#\/components\/schemas\/ExternalObjectDescriptor'/
  );
  assert.match(
    openApiText,
    /\r?\n\s{4}ExternalObjectGateLandmarkPayload:\r?\n\s{6}\$ref:\s*'\.\/openapi\/_shared\/schemas\.yaml#\/components\/schemas\/ExternalObjectGateLandmarkPayload'/
  );
  assert.match(
    openApiText,
    /\r?\n\s{4}ExternalObjectDescriptorPayload:\r?\n\s{6}\$ref:\s*'\.\/openapi\/_shared\/schemas\.yaml#\/components\/schemas\/ExternalObjectDescriptorPayload'/
  );
});

test('celestial schemas reference external object descriptor contract', () => {
  const upsertRequest = readJson(CELESTIAL_UPSERT_REQUEST_PATH);
  const listResponse = readJson(CELESTIAL_LIST_RESPONSE_PATH);
  const solarGetResponse = readJson(SOLAR_SYSTEM_GET_RESPONSE_PATH);

  assert.equal(
    upsertRequest.properties.celestialBody.properties.externalObjectDescriptor.$ref,
    './external-object-descriptor.schema.json'
  );

  assert.equal(
    listResponse.definitions.celestialBody.properties.externalObjectDescriptor.$ref,
    './external-object-descriptor.schema.json'
  );
  assert.equal(
    listResponse.definitions.debrisEntry.properties.externalObjectDescriptor.$ref,
    './external-object-descriptor.schema.json'
  );

  assert.equal(
    solarGetResponse.definitions.celestialBody.properties.externalObjectDescriptor.$ref,
    './external-object-descriptor.schema.json'
  );
  assert.equal(
    solarGetResponse.definitions.debrisEntry.properties.externalObjectDescriptor.$ref,
    './external-object-descriptor.schema.json'
  );
});
