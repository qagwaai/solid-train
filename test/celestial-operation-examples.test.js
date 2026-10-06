'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Ajv = require('ajv');
const Parser = require('@apidevtools/swagger-parser');

for (const [moduleName, operationFilter, expectedCount] of [
  ['celestial', null, 9],
  ['solarsystem', null, 6],
  ['items', '/socket/launch-item', 4],
]) {
  test(`${moduleName}${operationFilter || ''}: every affected request and response example validates against fully resolved schemas`, async (t) => {
    const contract = await Parser.dereference(
      path.resolve(__dirname, `../api/openapi/${moduleName}/openapi.yaml`)
    );
    const ajv = new Ajv({ allErrors: true, schemaId: 'auto', strictKeywords: true });
    let count = 0;
    const failures = [];
    for (const [operationPath, item] of Object.entries(contract.paths)) {
      if (operationFilter && operationPath !== operationFilter) continue;
      for (const [method, operation] of Object.entries(item)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        const payloads = [
          ['request', operation.requestBody],
          ...Object.entries(operation.responses || {}).map(([status, response]) => [
            `response ${status}`,
            response,
          ]),
        ];
        for (const [kind, payload] of payloads) {
          for (const content of Object.values(payload?.content || {})) {
            const validate = ajv.compile(content.schema);
            const examples = Object.entries(content.examples || {});
            if (content.example !== undefined)
              examples.push(['example', { value: content.example }]);
            for (const [name, example] of examples) {
              assert.ok(Object.hasOwn(example, 'value'), `Unresolved example ${name}`);
              count += 1;
              if (!validate(example.value)) {
                failures.push(
                  `${operationPath} ${kind} ${name}: ${ajv.errorsText(validate.errors, { separator: '; ' })}`
                );
              }
            }
          }
        }
      }
    }
    t.diagnostic(`${count} examples validated`);
    assert.equal(count, expectedCount, 'All affected operation examples must remain covered');
    assert.deepEqual(failures, []);
  });
}

test('root and affected OpenAPI module contract versions stay aligned at 4.0.0', async () => {
  const root = await Parser.parse(path.resolve(__dirname, '../api/openapi.yaml'));
  assert.equal(root.info.version, '4.0.0');
  for (const moduleName of ['items', 'celestial', 'solarsystem']) {
    const moduleContract = await Parser.parse(
      path.resolve(__dirname, `../api/openapi/${moduleName}/openapi.yaml`)
    );
    assert.equal(moduleContract.info.version, root.info.version, moduleName);
  }
});
