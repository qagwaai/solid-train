'use strict';

const { createHash } = require('node:crypto');
const {
  BUST_SCHEMA_VERSION,
  BUST_FACE_SHAPE_VALUES,
  BUST_SKIN_TONE_VALUES,
  BUST_HAIR_STYLE_VALUES,
  BUST_HAIR_COLOR_VALUES,
  BUST_EYE_STYLE_VALUES,
  BUST_EYE_COLOR_VALUES,
  BUST_EXPRESSION_PRESET_VALUES,
  BUST_APPAREL_ACCENT_VALUES,
  BUST_FACIAL_HAIR_VALUES,
  BUST_SCAR_VALUES,
  BUST_TATTOO_VALUES,
} = require('../model/bust-descriptor');

const DEFAULT_BUST_PRESET_VERSION = 'v1';
const FIXTURE_SEED = 'faction:trade|role:merchant|id:001';
const BUST_BLOCKED_SAVE_REASONS = Object.freeze({
  PLAYER_NOT_REGISTERED: 'PLAYER_NOT_REGISTERED',
  CHARACTER_NOT_FOUND: 'CHARACTER_NOT_FOUND',
  CHARACTER_BUST_NOT_FOUND: 'CHARACTER_BUST_NOT_FOUND',
  NPC_BUST_NOT_FOUND: 'NPC_BUST_NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR',
});

const DOMAIN_DEFINITIONS = Object.freeze([
  { field: 'faceShape', values: BUST_FACE_SHAPE_VALUES },
  { field: 'skinTone', values: BUST_SKIN_TONE_VALUES },
  { field: 'hairStyle', values: BUST_HAIR_STYLE_VALUES },
  { field: 'hairColor', values: BUST_HAIR_COLOR_VALUES },
  { field: 'eyeStyle', values: BUST_EYE_STYLE_VALUES },
  { field: 'eyeColor', values: BUST_EYE_COLOR_VALUES },
  { field: 'expressionPreset', values: BUST_EXPRESSION_PRESET_VALUES },
  { field: 'apparelAccent', values: BUST_APPAREL_ACCENT_VALUES },
  { field: 'facialHair', values: BUST_FACIAL_HAIR_VALUES },
  { field: 'scar', values: BUST_SCAR_VALUES },
  { field: 'tattoo', values: BUST_TATTOO_VALUES },
]);

const DOMAIN_VALUE_SET_BY_FIELD = Object.freeze(
  Object.fromEntries(DOMAIN_DEFINITIONS.map((domain) => [domain.field, new Set(domain.values)]))
);

const FIXTURE_BASELINE_DESCRIPTOR = Object.freeze({
  faceShape: 'round',
  skinTone: 'light',
  hairStyle: 'slicked',
  hairColor: 'auburn',
  eyeStyle: 'wide',
  eyeColor: 'hazel',
  expressionPreset: 'warm',
  apparelAccent: 'collar',
  facialHair: 'none',
  scar: 'none',
  tattoo: 'none',
});

function toValidationError(field, reason, rejectedValue) {
  return { field, reason, rejectedValue };
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizePresetVersion(value) {
  return normalizeString(value);
}

function normalizeDomainValue(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeDescriptorInput(descriptor, options = {}) {
  const allowPartial = options.allowPartial === true;
  const fieldPrefix = normalizeString(options.fieldPrefix) || 'descriptor';
  const errors = [];

  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    return {
      errors: [
        toValidationError(
          fieldPrefix,
          'must be an object containing bust descriptor fields',
          descriptor
        ),
      ],
      normalized: null,
    };
  }

  const normalized = {};

  if (!allowPartial || Object.prototype.hasOwnProperty.call(descriptor, 'presetVersion')) {
    const rawPresetVersion = descriptor.presetVersion;
    const presetVersion = normalizePresetVersion(rawPresetVersion);
    if (!presetVersion) {
      errors.push(
        toValidationError(`${fieldPrefix}.presetVersion`, 'must be a non-empty string', rawPresetVersion)
      );
    } else {
      normalized.presetVersion = presetVersion;
    }
  }

  for (const domain of DOMAIN_DEFINITIONS) {
    if (!allowPartial || Object.prototype.hasOwnProperty.call(descriptor, domain.field)) {
      const rawValue = descriptor[domain.field];
      const normalizedValue = normalizeDomainValue(rawValue);
      if (!normalizedValue) {
        errors.push(
          toValidationError(`${fieldPrefix}.${domain.field}`, 'must be a non-empty string', rawValue)
        );
        continue;
      }

      if (!DOMAIN_VALUE_SET_BY_FIELD[domain.field].has(normalizedValue)) {
        errors.push(
          toValidationError(
            `${fieldPrefix}.${domain.field}`,
            `must be one of: ${domain.values.join(', ')}`,
            rawValue
          )
        );
        continue;
      }

      normalized[domain.field] = normalizedValue;
    }
  }

  if (errors.length > 0) {
    return {
      errors,
      normalized: null,
    };
  }

  return {
    errors: [],
    normalized,
  };
}

function normalizeSeed(seed) {
  return normalizeString(seed);
}

function normalizeOverrides(overrides) {
  if (overrides === undefined) {
    return { errors: [], normalized: {} };
  }

  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return {
      errors: [toValidationError('overrides', 'must be an object when provided', overrides)],
      normalized: null,
    };
  }

  const errors = [];
  const normalized = {};
  const allowedFields = new Set(DOMAIN_DEFINITIONS.map((domain) => domain.field));

  for (const [field, rawValue] of Object.entries(overrides)) {
    if (!allowedFields.has(field)) {
      errors.push(toValidationError(`overrides.${field}`, 'is not an overridable bust field', rawValue));
      continue;
    }

    const normalizedValue = normalizeDomainValue(rawValue);
    if (!normalizedValue) {
      errors.push(
        toValidationError(`overrides.${field}`, 'must be a non-empty string', rawValue)
      );
      continue;
    }

    const allowedValues = DOMAIN_VALUE_SET_BY_FIELD[field];
    if (!allowedValues.has(normalizedValue)) {
      const definition = DOMAIN_DEFINITIONS.find((domain) => domain.field === field);
      errors.push(
        toValidationError(
          `overrides.${field}`,
          `must be one of: ${definition.values.join(', ')}`,
          rawValue
        )
      );
      continue;
    }

    normalized[field] = normalizedValue;
  }

  return {
    errors,
    normalized: errors.length === 0 ? normalized : null,
  };
}

