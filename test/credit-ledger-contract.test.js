'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Ajv = require('ajv');
const Parser = require('@apidevtools/swagger-parser');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const {
  CreditLedgerListMessageHandler,
} = require('../src/handlers/credit-ledger-list-message-handler');
const { CharacterListMessageHandler } = require('../src/handlers/character-list-message-handler');
const { createServer } = require('../src/server');
const { seedPlayer } = require('../test-support/message-handler-test-helpers');
const { listen, connectClient, waitForEvent } = require('../test-support/socket-test-helpers');

const ajv = new Ajv({ allErrors: true, format: 'full' });
for (const name of [
  'credit-ledger-entry',
  'credit-ledger-list-request',
  'credit-ledger-list-response',
  'character-list-response',
]) {
  ajv.addSchema(require(`../api/schemas/${name}.schema.json`), `${name}.schema.json`);
}
const validateResponse = ajv.getSchema('credit-ledger-list-response.schema.json');
const validateRequest = ajv.getSchema('credit-ledger-list-request.schema.json');
const validateCharacterList = ajv.getSchema('character-list-response.schema.json');

function valid(validate, value) {
  assert.equal(validate(value), true, ajv.errorsText(validate.errors));
}

function entry(id, type = 'put', amount = 100, timestamp = '2026-05-05T00:00:00.000Z') {
  return { id, type, amount, timestamp, description: 'Movement', referenceId: null };
}

function request(overrides = {}) {
  return {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    characterId: 'character-1',
    correlationId: ' profile-ledger-1 ',
    requestIdentity: {
      operation: 'credit-ledger-list',
      entityType: 'credit-ledger',
      containerId: 'character-1',
      clientTag: 'preserve me',
    },
    ...overrides,
  };
}

function seed(context) {
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  context.cacheCharacters('PilotOne', [
    {
      id: 'character-1',
      characterName: 'Trader',
      credits: 99999,
      creditLedger: [
        entry('c', 'put', 100),
        entry('b', 'take', 25, '2026-05-05T01:00:00.000Z'),
        entry('a', 'put', 50, '2026-05-05T01:00:00.000Z'),
      ],
    },
    { id: 'character-2', characterName: 'Scout', creditLedger: [entry('d', 'take', 5)] },
    { id: 'character-empty', characterName: 'Empty', creditLedger: [] },
  ]);
}

test('ledger scope, full balance, inclusive filters, deterministic paging and empty results', async () => {
  const context = new MessageHandlerContext();
  seed(context);
  const handler = new CreditLedgerListMessageHandler(context);
  const payload = request();
  const response = await handler.buildResponse(payload);
  valid(validateRequest, payload);
  valid(validateResponse, response);
  assert.deepEqual(
    response.entries.map((item) => item.id),
    ['a', 'b', 'c']
  );
  assert.equal(response.balance, 125);
  assert.equal(response.total, 3);
  assert.equal(response.limit, 50);
  assert.equal(response.correlationId, payload.correlationId);
  assert.deepEqual(response.requestIdentity, payload.requestIdentity);

  const filtered = await handler.buildResponse(
    request({
      startAt: '2026-05-05T02:00:00+01:00',
      endAt: '2026-05-05T01:00:00Z',
      limit: 1,
      offset: 1,
    })
  );
  valid(validateResponse, filtered);
  assert.deepEqual(
    filtered.entries.map((item) => item.id),
    ['b']
  );
  assert.equal(filtered.total, 2);
  assert.equal(filtered.balance, 125);

  for (const overrides of [
    { offset: 99 },
    { startAt: '2026-05-06T00:00:00Z' },
    { endAt: '2026-05-04T00:00:00Z' },
  ]) {
    const emptyPage = await handler.buildResponse(request(overrides));
    valid(validateResponse, emptyPage);
    assert.deepEqual(emptyPage.entries, []);
    assert.equal(emptyPage.balance, 125);
    assert.equal(emptyPage.total, overrides.offset ? 3 : 0);
  }
  const empty = await handler.buildResponse(
    request({
      characterId: 'character-empty',
      requestIdentity: { ...payload.requestIdentity, containerId: 'character-empty' },
    })
  );
  valid(validateResponse, empty);
  assert.equal(empty.balance, 0);
  assert.equal(empty.total, 0);

  const negative = await handler.buildResponse(
    request({
      characterId: 'character-2',
      requestIdentity: { ...payload.requestIdentity, containerId: 'character-2' },
    })
  );
  valid(validateResponse, negative);
  assert.equal(negative.balance, -5);

  const allRequest = request({
    requestIdentity: { ...payload.requestIdentity, containerId: 'player-pilotone' },
    limit: 250,
  });
  delete allRequest.characterId;
  const all = await handler.buildResponse(allRequest);
  valid(validateResponse, all);
  assert.equal(all.balance, 120);
  assert.equal(all.total, 4);
  assert.equal(all.limit, 200);
  const characterList = new CharacterListMessageHandler(context).buildResponse(payload);
  Object.assign(characterList, {
    correlationId: 'f4740f89-47a4-4c43-914e-08c4f4c2fe16',
    requestIdentity: {
      operation: 'character-list',
      entityType: 'character',
      containerId: 'player-pilotone',
    },
  });
  valid(validateCharacterList, characterList);
  assert.equal(characterList.characters[0].credits, response.balance);
  assert.deepEqual(
    new Set(characterList.characters[0].creditLedger.map((item) => item.id)),
    new Set(response.entries.map((item) => item.id))
  );
});

