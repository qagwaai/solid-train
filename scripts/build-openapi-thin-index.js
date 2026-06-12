'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseOpenApiYamlText(yamlText) {
  const lines = yamlText.split(/\r?\n/);

  const tags = [];
  const paths = [];
  const schemas = [];

  let section = null;
  let inSchemas = false;

  for (const line of lines) {
    if (/^[a-zA-Z][a-zA-Z0-9_-]*:\s*$/.test(line)) {
      const key = line.replace(':', '').trim();
      section = key;
      if (key !== 'components') inSchemas = false;
      continue;
    }

    if (section === 'tags') {
      const tagMatch = line.match(/^  - name:\s*(.+)\s*$/);
      if (tagMatch) tags.push(tagMatch[1].trim());
      continue;
    }

    if (section === 'paths') {
      const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
      if (pathMatch) paths.push(pathMatch[1]);
      continue;
    }

    if (section === 'components') {
      if (/^  schemas:\s*$/.test(line)) {
        inSchemas = true;
        continue;
      }
      if (inSchemas) {
        const schemaMatch = line.match(/^    ([A-Za-z0-9_]+):\s*$/);
        if (schemaMatch) schemas.push(schemaMatch[1]);
      }
    }
  }

  return { tags, paths, schemas };
}

function parseModuleOwnership(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = parseOpenApiYamlText(text);
  return parsed;
}

function pathPointer(pathName) {
  return pathName.replace(/\//g, '~1');
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const rootPath = path.join(repoRoot, 'api', 'openapi.yaml');
  const modulesDir = path.join(repoRoot, 'api', 'openapi');

  const rootText = fs.readFileSync(rootPath, 'utf8');
  const rootParsed = parseOpenApiYamlText(rootText);

  const moduleDirs = fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((d) => d !== '_shared');

  const pathOwner = new Map();
  const schemaOwner = new Map();

  // Shared schemas first (preferred owner)
  const sharedPath = path.join(modulesDir, '_shared', 'schemas.yaml');
  if (fs.existsSync(sharedPath)) {
    const shared = parseModuleOwnership(sharedPath);
    for (const s of shared.schemas) schemaOwner.set(s, '_shared/schemas.yaml');
  }

  for (const mod of moduleDirs) {
    const filePath = path.join(modulesDir, mod, 'openapi.yaml');
    if (!fs.existsSync(filePath)) continue;
    const parsed = parseModuleOwnership(filePath);

    for (const p of parsed.paths) {
      if (!pathOwner.has(p)) pathOwner.set(p, `${mod}/openapi.yaml`);
    }
    for (const s of parsed.schemas) {
      if (!schemaOwner.has(s)) schemaOwner.set(s, `${mod}/openapi.yaml`);
    }
  }

  const missingPaths = rootParsed.paths.filter((p) => !pathOwner.has(p));
  const missingSchemas = rootParsed.schemas.filter((s) => !schemaOwner.has(s));

  if (missingPaths.length || missingSchemas.length) {
    console.error('Cannot build thin index; missing ownership.');
    console.error('missingPaths:', missingPaths);
    console.error('missingSchemas:', missingSchemas);
    process.exit(1);
  }

  const out = [];
  out.push('openapi: 3.0.3');
  out.push('info:');
  out.push('  title: Stellar API and Message Contract');
  out.push('  version: 3.1.0');
  out.push('  description: >');
  out.push('    Machine-readable contract for HTTP endpoints and Socket.IO message payloads.');
  out.push('    Socket operations are modeled as virtual POST operations under /socket/* so the');
  out.push('    contract can be consumed by tooling that expects OpenAPI.');
  out.push('servers:');
  out.push('  - url: http://localhost:3000');
  out.push('tags:');
  for (const tag of rootParsed.tags) {
    out.push(`  - name: ${tag}`);
  }

  out.push('paths:');
  for (const p of rootParsed.paths) {
    const owner = pathOwner.get(p);
    out.push(`  ${p}:`);
    out.push(`    $ref: './openapi/${owner}#/paths/${pathPointer(p)}'`);
  }

  out.push('components:');
  out.push('  schemas:');
  for (const s of rootParsed.schemas) {
    const owner = schemaOwner.get(s);
    out.push(`    ${s}:`);
    out.push(`      $ref: './openapi/${owner}#/components/schemas/${s}'`);
  }

  fs.writeFileSync(rootPath, `${out.join('\n')}\n`, 'utf8');
  console.log('Wrote thin index:', rootPath);
  console.log('paths:', rootParsed.paths.length, 'schemas:', rootParsed.schemas.length);
}

main();
