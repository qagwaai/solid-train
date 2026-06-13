'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const prettier = require('prettier');

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

async function formatJson(value, filePath) {
  const config = (await prettier.resolveConfig(filePath)) || {};
  return prettier.format(stableStringify(value), { ...config, parser: 'json' });
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractOpenApiPaths(openApiText) {
  const pathsSectionStart = openApiText.indexOf('\npaths:\n');
  const componentsSectionStart = openApiText.indexOf('\ncomponents:\n');
  const scoped =
    pathsSectionStart >= 0 && componentsSectionStart > pathsSectionStart
      ? openApiText.slice(pathsSectionStart, componentsSectionStart)
      : openApiText;

  const pathRegex = /^\s{2}(\/[A-Za-z0-9_.\-/{}]+):\s*$/gm;
  const found = new Set();
  let match = pathRegex.exec(scoped);
  while (match) {
    found.add(match[1]);
    match = pathRegex.exec(scoped);
  }

  return [...found].sort();
}

function extractSchemaRefMap(openApiText) {
  const refs = {};

  const rootComponentRefRegex = /^\s{4}([A-Za-z0-9_-]+):\s*\n\s{6}\$ref:\s*'([^']+)'\s*$/gm;
  const rootMatches = [];

  let match = rootComponentRefRegex.exec(openApiText);
  while (match) {
    rootMatches.push({ schemaName: match[1], refPath: match[2] });
    match = rootComponentRefRegex.exec(openApiText);
  }

  function toKebabCase(value) {
    return value
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase();
  }

  function resolveSchemaFileFromRefPath(refPath) {
    const jsonMatch = refPath.match(/(?:\.\.\/|\.\/)*schemas\/([^'#]+\.json)$/);
    return jsonMatch ? jsonMatch[1] : null;
  }

  function resolveViaModuleRef(schemaName, moduleRefPath) {
    const moduleMatch = moduleRefPath.match(/^\.\/openapi\/([^'#]+)\.yaml#\/components\/schemas\/([A-Za-z0-9_-]+)$/);
    if (!moduleMatch) {
      return null;
    }

    const moduleFilePath = path.join(path.dirname(path.join('api', 'openapi.yaml')), 'openapi', `${moduleMatch[1]}.yaml`);
    const moduleAbsolutePath = path.resolve(process.cwd(), moduleFilePath);
    if (!fs.existsSync(moduleAbsolutePath)) {
      return null;
    }

    const moduleText = readText(moduleAbsolutePath);
    const moduleSchemaName = moduleMatch[2];
    const escapedSchemaName = moduleSchemaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const moduleSchemaRefRegex = new RegExp(
      `^\\s{4}${escapedSchemaName}:\\s*\\n\\s{6}\\$ref:\\s*'([^']+)'\\s*$`,
      'm'
    );
    const moduleRefMatch = moduleText.match(moduleSchemaRefRegex);
    if (moduleRefMatch) {
      const schemaFile = resolveSchemaFileFromRefPath(moduleRefMatch[1]);
      if (schemaFile) {
        return schemaFile;
      }
    }

    const fallbackFile = `${toKebabCase(schemaName)}.schema.json`;
    const fallbackAbsolutePath = path.resolve(process.cwd(), path.join('api', 'schemas', fallbackFile));
    return fs.existsSync(fallbackAbsolutePath) ? fallbackFile : null;
  }

  for (const { schemaName, refPath } of rootMatches) {
    const directSchemaFile = resolveSchemaFileFromRefPath(refPath);
    if (directSchemaFile) {
      refs[schemaName] = directSchemaFile;
      continue;
    }

    const moduleResolvedSchemaFile = resolveViaModuleRef(schemaName, refPath);
    if (moduleResolvedSchemaFile) {
      refs[schemaName] = moduleResolvedSchemaFile;
      continue;
    }

    const fallbackFile = `${toKebabCase(schemaName)}.schema.json`;
    const fallbackAbsolutePath = path.resolve(process.cwd(), path.join('api', 'schemas', fallbackFile));
    if (fs.existsSync(fallbackAbsolutePath)) {
      refs[schemaName] = fallbackFile;
    }
  }

  return refs;
}

function loadSchemas(rootDir, schemaRefMap) {
  const loaded = {};
  for (const schemaName of Object.keys(schemaRefMap).sort()) {
    const schemaFile = schemaRefMap[schemaName];
    const schemaPath = path.join(rootDir, 'api', 'schemas', schemaFile);
    const raw = readText(schemaPath);
    loaded[schemaName] = JSON.parse(raw);
  }
  return loaded;
}

function buildArtifact(rootDir) {
  const openApiPath = path.join(rootDir, 'api', 'openapi.yaml');
  const openApiText = readText(openApiPath);
  const allPaths = extractOpenApiPaths(openApiText);
  const apiEndpoints = allPaths.filter((entry) => !entry.startsWith('/socket/'));
  const socketEndpoints = allPaths.filter((entry) => entry.startsWith('/socket/'));
  const socketEvents = socketEndpoints.map((entry) => entry.slice('/socket/'.length)).sort();

  const schemaRefMap = extractSchemaRefMap(openApiText);
  const schemas = loadSchemas(rootDir, schemaRefMap);

  const schemaBundle = stableStringify(schemas);
  const openApiNormalized = openApiText.replace(/\r\n/g, '\n');

  return {
    schemaVersion: 'sw-08-v1',
    producer: {
      repo: 'solid-train',
      contractSource: 'api/openapi.yaml + ./api/schemas/*.json',
    },
    surfaces: {
      apiEndpoints,
      socketEndpoints,
      socketEvents,
    },
    components: {
      schemaRefMap,
      schemas,
    },
    checksums: {
      openApiSha256: sha256(openApiNormalized),
      schemaBundleSha256: sha256(schemaBundle),
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(__dirname, '..', '..');
  const outputPath = path.resolve(
    rootDir,
    args.out || 'api/artifacts/contracts/contract-artifact.json'
  );

  const artifact = buildArtifact(rootDir);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await formatJson(artifact, outputPath), 'utf8');

  console.log(
    `[sw08] wrote deterministic contract artifact: ${path.relative(rootDir, outputPath)}`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildArtifact,
  extractOpenApiPaths,
  extractSchemaRefMap,
  sortValue,
};
