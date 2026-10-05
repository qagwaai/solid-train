# Credit ledger contract changelog

- Implemented the previously documented but unwired `credit-ledger-list-request`
  and `credit-ledger-list-response` events. Character scope uses the character ID
  as `requestIdentity.containerId`; absent `characterId` aggregates the player's
  characters with `player-<trimmed lowercase playerName>` as the container.
- **Contract tightening:** entries now require opaque stable `id`, `type`
  (`put`/`take`), positive `amount`, `description`, ISO date-time `timestamp`, and
  nullable `referenceId`. Responses require `balance`. Regenerate client models.
  Character-list summaries now always include typed `creditLedger` and `credits`.
  Malformed or nonpositive legacy movements now fail explicitly instead of
  returning fabricated movements or balances; repair such data before retrying.
- Balance is derived from the entire selected ledger, not stored independently:
  sum of puts minus takes. Stored credits never override the ledger. Inclusive
  timestamp filters affect total, not balance. Default limit is 50, maximum 200
  (clamped); malformed paging fails. Sort is timestamp descending, id ascending.
- New entries preserve their generated IDs in MongoDB. Legacy entries without IDs
  receive deterministic IDs from character ID, append index, and movement fields;
  these remain stable across rehydration/restarts without read-time database writes
  and are persisted when that player's document is next validated and saved
  (or that ledger is explicitly written). Ledger history is immutable
  and append-only: do not reorder, edit, or delete legacy movements.
- Failures include reason, empty entries, zero total and zero balance. These zeros
  do not represent account balance. Unknown/unowned character IDs are deliberately
  indistinguishable. Invalid sessions retain the existing invalid-session event
  and additionally return the ledger response. Metadata is echoed without trimming.
- Correlation IDs for this operation are opaque nonblank strings, not UUID-validated,
  consistent with socket runtime acceptance. Other operations' UUID recommendations
  are unchanged; no global validation or client changes were introduced.
- The root spec and referenced modules/schemas are served with `Cache-Control:
no-store`; cache-busting queries and request no-cache headers remain supported.
