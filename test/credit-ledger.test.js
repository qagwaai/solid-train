'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestContext, seedPlayer } = require('../test-support/message-handler-test-helpers');

test('normalizeCharacter computes credits as zero when creditLedger is empty', () => {
  const context = createTestContext();
  const character = context.normalizeCharacter({
    id: 'char-1',
    characterName: 'Scout',
    createdAt: '2026-05-05T00:00:00.000Z',
    ships: [],
    missions: [],
  });

  assert.equal(character.credits, 0);
  assert.deepEqual(character.creditLedger, []);
});

test('normalizeCharacter computes credits from puts only', () => {
  const context = createTestContext();
  const character = context.normalizeCharacter({
    id: 'char-1',
    characterName: 'Scout',
    createdAt: '2026-05-05T00:00:00.000Z',
    creditLedger: [
      {
        type: 'put',
        amount: 425,
        description: 'Starting credits',
        timestamp: '2026-05-05T00:00:00.000Z',
        referenceId: null,
      },
      {
        type: 'put',
        amount: 500,
        description: 'Mission reward',
        timestamp: '2026-05-05T01:00:00.000Z',
        referenceId: 'm-01',
      },
    ],
  });

  assert.equal(character.credits, 925);
});

test('normalizeCharacter subtracts takes from puts', () => {
  const context = createTestContext();
  const character = context.normalizeCharacter({
    id: 'char-1',
    characterName: 'Scout',
    createdAt: '2026-05-05T00:00:00.000Z',
    creditLedger: [
      {
        type: 'put',
        amount: 425,
        description: 'Starting credits',
        timestamp: '2026-05-05T00:00:00.000Z',
        referenceId: null,
      },
      {
        type: 'take',
        amount: 100,
        description: 'Market purchase',
        timestamp: '2026-05-05T02:00:00.000Z',
        referenceId: 'item-42',
      },
    ],
  });

  assert.equal(character.credits, 325);
});

test('normalizeCharacter handles mixed puts and takes across multiple entries', () => {
  const context = createTestContext();
  const character = context.normalizeCharacter({
    id: 'char-1',
    characterName: 'Scout',
    createdAt: '2026-05-05T00:00:00.000Z',
    creditLedger: [
      {
        type: 'put',
        amount: 425,
        description: 'Starting credits',
        timestamp: '2026-05-05T00:00:00.000Z',
        referenceId: null,
      },
      {
        type: 'put',
        amount: 500,
        description: 'Mission reward',
        timestamp: '2026-05-05T01:00:00.000Z',
        referenceId: 'm-01',
      },
      {
        type: 'take',
        amount: 200,
        description: 'Fuel purchase',
        timestamp: '2026-05-05T02:00:00.000Z',
        referenceId: null,
      },
      {
        type: 'take',
        amount: 75,
        description: 'Dock fee',
        timestamp: '2026-05-05T03:00:00.000Z',
        referenceId: null,
      },
    ],
  });

  assert.equal(character.credits, 650);
});

test('normalizeCharacter preserves all ledger entry fields', () => {
  const context = createTestContext();
  const entry = {
    type: 'put',
    amount: 425,
    description: 'Starting credits',
    timestamp: '2026-05-05T00:00:00.000Z',
    referenceId: 'ref-abc',
  };
  const character = context.normalizeCharacter({
    id: 'char-1',
    characterName: 'Scout',
    createdAt: '2026-05-05T00:00:00.000Z',
    creditLedger: [entry],
  });

  assert.deepEqual(character.creditLedger[0], {
    type: 'put',
    amount: 425,
    description: 'Starting credits',
    timestamp: '2026-05-05T00:00:00.000Z',
    referenceId: 'ref-abc',
  });
});

test('normalizeCharacter sets referenceId to null when missing', () => {
  const context = createTestContext();
  const character = context.normalizeCharacter({
    id: 'char-1',
    characterName: 'Scout',
    createdAt: '2026-05-05T00:00:00.000Z',
    creditLedger: [
      { type: 'take', amount: 50, description: 'Fee', timestamp: '2026-05-05T00:00:00.000Z' },
    ],
  });

  assert.equal(character.creditLedger[0].referenceId, null);
});

test('normalizeCharacter credits and creditLedger are present on cached character after add', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
  });

  await context.addCharacterAsync('MarketPilot', {
    id: 'char-market',
    characterName: 'Trader',
    createdAt: '2026-05-05T00:00:00.000Z',
    ships: [],
    missions: [],
    creditLedger: [
      {
        type: 'put',
        amount: 425,
        description: 'Starting credits',
        timestamp: '2026-05-05T00:00:00.000Z',
        referenceId: null,
      },
    ],
  });

  const characters = context.getCharacters('marketpilot');
  assert.equal(characters.length, 1);
  assert.equal(characters[0].credits, 425);
  assert.equal(characters[0].creditLedger.length, 1);
  assert.equal(characters[0].creditLedger[0].type, 'put');
});