test('strict paging rejects invalid types and values, and enforces the exact 200-entry cap', async () => {
  const context = new MessageHandlerContext();
  seed(context);
  context.cacheCharacters('PilotOne', [
    {
      id: 'character-1',
      characterName: 'Trader',
      creditLedger: Array.from({ length: 205 }, (_, index) =>
        entry(`entry-${String(index).padStart(3, '0')}`)
      ),
    },
  ]);
  const handler = new CreditLedgerListMessageHandler(context);
  for (const field of ['offset', 'limit']) {
    for (const value of [
      -1,
      1.5,
      '2',
      null,
      Number.MAX_SAFE_INTEGER + 1,
      ...(field === 'limit' ? [0] : []),
    ]) {
      const payload = request({ [field]: value });
      assert.equal(validateRequest(payload), false);
      const response = await handler.buildResponse(payload);
      valid(validateResponse, response);
      assert.equal(response.reason, 'invalid-request');
      assert.equal(response.balance, 0);
      assert.deepEqual(response.entries, []);
    }
  }
  for (const limit of [200, 201, Number.MAX_SAFE_INTEGER]) {
    const response = await handler.buildResponse(request({ limit }));
    valid(validateResponse, response);
    assert.equal(response.entries.length, 200);
    assert.equal(response.limit, 200);
    assert.equal(response.total, 205);
    assert.equal(response.balance, 20500);
  }
  const finalPage = await handler.buildResponse(request({ limit: 200, offset: 200 }));
  assert.equal(finalPage.entries.length, 5);
});

test('invalid dates, scopes, and metadata produce typed failures with exact echoes', async () => {
  const context = new MessageHandlerContext();
  seed(context);
  const handler = new CreditLedgerListMessageHandler(context);
  for (const overrides of [
    { startAt: 'not-a-date' },
    { startAt: '2016-12-31T23:59:60Z' },
    { endAt: '2026-02-30T00:00:00Z' },
    { startAt: '2026-05-06T00:00:00Z', endAt: '2026-05-05T00:00:00Z' },
    {
      requestIdentity: {
        operation: 'wrong',
        entityType: 'credit-ledger',
        containerId: 'character-1',
      },
    },
    {
      requestIdentity: {
        operation: 'credit-ledger-list',
        entityType: 'credit-ledger',
        containerId: 'wrong',
      },
    },
    { correlationId: '' },
    { requestIdentity: null },
  ]) {
    const payload = request(overrides);
    const response = await handler.buildResponse(payload);
    valid(validateResponse, response);
    assert.equal(response.reason, 'invalid-request');
    assert.deepEqual(response.requestIdentity, payload.requestIdentity);
    assert.equal(response.correlationId, payload.correlationId);
  }
  seedPlayer(context, {
    playerName: 'OtherPilot',
    sessionKey: 'other-session',
    characters: [{ id: 'unowned-character', characterName: 'Private' }],
  });
  for (const characterId of ['missing-character', 'unowned-character']) {
    const response = await handler.buildResponse(
      request({
        characterId,
        requestIdentity: { ...request().requestIdentity, containerId: characterId },
      })
    );
    valid(validateResponse, response);
    assert.equal(response.reason, 'character-not-found');
  }
});

