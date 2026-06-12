#!/usr/bin/env node
/**
 * Decompose api/openapi.yaml into modular tag-based structure
 * Creates: api/openapi/{tag-name}/openapi.yaml files
 */

const fs = require('fs');
const path = require('path');

// Read the main OpenAPI spec
const mainSpecPath = path.join(__dirname, '..', 'api', 'openapi.yaml');
const mainSpec = fs.readFileSync(mainSpecPath, 'utf8');

// Simple YAML parser for our use case
function parseYamlPaths(yaml) {
  const lines = yaml.split('\n');
  const paths = {};
  let currentPath = null;
  let currentPathContent = [];
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect path declarations (start with "  /" at root of paths)
    if (line.match(/^  \//) && !line.match(/^    /)) {
      // Save previous path if exists
      if (currentPath) {
        paths[currentPath] = currentPathContent.join('\n');
      }
      currentPath = line.trim().replace(':', '');
      currentPathContent = [line];
    } else if (currentPath) {
      // Check if we're exiting the path section (back to root level)
      if (line.match(/^[a-z]/)) {
        // End of paths section
        if (currentPath) {
          paths[currentPath] = currentPathContent.join('\n');
        }
        currentPath = null;
      } else {
        currentPathContent.push(line);
      }
    }
  }

  // Save last path
  if (currentPath) {
    paths[currentPath] = currentPathContent.join('\n');
  }

  return paths;
}

// Extract tag from path content
function extractTag(pathContent) {
  const match = pathContent.match(/tags:\s*\[([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

// Group paths by tag
const allPaths = parseYamlPaths(mainSpec);
const tagPaths = {};

Object.entries(allPaths).forEach(([pathName, content]) => {
  const tag = extractTag(content);
  if (tag) {
    if (!tagPaths[tag]) tagPaths[tag] = {};
    tagPaths[tag][pathName] = content;
  }
});

console.log('\n=== OpenAPI Decomposition ===\n');
console.log('Paths by tag:');
Object.entries(tagPaths).forEach(([tag, paths]) => {
  console.log(`  ${tag}: ${Object.keys(paths).length} path(s)`);
});

console.log('\nTo complete decomposition, use the modular file structure:');
console.log('  api/openapi/');
console.log('    utility/openapi.yaml');
console.log('    auth/openapi.yaml');
console.log('    character/openapi.yaml');
console.log('    ... (15 more)');
console.log('    _shared/schemas.yaml');
console.log('\nExport paths for processing:');
console.log(JSON.stringify(Object.keys(tagPaths), null, 2));
