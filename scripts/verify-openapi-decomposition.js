'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseOpenApiYamlText(yamlText) {
  const lines = yamlText.split(/\r?\n/);

  const tags = [];
  const pathOps = new Map(); // key: METHOD path -> operationId (or null)
  const pathMethods = new Set(); // key: METHOD path
  const schemas = new Set();

  let section = null; // tags | paths | components | other
  let inSchemas = false;
  let currentPath = null;
  let currentMethod = null;

  for (const rawLine of lines) {
    const line = rawLine;

    // Top-level section switches
    if (/^[a-zA-Z][a-zA-Z0-9_-]*:\s*$/.test(line)) {
      const key = line.replace(':', '').trim();
      section = key;
      if (key !== 'components') {
        inSchemas = false;
      }
      currentPath = null;
      currentMethod = null;
      continue;
    }

    if (section === 'tags') {
      const tagMatch = line.match(/^  - name:\s*(.+)\s*$/);
      if (tagMatch) {
        tags.push(tagMatch[1].trim());
      }
      continue;
    }

    if (section === 'paths') {
      const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
      if (pathMatch) {
        currentPath = pathMatch[1];
        currentMethod = null;
        continue;
      }

      const methodMatch = line.match(/^    (get|post|put|patch|delete|options|head):\s*$/);
      if (methodMatch && currentPath) {
        currentMethod = methodMatch[1].toUpperCase();
        pathMethods.add(`${currentMethod} ${currentPath}`);
        continue;
      }

      const opIdMatch = line.match(/^      operationId:\s*(.+)\s*$/);
      if (opIdMatch && currentPath && currentMethod) {
        const key = `${currentMethod} ${currentPath}`;
        pathOps.set(key, opIdMatch[1].trim());
      }
      continue;
    }

    if (section === 'components') {
      if (/^  schemas:\s*$/.test(line)) {
        inSchemas = true;
        continue;
      }
      if (inSchemas) {
        const schemaMatch = line.match(/^    ([A-Za-z0-9_]+):\s*$/);
        if (schemaMatch) {
          schemas.add(schemaMatch[1]);
          continue;
        }

        // Exit schemas when another components child starts at same indent
        if (/^  [A-Za-z0-9_-]+:\s*$/.test(line) && !/^  schemas:\s*$/.test(line)) {
          inSchemas = false;
        }
      }
    }
  }

  return { tags, pathOps, pathMethods, schemas };
}

function load(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseOpenApiYamlText(content);
}

function listTagFiles(baseDir) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const p = path.join(baseDir, entry.name, 'openapi.yaml');
    if (fs.existsSync(p)) result.push({ tagDir: entry.name, file: p });
  }
  return result;
}

function diffSet(leftSet, rightSet) {
  const left = [...leftSet];
  const right = [...rightSet];
  return {
    missingFromRight: left.filter((x) => !rightSet.has(x)).sort(),
    extraInRight: right.filter((x) => !leftSet.has(x)).sort(),
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const rootSpecPath = path.join(repoRoot, 'api', 'openapi.yaml');
  const modulesBase = path.join(repoRoot, 'api', 'openapi');
  const sharedPath = path.join(modulesBase, '_shared', 'schemas.yaml');

  const rootSpec = load(rootSpecPath);

  const tagFiles = listTagFiles(modulesBase).filter((x) => x.tagDir !== '_shared');

  const modulePathOps = new Map();
  const modulePathMethods = new Set();
  const moduleSchemas = new Set();
  const moduleTagNames = new Set();
  const pathOwners = new Map(); // METHOD path -> [tagDir]

  for (const tagFile of tagFiles) {
    const parsed = load(tagFile.file);
    if (parsed.tags.length > 0) {
      moduleTagNames.add(parsed.tags[0]);
    }

    for (const [k, v] of parsed.pathOps.entries()) {
      if (!pathOwners.has(k)) pathOwners.set(k, []);
      pathOwners.get(k).push(tagFile.tagDir);
      modulePathOps.set(k, v);
    }
    for (const k of parsed.pathMethods.values()) {
      modulePathMethods.add(k);
    }

    for (const s of parsed.schemas) moduleSchemas.add(s);
  }

  if (fs.existsSync(sharedPath)) {
    const shared = load(sharedPath);
    for (const s of shared.schemas) moduleSchemas.add(s);
  }

  const rootPathMethodKeys = new Set(rootSpec.pathMethods.values());
  const pathDiff = diffSet(rootPathMethodKeys, modulePathMethods);

  const duplicatePaths = [...pathOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([k, owners]) => ({ pathOp: k, owners }));

  const opIdMismatches = [];
  for (const k of rootPathMethodKeys) {
    if (!rootSpec.pathOps.has(k) || !modulePathOps.has(k)) continue;
    const rootOpId = rootSpec.pathOps.get(k);
    const moduleOpId = modulePathOps.get(k);
    if (rootOpId && moduleOpId && rootOpId !== moduleOpId) {
      opIdMismatches.push({ pathOp: k, rootOpId, moduleOpId });
    }
  }

  const rootSchemaSet = new Set(rootSpec.schemas);
  const schemaDiff = diffSet(rootSchemaSet, moduleSchemas);

  const rootTagSet = new Set(rootSpec.tags);
  const moduleTagSet = new Set(moduleTagNames);
  const tagDiff = diffSet(rootTagSet, moduleTagSet);

  const report = {
    counts: {
      rootTags: rootSpec.tags.length,
      moduleTags: moduleTagNames.size,
      rootPathMethods: rootSpec.pathMethods.size,
      modulePathMethods: modulePathMethods.size,
      rootPathOpsWithOperationId: rootSpec.pathOps.size,
      modulePathOpsWithOperationId: modulePathOps.size,
      rootSchemas: rootSpec.schemas.size,
      moduleSchemasIncludingShared: moduleSchemas.size,
    },
    tagCoverage: tagDiff,
    pathCoverage: {
      ...pathDiff,
      duplicateOwnership: duplicatePaths,
      operationIdMismatches: opIdMismatches,
    },
    schemaCoverage: schemaDiff,
    isReadyForThinIndex:
      tagDiff.missingFromRight.length === 0 &&
      pathDiff.missingFromRight.length === 0 &&
      pathDiff.extraInRight.length === 0 &&
      duplicatePaths.length === 0 &&
      opIdMismatches.length === 0 &&
      schemaDiff.missingFromRight.length === 0,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