test('stable legacy IDs survive hydration, duplicate timestamps/movements, and append', async () => {
  const context = new MessageHandlerContext();
  const movement = entry('ignored');
  delete movement.id;
  const legacy = {
    id: 'legacy-character',
    characterName: 'Legacy',
    creditLedger: [movement, movement],
  };
  const first = context.normalizeCharacter(legacy);
  const reloaded = new MessageHandlerContext().normalizeCharacter(
    JSON.parse(JSON.stringify(legacy))
  );
  assert.deepEqual(first.creditLedger, reloaded.creditLedger);
  assert.notEqual(first.creditLedger[0].id, first.creditLedger[1].id);
  const appended = context.normalizeCharacter({
    ...legacy,
    creditLedger: [...legacy.creditLedger, movement],
  });
  assert.deepEqual(appended.creditLedger.slice(0, 2), first.creditLedger);
  const otherCharacter = context.normalizeCharacter({ ...legacy, id: 'other-character' });
  assert.notEqual(first.creditLedger[0].id, otherCharacter.creditLedger[0].id);
  const newMovement = context.normalizeCreditLedgerEntry(movement);
  assert.ok(newMovement.id);
  assert.equal(context.normalizeCreditLedgerEntry(newMovement).id, newMovement.id);
  for (const invalid of [
    { ...movement, type: 'unknown' },
    { ...movement, amount: 0 },
    { ...movement, amount: -1 },
    { ...movement, amount: Infinity },
    { ...movement, timestamp: 'invalid' },
  ]) {
    assert.throws(() => context.normalizeCreditLedgerEntry(invalid), /invalid movement/);
  }
  let persisted;
  context.databaseService = {
    async addCharacter(playerName, character) {
      persisted = JSON.parse(JSON.stringify(character));
    },
  };
  await context.addCharacterAsync('PilotOne', legacy);
  assert.deepEqual(persisted.creditLedger, first.creditLedger);
});

test('response schema rejects missing movement fields, invalid entries and success-shaped failures', async () => {
  const context = new MessageHandlerContext();
  seed(context);
  const response = await new CreditLedgerListMessageHandler(context).buildResponse(request());
  for (const field of ['balance', 'entries', 'total']) {
    const copy = structuredClone(response);
    delete copy[field];
    assert.equal(validateResponse(copy), false, field);
  }
  for (const field of ['id', 'type', 'amount', 'description', 'timestamp', 'referenceId']) {
    const copy = structuredClone(response);
    delete copy.entries[0][field];
    assert.equal(validateResponse(copy), false, field);
  }
  for (const override of [
    { amount: 0 },
    { type: 'sell' },
    { timestamp: 'bad-date' },
    { referenceId: 42 },
  ]) {
    const copy = structuredClone(response);
    Object.assign(copy.entries[0], override);
    assert.equal(validateResponse(copy), false);
  }
  assert.equal(validateResponse({ ...response, success: false, reason: 'invalid-session' }), false);
});

test('all ledger and character-list OpenAPI examples validate against resolved schemas', async () => {
  for (const moduleName of ['ledger', 'character']) {
    const contract = await Parser.dereference(
      path.join(__dirname, '..', 'api', 'openapi', moduleName, 'openapi.yaml')
    );
    const operation =
      contract.paths[
        moduleName === 'ledger' ? '/socket/credit-ledger-list' : '/socket/character-list'
      ].post;
    for (const content of [
      operation.requestBody.content['application/json'],
      operation.responses['200'].content['application/json'],
    ]) {
      const validate = new Ajv({ allErrors: true, format: 'full' }).compile(content.schema);
      for (const [name, example] of Object.entries(content.examples)) {
        assert.equal(validate(example.value), true, `${name}: ${ajv.errorsText(validate.errors)}`);
      }
    }
    if (moduleName === 'ledger') {
      assert.equal(operation['x-socket-request-event'], 'credit-ledger-list-request');
      assert.equal(operation['x-socket-response-event'], 'credit-ledger-list-response');
      for (const example of Object.values(operation['x-invalid-request-examples'])) {
        assert.equal(validateRequest(example), false);
      }
    }
  }
});

