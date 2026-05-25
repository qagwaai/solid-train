'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CATEGORY = {
  REMOVED_REQUIRED: 'removed required fields',
  TYPE_MISMATCH: 'type mismatches',
  ENUM_MISMATCH: 'enum narrowing/mismatch',
  ENDPOINT_EVENT_REMOVAL: 'endpoint/event removal or rename',
};

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }
  return result;
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortValue(value[key]);
    }
    return sorted;
  }

  return value;
}

function stableStringify(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeType(type) {
  if (!type) {
    return [];
  }

  if (Array.isArray(type)) {
    return [...new Set(type)].sort();
  }

  return [type];
}

function arraysEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

function inferConsumerSurfaces(text) {
  const lower = text.toLowerCase();
  const surfaces = new Set();

  if (/(login|register|session|auth|invalid-session)/.test(lower)) {
    surfaces.add('Authentication/session');
  }
  if (/(character|ship)/.test(lower)) {
    surfaces.add('Character/ship');
  }
  if (/(market|ledger|credit)/.test(lower)) {
    surfaces.add('Market/ledger');
  }
  if (/(mission)/.test(lower)) {
    surfaces.add('Mission progression');
  }
  if (/(item|catalog|launch)/.test(lower)) {
    surfaces.add('Item/catalog');
  }
  if (/(celestial|routing|travel|solar-system|star|context-distance|context-routing)/.test(lower)) {
    surfaces.add('Celestial/routing/travel');
  }

  if (surfaces.size === 0) {
    surfaces.add('Unmapped surface');
  }

  return [...surfaces].sort();
}

function createIssue({ category, location, detail, strategy }) {
  return {
    category,
    severity: 'high',
    owner: 'backend-lead',
    producerLocation: location,
    knownConsumers: ['laughing-octo-journey'],
    consumerSurfaces: inferConsumerSurfaces(location),
    detail,
    suggestedCompatibilityStrategy: strategy,
  };
}

function detectEndpointRemovals(oldArtifact, newArtifact) {
  const issues = [];

  const oldApi = new Set(oldArtifact?.surfaces?.apiEndpoints || []);
  const newApi = new Set(newArtifact?.surfaces?.apiEndpoints || []);
  const oldSocket = new Set(oldArtifact?.surfaces?.socketEndpoints || []);
  const newSocket = new Set(newArtifact?.surfaces?.socketEndpoints || []);

  for (const endpoint of [...oldApi].sort()) {
    if (!newApi.has(endpoint)) {
      issues.push(
        createIssue({
          category: CATEGORY.ENDPOINT_EVENT_REMOVAL,
          location: `path:${endpoint}`,
          detail: `API endpoint removed or renamed: ${endpoint}`,
          strategy: 'Restore endpoint or provide compatibility alias/deprecation window.',
        })
      );
    }
  }

  for (const endpoint of [...oldSocket].sort()) {
    if (!newSocket.has(endpoint)) {
      issues.push(
        createIssue({
          category: CATEGORY.ENDPOINT_EVENT_REMOVAL,
          location: `socket:${endpoint}`,
          detail: `Socket contract endpoint removed or renamed: ${endpoint}`,
          strategy:
            'Restore socket event alias or keep old event contract during migration window.',
        })
      );
    }
  }

  return issues;
}

function compareSchemaNode(oldNode, newNode, pointer, issues) {
  if (!oldNode || !newNode || typeof oldNode !== 'object' || typeof newNode !== 'object') {
    return;
  }

  const oldTypes = normalizeType(oldNode.type);
  const newTypes = normalizeType(newNode.type);
  if (oldTypes.length > 0 && newTypes.length > 0 && !arraysEqual(oldTypes, newTypes)) {
    issues.push(
      createIssue({
        category: CATEGORY.TYPE_MISMATCH,
        location: pointer,
        detail: `Type changed from [${oldTypes.join(', ')}] to [${newTypes.join(', ')}]`,
        strategy:
          'Preserve prior type support or add compatibility translation in producer payload.',
      })
    );
  }

  if (Array.isArray(oldNode.enum) && Array.isArray(newNode.enum)) {
    const oldEnum = [...new Set(oldNode.enum.map(String))].sort();
    const newEnum = [...new Set(newNode.enum.map(String))].sort();
    const removed = oldEnum.filter((value) => !newEnum.includes(value));

    if (removed.length > 0 || !arraysEqual(oldEnum, newEnum)) {
      issues.push(
        createIssue({
          category: CATEGORY.ENUM_MISMATCH,
          location: pointer,
          detail:
            removed.length > 0
              ? `Enum narrowed; removed values: [${removed.join(', ')}]`
              : `Enum mismatch; old=[${oldEnum.join(', ')}], new=[${newEnum.join(', ')}]`,
          strategy: 'Avoid enum narrowing or preserve old values with deprecation window.',
        })
      );
    }
  }

  const oldRequired = new Set(Array.isArray(oldNode.required) ? oldNode.required : []);
  const newRequired = new Set(Array.isArray(newNode.required) ? newNode.required : []);
  for (const requiredField of [...oldRequired].sort()) {
    if (!newRequired.has(requiredField)) {
      issues.push(
        createIssue({
          category: CATEGORY.REMOVED_REQUIRED,
          location: `${pointer}.required.${requiredField}`,
          detail: `Required field no longer required in new contract: ${requiredField}`,
          strategy: 'Keep field required or provide compatibility guarantee plus migration note.',
        })
      );
    }
  }

  const oldProperties =
    oldNode.properties && typeof oldNode.properties === 'object' ? oldNode.properties : {};
  const newProperties =
    newNode.properties && typeof newNode.properties === 'object' ? newNode.properties : {};

  for (const propertyName of Object.keys(oldProperties).sort()) {
    const oldProperty = oldProperties[propertyName];
    const newProperty = newProperties[propertyName];
    const propertyPointer = `${pointer}.properties.${propertyName}`;

    if (!newProperty) {
      if (oldRequired.has(propertyName)) {
        issues.push(
          createIssue({
            category: CATEGORY.REMOVED_REQUIRED,
            location: propertyPointer,
            detail: `Required property removed or renamed: ${propertyName}`,
            strategy: 'Restore property or keep compatibility alias during migration window.',
          })
        );
      }
      continue;
    }

    compareSchemaNode(oldProperty, newProperty, propertyPointer, issues);
  }

  if (oldNode.items && newNode.items) {
    compareSchemaNode(oldNode.items, newNode.items, `${pointer}.items`, issues);
  }

  const combinators = ['oneOf', 'anyOf', 'allOf'];
  for (const key of combinators) {
    if (Array.isArray(oldNode[key]) && Array.isArray(newNode[key])) {
      const pairs = Math.min(oldNode[key].length, newNode[key].length);
      for (let index = 0; index < pairs; index += 1) {
        compareSchemaNode(
          oldNode[key][index],
          newNode[key][index],
          `${pointer}.${key}[${index}]`,
          issues
        );
      }
    }
  }
}

function detectSchemaDrift(oldArtifact, newArtifact) {
  const issues = [];
  const oldSchemas = oldArtifact?.components?.schemas || {};
  const newSchemas = newArtifact?.components?.schemas || {};

  for (const schemaName of Object.keys(oldSchemas).sort()) {
    if (!newSchemas[schemaName]) {
      issues.push(
        createIssue({
          category: CATEGORY.ENDPOINT_EVENT_REMOVAL,
          location: `schema:${schemaName}`,
          detail: `Schema removed or renamed: ${schemaName}`,
          strategy: 'Restore schema alias or keep compatibility reference during migration window.',
        })
      );
      continue;
    }

    compareSchemaNode(
      oldSchemas[schemaName],
      newSchemas[schemaName],
      `schema:${schemaName}`,
      issues
    );
  }

  return issues;
}

function analyzeDrift(oldArtifact, newArtifact) {
  const issues = [
    ...detectEndpointRemovals(oldArtifact, newArtifact),
    ...detectSchemaDrift(oldArtifact, newArtifact),
  ];

  issues.sort((left, right) => {
    if (left.category !== right.category) {
      return left.category.localeCompare(right.category);
    }
    return left.producerLocation.localeCompare(right.producerLocation);
  });

  const summaryByCategory = {};
  for (const category of Object.values(CATEGORY)) {
    summaryByCategory[category] = 0;
  }
  for (const issue of issues) {
    summaryByCategory[issue.category] = (summaryByCategory[issue.category] || 0) + 1;
  }

  return {
    taxonomy: CATEGORY,
    summary: {
      totalIssues: issues.length,
      byCategory: summaryByCategory,
      impactedConsumers: ['laughing-octo-journey'],
      mode: 'report-only',
    },
    issues,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(__dirname, '..', '..');

  const baselinePath = path.resolve(
    rootDir,
    args.baseline || 'artifacts/contracts/baseline-contract-artifact.json'
  );
  const currentPath = path.resolve(
    rootDir,
    args.current || 'artifacts/contracts/contract-artifact.json'
  );
  const reportPath = path.resolve(rootDir, args.report || 'artifacts/contracts/drift-report.json');
  const mode = args.mode || 'report-only';

  const baselineExists = fs.existsSync(baselinePath);
  const currentExists = fs.existsSync(currentPath);

  if (!currentExists) {
    throw new Error(`Current artifact not found: ${currentPath}`);
  }

  const baselineArtifact = baselineExists
    ? readJson(baselinePath)
    : { surfaces: {}, components: {} };
  const currentArtifact = readJson(currentPath);

  const report = analyzeDrift(baselineArtifact, currentArtifact);
  report.summary.mode = mode;
  report.metadata = {
    baselinePath: path.relative(rootDir, baselinePath),
    currentPath: path.relative(rootDir, currentPath),
    baselineMissing: !baselineExists,
    generatedBy: 'scripts/sw08/check-contract-drift.js',
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, stableStringify(report), 'utf8');

  console.log(`[sw08] drift report generated: ${path.relative(rootDir, reportPath)}`);
  console.log(`[sw08] mode=${mode} totalIssues=${report.summary.totalIssues}`);

  // Stage 1 is explicitly report-only. Never fail the process here.
  process.exitCode = 0;
}

if (require.main === module) {
  main();
}

module.exports = {
  CATEGORY,
  analyzeDrift,
};
