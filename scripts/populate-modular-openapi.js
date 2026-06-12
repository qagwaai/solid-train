#!/usr/bin/env node

/**
 * Populate api/openapi/{tag}/openapi.yaml from the master api/openapi.yaml.
 *
 * - Preserves path blocks, descriptions, and examples verbatim from source.
 * - Includes referenced component schemas for each tag (transitively).
 * - Rewrites ErrorResponse schema to reference ../_shared/schemas.yaml.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAIN_SPEC_PATH = path.join(ROOT, 'api', 'openapi.yaml');
const OUT_ROOT = path.join(ROOT, 'api', 'openapi');

const mainSpec = fs.readFileSync(MAIN_SPEC_PATH, 'utf8').replace(/\r\n/g, '\n');
const lines = mainSpec.split('\n');

function findIndex(predicate, start = 0) {
  for (let i = start; i < lines.length; i += 1) {
    if (predicate(lines[i], i)) return i;
  }
  return -1;
}

function trimTrailingBlankLines(blockLines) {
  let end = blockLines.length;
  while (end > 0 && blockLines[end - 1].trim() === '') {
    end -= 1;
  }
  return blockLines.slice(0, end);
}

const openapiLine = lines[findIndex((line) => line.startsWith('openapi:'))] || 'openapi: 3.0.3';
const versionLine = lines[findIndex((line) => line.trim().startsWith('version:'), findIndex((line) => line.startsWith('info:')))] || '  version: 0.0.0';
const serverUrlLine = lines[findIndex((line) => line.trim().startsWith('- url:'), findIndex((line) => line.startsWith('servers:')))] || '  - url: http://localhost:3000';

const tagsStart = findIndex((line) => line.startsWith('tags:'));
if (tagsStart === -1) {
  console.error('Unable to locate tags section in api/openapi.yaml');
  process.exit(1);
}

const tags = [];
for (let i = tagsStart + 1; i < lines.length; i += 1) {
  const line = lines[i];
  if (/^\S/.test(line)) break;
  const match = line.match(/^\s*-\s+name:\s*(.+)$/);
  if (match) {
    tags.push(match[1].trim());
  }
}

const pathsStart = findIndex((line) => line.startsWith('paths:'));
const componentsStart = findIndex((line) => line.startsWith('components:'));
const schemasStart = findIndex((line) => line.trim() === 'schemas:', componentsStart);

if (pathsStart === -1 || componentsStart === -1 || schemasStart === -1) {
  console.error('Unable to locate paths/components.schemas sections in api/openapi.yaml');
  process.exit(1);
}

function parsePathBlocks() {
  const blocks = [];
  let i = pathsStart + 1;

  while (i < componentsStart) {
    const line = lines[i];
    if (line.startsWith('  /')) {
      const pathName = line.slice(2, line.indexOf(':'));
      const start = i;
      i += 1;
      while (i < componentsStart && !lines[i].startsWith('  /')) {
        i += 1;
      }
      const blockLines = trimTrailingBlankLines(lines.slice(start, i));
      const raw = blockLines.join('\n');
      const tagMatch = raw.match(/\n\s+tags:\s*\[([^\]]+)\]/);
      const tagName = tagMatch ? tagMatch[1].split(',')[0].trim() : null;

      blocks.push({ pathName, raw, tagName });
    } else {
      i += 1;
    }
  }

  return blocks;
}

function parseSchemaBlocks() {
  const schemaMap = new Map();
  let i = schemasStart + 1;

  while (i < lines.length) {
    const line = lines[i];
    if (/^\S/.test(line)) break;

    const schemaHeader = line.match(/^\s{4}([^:\s]+):\s*$/);
    if (schemaHeader) {
      const name = schemaHeader[1];
      const start = i;
      i += 1;
      while (i < lines.length) {
        if (/^\S/.test(lines[i])) break;
        if (/^\s{4}[^:\s]+:\s*$/.test(lines[i])) break;
        i += 1;
      }
      const blockLines = trimTrailingBlankLines(lines.slice(start, i));
      schemaMap.set(name, blockLines.join('\n'));
    } else {
      i += 1;
    }
  }

  return schemaMap;
}

function collectRefs(text) {
  const refs = new Set();
  const regex = /#\/components\/schemas\/([A-Za-z0-9_.-]+)/g;
  let match = regex.exec(text);
  while (match) {
    refs.add(match[1]);
    match = regex.exec(text);
  }
  return refs;
}

function collectTagSchemaNames(pathBlocks, schemaBlocks) {
  const needed = new Set();
  const queue = [];

  pathBlocks.forEach((block) => {
    collectRefs(block.raw).forEach((ref) => {
      if (!needed.has(ref)) {
        needed.add(ref);
        queue.push(ref);
      }
    });
  });

  while (queue.length > 0) {
    const name = queue.shift();
    const schemaRaw = schemaBlocks.get(name);
    if (!schemaRaw) continue;
    collectRefs(schemaRaw).forEach((ref) => {
      if (!needed.has(ref)) {
        needed.add(ref);
        queue.push(ref);
      }
    });
  }

  return needed;
}

function sortBySourceOrder(items, sourceOrder) {
  const indexMap = new Map(sourceOrder.map((name, idx) => [name, idx]));
  return [...items].sort((a, b) => {
    const ai = indexMap.has(a) ? indexMap.get(a) : Number.MAX_SAFE_INTEGER;
    const bi = indexMap.has(b) ? indexMap.get(b) : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

function tagToDir(tagName) {
  return tagName.toLowerCase().replace(/\s+/g, '');
}

const pathBlocks = parsePathBlocks();
const schemaBlocks = parseSchemaBlocks();
const schemaOrder = [...schemaBlocks.keys()];

const summary = [];

tags.forEach((tagName) => {
  const selectedPaths = pathBlocks.filter((p) => p.tagName === tagName);
  const neededSchemas = collectTagSchemaNames(selectedPaths, schemaBlocks);
  const orderedSchemaNames = sortBySourceOrder(neededSchemas, schemaOrder);

  const outLines = [];
  outLines.push(openapiLine);
  outLines.push('info:');
  outLines.push(`  title: Stellar API - ${tagName}`);
  outLines.push(versionLine);
  outLines.push('servers:');
  outLines.push(serverUrlLine);
  outLines.push('tags:');
  outLines.push(`  - name: ${tagName}`);
  outLines.push('paths:');

  if (selectedPaths.length === 0) {
    outLines.push('  {}');
  } else {
    selectedPaths.forEach((p, idx) => {
      outLines.push(p.raw);
      if (idx < selectedPaths.length - 1) outLines.push('');
    });
  }

  outLines.push('components:');
  outLines.push('  schemas:');

  if (orderedSchemaNames.length === 0) {
    outLines.push('    {}');
  } else {
    orderedSchemaNames.forEach((schemaName) => {
      if (schemaName === 'ErrorResponse') {
        outLines.push('    ErrorResponse:');
        outLines.push("      $ref: '../_shared/schemas.yaml#/components/schemas/ErrorResponse'");
      } else {
        const raw = schemaBlocks.get(schemaName);
        if (raw) {
          // Tag module files live one directory deeper than api/openapi.yaml.
          outLines.push(raw.replace(/\$ref:\s*'\.\/schemas\//g, "$ref: '../schemas/"));
        }
      }
    });
  }

  const outPath = path.join(OUT_ROOT, tagToDir(tagName), 'openapi.yaml');
  fs.writeFileSync(outPath, `${outLines.join('\n')}\n`, 'utf8');

  summary.push({
    tagName,
    pathCount: selectedPaths.length,
    schemaCount: orderedSchemaNames.length,
    outPath,
  });
});

console.log('Populated modular OpenAPI files:\n');
summary.forEach((entry) => {
  console.log(
    `- ${entry.tagName.padEnd(11)} paths=${String(entry.pathCount).padEnd(2)} schemas=${String(entry.schemaCount).padEnd(3)} -> ${path.relative(ROOT, entry.outPath)}`,
  );
});
