'use strict';

const path = require('node:path');
const { createHash } = require('node:crypto');
const { getHygSystems } = require('./hyg-star-catalog');
const {
  getExoplanetSystemEvidence,
  getExoplanetSystemProperNames,
} = require('./exoplanet-catalog');

const manifestPath = path.join(__dirname, '..', '..', 'data', 'system-naming-manifest.json');
const manifest = require(manifestPath);

function normalizeAlias(value) {
  return String(value || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('en-US');
}

function comparisonKeys(value) {
  const normalized = String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}\s]/gu, '');
  const accentFolded = normalized.normalize('NFD').replace(/\p{M}/gu, '');
  return [...new Set([normalized, accentFolded].filter(Boolean))];
}

function uniqueNames(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (typeof value !== 'string' || !value.trim()) return false;
    const key = normalizeAlias(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSourceEvidence(system) {
  const exoplanetEvidence = getExoplanetSystemEvidence(system.id);
  if (exoplanetEvidence) return exoplanetEvidence;
  if (system.hygSystemId) {
    const hyg = getHygSystems().find((entry) => entry.systemId === system.hygSystemId);
    if (hyg) {
      return {
        digest: createHash('sha256').update(JSON.stringify(hyg)).digest('hex'),
        snapshot: 'hyg-fixture',
      };
    }
  }
  return null;
}

function isProtected(system, namingManifest = manifest) {
  if (
    namingManifest.protections?.[system.id] ||
    namingManifest.eligibility?.[system.id]?.decision === 'protected'
  ) {
    return true;
  }
  if (system.source === 'curated') return true;
  // Any source proper name is protected by default. Eligibility must be
  // explicitly reviewed; missing source evidence never implies eligibility.
  if (system.primaryStar?.properName) return true;
  if (getExoplanetSystemProperNames(system.id).length) return true;
  if (system.hygSystemId) {
    const hyg = getHygSystems().find((entry) => entry.systemId === system.hygSystemId);
    if (hyg?.stars.some((star) => Boolean(star.properName))) return true;
  }
  return false;
}

function validateNamingManifest(registry, namingManifest = manifest) {
  const byId = new Map(registry.map((system) => [system.id, system]));
  const errors = [];
  for (const [section, entries] of [
    ['eligibility', namingManifest.eligibility || {}],
    ['approvedAssignments', namingManifest.approvedAssignments || {}],
    ['overrides', namingManifest.overrides || {}],
    ['protections', namingManifest.protections || {}],
    ['aliases', namingManifest.aliases || {}],
  ]) {
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      errors.push(`${section} must be an object`);
      continue;
    }
    for (const [id, entry] of Object.entries(entries)) {
      if (!byId.has(id)) errors.push(`${section} references unknown system ${id}`);
      if (section === 'protections' && !entry?.reason) {
        errors.push(`protection ${id} lacks a reason`);
      }
      if (section === 'aliases' && !Array.isArray(entry)) {
        errors.push(`aliases for ${id} must be an array`);
      }
    }
  }
  for (const [id, decision] of Object.entries(namingManifest.eligibility || {})) {
    if (!['eligible', 'protected', 'needs-review'].includes(decision?.decision)) {
      errors.push(`eligibility ${id} has an invalid decision`);
    }
    if (
      decision?.decision === 'eligible' &&
      (!decision.reviewer ||
        !decision.sourceSnapshot ||
        !/^[0-9a-f]{64}$/i.test(decision.sourceEvidenceSha256 || ''))
    ) {
      errors.push(`eligible system ${id} lacks reviewer or source evidence digest`);
    }
    if (decision?.decision === 'eligible' && isProtected(byId.get(id) || { id }, namingManifest)) {
      errors.push(`eligible system ${id} conflicts with protection or a source proper name`);
    }
    if (decision?.decision === 'eligible') {
      const evidence = getSourceEvidence(byId.get(id) || { id });
      if (
        !evidence ||
        evidence.digest !== decision.sourceEvidenceSha256 ||
        evidence.snapshot !== decision.sourceSnapshot
      ) {
        errors.push(`eligible system ${id} has stale or mismatched source evidence`);
      }
    }
  }

  const publishableAssignments = { ...(namingManifest.approvedAssignments || {}) };
  for (const [id, override] of Object.entries(namingManifest.overrides || {})) {
    if (override?.settlementName) publishableAssignments[id] = override;
    if (override?.keepCatalogLabel && override.status !== 'approved') {
      errors.push(`keep-catalog override ${id} is not approved`);
    }
  }
  for (const [id, assignment] of Object.entries(publishableAssignments)) {
    if (assignment?.status !== 'approved') {
      errors.push(`assignment ${id} is not approved`);
    }
    if (namingManifest.eligibility?.[id]?.decision !== 'eligible') {
      errors.push(`assignment ${id} lacks explicit eligible review`);
    }
    if (isProtected(byId.get(id) || { id }, namingManifest)) {
      errors.push(`assignment ${id} conflicts with protection`);
    }
    if (typeof assignment?.settlementName !== 'string' || !assignment.settlementName.trim()) {
      errors.push(`assignment ${id} has no settlement name`);
    }
  }
  const labelOwners = new Map();
  for (const system of registry) {
    for (const label of [
      system.displayName,
      system.catalogName,
      system.primaryStar?.properName,
      ...(Array.isArray(system.aliases) ? system.aliases : []),
    ]) {
      for (const key of comparisonKeys(label)) {
        if (!labelOwners.has(key)) labelOwners.set(key, new Set());
        labelOwners.get(key).add(system.id);
      }
    }
  }
  const assignedKeys = new Map();
  for (const [id, assignment] of Object.entries(publishableAssignments)) {
    for (const key of comparisonKeys(assignment?.settlementName)) {
      if (assignedKeys.has(key)) {
        errors.push(`assignment name collision between ${assignedKeys.get(key)} and ${id}`);
      } else {
        assignedKeys.set(key, id);
      }
      for (const otherId of labelOwners.get(key) || []) {
        if (otherId !== id) {
          errors.push(`assignment name collision between ${id} and ${otherId}`);
        }
      }
    }
  }
  if (errors.length) throw new Error(`Invalid system naming manifest: ${errors.join('; ')}`);
  return true;
}

function resolveSystemNaming(system, namingManifest = manifest) {
  const override = namingManifest.overrides?.[system.id];
  const assignment =
    override?.status === 'approved' && override.settlementName
      ? override
      : namingManifest.approvedAssignments?.[system.id];
  const canPublish =
    namingManifest.runtimeEnabled === true &&
    assignment?.status === 'approved' &&
    namingManifest.eligibility?.[system.id]?.decision === 'eligible' &&
    override?.keepCatalogLabel !== true &&
    !isProtected(system, namingManifest);
  const settlementName = canPublish ? assignment.settlementName : null;
  const catalogName = system.catalogName || null;
  const displayName = settlementName
    ? `${settlementName} (${catalogName || system.displayName})`
    : system.displayName;
  const aliases = uniqueNames([
    ...(Array.isArray(system.aliases) ? system.aliases : []),
    catalogName,
    system.primaryStar?.properName,
    ...(Array.isArray(namingManifest.aliases?.[system.id])
      ? namingManifest.aliases[system.id]
      : []),
    ...(settlementName ? [system.displayName] : []),
  ]).filter((name) => normalizeAlias(name) !== normalizeAlias(displayName));

  return { ...system, displayName, catalogName, settlementName, aliases };
}

function getSystemNamingManifest() {
  return manifest;
}

module.exports = {
  getSystemNamingManifest,
  comparisonKeys,
  getSourceEvidence,
  isProtected,
  normalizeAlias,
  resolveSystemNaming,
  validateNamingManifest,
};