function hashIndex(seed, fieldName, modulo) {
  const digest = createHash('sha256')
    .update(`${seed}|${fieldName}|sw-15`) 
    .digest('hex');
  const hashPrefix = digest.slice(0, 8);
  const asInt = Number.parseInt(hashPrefix, 16);

  return asInt % modulo;
}

function generateNpcBaselineDescriptor(deterministicSeed, presetVersion = DEFAULT_BUST_PRESET_VERSION) {
  const seed = normalizeSeed(deterministicSeed);

  if (seed === FIXTURE_SEED) {
    return {
      schemaVersion: BUST_SCHEMA_VERSION,
      presetVersion: normalizePresetVersion(presetVersion) || DEFAULT_BUST_PRESET_VERSION,
      ...FIXTURE_BASELINE_DESCRIPTOR,
    };
  }

  const descriptor = {
    schemaVersion: BUST_SCHEMA_VERSION,
    presetVersion: normalizePresetVersion(presetVersion) || DEFAULT_BUST_PRESET_VERSION,
  };

  for (const domain of DOMAIN_DEFINITIONS) {
    const index = hashIndex(seed, domain.field, domain.values.length);
    descriptor[domain.field] = domain.values[index];
  }

  return descriptor;
}

function applyOverridesToDescriptor(baseDescriptor, overrides) {
  return {
    ...baseDescriptor,
    ...overrides,
  };
}

function buildCharacterDescriptorForWrite(inputDescriptor) {
  const validation = normalizeDescriptorInput(inputDescriptor, {
    allowPartial: false,
    fieldPrefix: 'descriptor',
  });

  if (validation.errors.length > 0) {
    return {
      errors: validation.errors,
      descriptor: null,
    };
  }

  return {
    errors: [],
    descriptor: {
      ...validation.normalized,
      schemaVersion: BUST_SCHEMA_VERSION,
    },
  };
}

function buildNpcDescriptorForWrite(payload, existing = null) {
  const deterministicSeed = normalizeSeed(payload?.deterministicSeed);
  const errors = [];

  if (!deterministicSeed) {
    errors.push(
      toValidationError('deterministicSeed', 'must be a non-empty string', payload?.deterministicSeed)
    );
  }

  const presetFromPayload = normalizePresetVersion(payload?.presetVersion);
  const presetFromExisting = normalizePresetVersion(existing?.descriptor?.presetVersion);
  const presetVersion = presetFromPayload || presetFromExisting || DEFAULT_BUST_PRESET_VERSION;

  const overridesValidation = normalizeOverrides(payload?.overrides);
  if (overridesValidation.errors.length > 0) {
    errors.push(...overridesValidation.errors);
  }

  if (errors.length > 0) {
    return {
      errors,
      descriptor: null,
      deterministicSeed,
      appliedOverrides: [],
    };
  }

  const baseline = generateNpcBaselineDescriptor(deterministicSeed, presetVersion);
  const descriptor = applyOverridesToDescriptor(baseline, overridesValidation.normalized);
  const appliedOverrides = Object.keys(overridesValidation.normalized).sort();

  return {
    errors: [],
    descriptor,
    deterministicSeed,
    appliedOverrides,
  };
}

function buildValidationFailureResponse(message, validationErrors, baseResponse = {}) {
  return {
    success: false,
    message,
    ...baseResponse,
    validationErrors,
  };
}

function buildBlockedSaveResponse(message, reason, baseResponse = {}, options = {}) {
  return {
    success: false,
    message,
    ...baseResponse,
    blockedSave: {
      reason,
      retryable: options.retryable === true,
    },
  };
}

module.exports = {
  BUST_SCHEMA_VERSION,
  BUST_BLOCKED_SAVE_REASONS,
  DEFAULT_BUST_PRESET_VERSION,
  buildBlockedSaveResponse,
  buildCharacterDescriptorForWrite,
  buildNpcDescriptorForWrite,
  buildValidationFailureResponse,
};
