'use strict';

function createUniverseMetadataSchema(mongoose) {
  const text = { type: String, required: true };
  const nullableText = { type: String, default: null };
  const nested = (fields) => new mongoose.Schema(fields, { _id: false, strict: 'throw' });
  const provenance = nested({
    origin: { ...text, enum: ['catalog', 'hypothetical', 'gameplay-exception'] },
    sourceReferences: { type: [String], required: true },
    fieldSources: {
      type: [
        nested({
          field: text,
          derivation: { ...text, enum: ['observed', 'estimated', 'seeded', 'authored'] },
          reference: nullableText,
          uncertainty: nullableText,
        }),
      ],
      required: true,
    },
    rationale: nullableText,
  });
  return nested({
    schemaVersion: { ...text, enum: ['non-sol-universe-v1'] },
    provenance: { type: provenance, required: true },
    generation: {
      type: nested({
        generatorVersion: text,
        seedKey: text,
        sourceSha256: { ...text, match: /^[a-f0-9]{64}$/ },
      }),
      default: undefined,
    },
    naming: {
      type: nested({
        preferredName: text,
        aliases: { type: [String], required: true },
        lane: { ...text, enum: ['protected', 'systematic', 'inherited', 'narrative'] },
        language: nullableText,
        motivation: nullableText,
        policyVersion: text,
      }),
      default: undefined,
    },
    lifecycle: {
      type: nested({
        status: { ...text, enum: ['active', 'retired'] },
        retiredAt: nullableText,
        reason: nullableText,
      }),
      default: undefined,
    },
    resourceProfile: {
      type: nested({
        materialItemTypes: { type: [String], required: true },
        abundance: { ...text, enum: ['sparse', 'moderate', 'rich'] },
        accessibility: { ...text, enum: ['accessible', 'difficult', 'hazardous'] },
        policyVersion: text,
      }),
      default: undefined,
    },
    population: {
      type: nested({
        id: text,
        kind: {
          ...text,
          enum: ['asteroid-belt', 'trojan', 'scattered-asteroids', 'comet-reservoir'],
        },
        hostBodyId: text,
        abundance: { ...text, enum: ['sparse', 'moderate', 'rich'] },
        estimatedTotalCount: { type: Number, min: 1, default: null },
        policyVersion: text,
      }),
      default: undefined,
    },
  });
}

module.exports = { createUniverseMetadataSchema };