test(
  'real socket wiring returns schema-valid success, ownership, validation and session failures',
  { timeout: 15000 },
  async (t) => {
    const {
      server,
      io,
      messageHandlerContext: context,
    } = createServer({ initializeContext: false });
    t.after(() => new Promise((resolve) => io.close(resolve)));
    seed(context);
    const port = await listen(server);
    const client = connectClient(port);
    t.after(() => client.disconnect());
    await waitForEvent(client, 'connect');
    for (const overrides of [
      {},
      { limit: 0 },
      { offset: -1 },
      {
        characterId: 'missing-character',
        requestIdentity: { ...request().requestIdentity, containerId: 'missing-character' },
      },
      { sessionKey: 'invalid-session' },
    ]) {
      const payload = request(overrides);
      const pending = waitForEvent(client, 'credit-ledger-list-response');
      const invalidSession = overrides.sessionKey ? waitForEvent(client, 'invalid-session') : null;
      client.emit('credit-ledger-list-request', payload);
      const response = await pending;
      valid(validateResponse, response);
      assert.equal(response.correlationId, payload.correlationId);
      assert.deepEqual(response.requestIdentity, payload.requestIdentity);
      if (invalidSession) {
        assert.deepEqual(await invalidSession, { message: 'Invalid session' });
        assert.equal(response.reason, 'invalid-session');
      } else {
        assert.equal(response.success, Object.keys(overrides).length === 0);
      }
    }
    context.databaseService = {
      async getCharacters() {
        throw new Error('Database unavailable');
      },
    };
    const pending = waitForEvent(client, 'credit-ledger-list-response');
    client.emit('credit-ledger-list-request', request());
    const failedRead = await pending;
    valid(validateResponse, failedRead);
    assert.equal(failedRead.reason, 'internal-error');

    const origin = `http://127.0.0.1:${port}`;
    const spec = await Parser.parse(path.join(__dirname, '..', 'api', 'openapi.yaml'));
    const visited = new Set();
    async function checkRefs(relativePath, document) {
      const url = new URL(relativePath, `${origin}/`);
      if (visited.has(url.pathname)) return;
      visited.add(url.pathname);
      const fetched = await fetch(`${url}?cb=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      assert.equal(fetched.status, 200, url.pathname);
      assert.equal(fetched.headers.get('cache-control'), 'no-store', url.pathname);
      const text = await fetched.text();
      assert.equal(
        text,
        fs.readFileSync(
          path.join(__dirname, '..', 'api', ...url.pathname.split('/').filter(Boolean)),
          'utf8'
        )
      );
      async function traverse(value) {
        if (!value || typeof value !== 'object') return;
        if (typeof value.$ref === 'string' && !value.$ref.startsWith('#')) {
          const refUrl = new URL(value.$ref, url);
          const local = path.join(
            __dirname,
            '..',
            'api',
            ...refUrl.pathname.split('/').filter(Boolean)
          );
          const referenced = refUrl.pathname.endsWith('.json')
            ? JSON.parse(fs.readFileSync(local, 'utf8'))
            : await Parser.parse(local);
          await checkRefs(refUrl.pathname, referenced);
        }
        for (const nested of Object.values(value)) await traverse(nested);
      }
      await traverse(document);
    }
    // Follow the root path to the ledger module, then every transitive schema ref.
    await checkRefs('/openapi.yaml', {
      paths: { ledger: spec.paths['/socket/credit-ledger-list'] },
    });
    assert.ok(visited.has('/schemas/credit-ledger-entry.schema.json'));
  }
);
