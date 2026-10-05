'use strict';

const { createHash } = require('node:crypto');

function legacyCreditLedgerEntryId(characterId, index, entry) {
  // Legacy history is append-only; the index distinguishes identical movements.
  return `legacy-${createHash('sha256')
    .update(
      JSON.stringify([
        characterId,
        index,
        entry.type,
        entry.amount,
        entry.description,
        entry.timestamp,
        entry.referenceId ?? null,
      ])
    )
    .digest('hex')}`;
}

module.exports = { legacyCreditLedgerEntryId };
