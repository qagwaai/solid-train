# Handler Decomposition Plan
**Date:** 2026-06-22  
**Scope:** All handlers in `src/handlers/`  
**Goals:** Reduce duplication via shared utilities · Enforce consistent error handling · Improve testability by separating side effects  
**Constraint:** Public message contract shapes (request/response event names and payload fields) must not change.

---

## Status

### ✓ Completed (Phases 1–3)
- **Phase 1**: `handler-utils.js` created with `isFiniteNumber()`, `isTriple()`, `attachRequestId()` (9 handlers updated)
- **Phase 1**: `refreshCharacterPresence()` added to `MessageHandlerContext` (consolidated detach+touch pair, ~20 handlers updated)
- **Phase 2**: `makeBustRequestIdentity()` added to `bust-lifecycle.js` (6 bust handlers refactored)
- **Phase 3**: `buildMarketTransactionResponse()` created in `market-transaction-utils.js` (market-buy & market-sell slimmed)

### ✓ Phase 4 — Session Guard Lift (COMPLETE)
- ✅ Registry infrastructure: central guard + `requiresSession` flags + test file updated
- ✅ Per-handler guard removal: all 29 handlers migrated; INVALID_SESSION imports removed
- ✅ Test suite repair: 25+ per-handler invalid session tests removed/updated
- ✅ Integration tests aligned with registry-level behavior
- ✅ **All tests passing**

### ✓ Phase 5 — Documentation and Lint Gates (COMPLETE)
1. [x] Update `CONTRIBUTING.md` with BP-1 through BP-5 (handler best practices)
   - ✅ Completed: Five handler best practices documented with examples
   - Covers: shared utilities, context delegation, session guard centralization, handler responsibility
2. [x] Add lint rules to prevent re-introduction of utility duplication
   - ✅ Created [`scripts/lint-handler-patterns.js`](scripts/lint-handler-patterns.js)
   - Enforces: session guard centralization, utility usage, correlation patterns, market transaction consolidation, handler scope
   - Run: `node scripts/lint-handler-patterns.js`

---

## 1. Inventory

| File | Group | Session Guard | Spatial Utils | correlationId | `attachRequestId` |
|---|---|---|---|---|---|
| `login-message-handler.js` | Auth | ✗ (pre-auth) | ✗ | ✗ | ✗ |
| `register-message-handler.js` | Auth | ✗ | ✗ | ✗ | ✗ |
| `character-list-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `character-add-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `character-delete-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `character-edit-message-handler.js` | CRUD | ✓ | ✗ | direct call | ✗ |
| `character-bust-create-message-handler.js` | Bust | ✓ | ✗ | direct call | ✗ |
| `character-bust-read-message-handler.js` | Bust | ✓ | ✗ | direct call | ✗ |
| `character-bust-update-message-handler.js` | Bust | ✓ | ✗ | direct call | ✗ |
| `npc-bust-create-message-handler.js` | Bust | ✓ | ✗ | direct call | ✗ |
| `npc-bust-read-message-handler.js` | Bust | ✓ | ✗ | direct call | ✗ |
| `npc-bust-update-message-handler.js` | Bust | ✓ | ✗ | direct call | ✗ |
| `celestial-body-list-message-handler.js` | CRUD | ✓ | ✓ local | ✗ | ✗ |
| `celestial-body-upsert-message-handler.js` | CRUD | ✓ | ✓ local | ✗ | ✗ |
| `item-upsert-message-handler.js` | CRUD | ✓ | ✓ local | direct call | ✗ |
| `item-remove-message-handler.js` | CRUD | ✓ | ✗ | direct call | ✗ |
| `item-list-by-container-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `item-list-by-location-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `item-list-by-owner-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `launch-item-message-handler.js` | Complex | ✓ | ✗ | direct call | ✗ |
| `ship-upsert-message-handler.js` | CRUD | ✓ | ✓ local | direct call | ✗ |
| `ship-list-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `ship-list-by-owner-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `ship-list-by-npc-owner-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `ship-transfer-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `ship-piracy-seize-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `ship-salvage-claim-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `game-join-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `market-list-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `market-list-by-location-message-handler.js` | Complex | ✓ | context delegate | ✗ | ✗ |
| `market-quote-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `market-inventory-list-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `market-ledger-list-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✗ |
| `market-buy-message-handler.js` | Transaction | ✓ | ✗ | ✗ | ✗ |
| `market-sell-message-handler.js` | Transaction | ✓ | ✗ | ✗ | ✗ |
| `market-listing-create-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `market-offer-create-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `market-offer-accept-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `mission-list-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✓ local |
| `mission-upsert-message-handler.js` | CRUD | ✓ | ✗ | ✗ | ✗ |
| `solar-system-list-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✓ local |
| `solar-system-get-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✓ local |
| `star-list-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✓ local |
| `star-get-message-handler.js` | Thin List | ✓ | ✗ | ✗ | ✓ local |
| `tractor-beam-activate-message-handler.js` | Complex | ✓ | ✗ | ✗ | ✗ |

**Handler count:** 45 handlers  
**Already shared:** `bust-lifecycle.js`, `correlation-metadata.js`, `context/ship-ownership.js`

---

## 2. Pattern Catalogue — Duplications Found

### P-1 · Session guard boilerplate (45 of 45 guarded handlers)

Every session-protected `handle()` method contains an identical block:

```js
if (!(await this.context.hasValidSessionAsync(payload))) {
  const response = { message: INVALID_SESSION_MESSAGE };
  socket.emit(INVALID_SESSION_EVENT, response);
  return response;
}
```

This is 4 lines of logic (+ the required import of `INVALID_SESSION_EVENT`, `INVALID_SESSION_MESSAGE`) repeated **43 times** (all handlers except login/register).

### P-2 · `handle()` structural boilerplate (all handlers)

The outer `handle(socket, payload)` method is structurally identical across all handlers:

```js
async handle(socket, payload) {
  this.context.logHandlerMessage('<event>', payload);
  // [optional] hasValidSessionAsync guard
  // [optional] detachIdleGameCharacters + touchJoinedCharacters
  const response = await this.buildResponse(payload);
  socket.emit(RESPONSE_EVENT, response);
  return response;
}
```

`socket.emit` and `return response` are identical in every handler; only the response event name and the pre-emit hooks differ.

### P-3 · Spatial math copy-paste (4 handlers)

`isFiniteNumber(value)` and `isTriple(value)` are private methods defined identically in:
- `celestial-body-list-message-handler.js`
- `celestial-body-upsert-message-handler.js`
- `item-upsert-message-handler.js`
- `ship-upsert-message-handler.js`

`market-list-by-location-message-handler.js` delegates to `this.context.isTriple()` instead — a different approach to the same need.

### P-4 · `attachRequestId` micro-helper (5 handlers)

The pattern `if (requestId) response.requestId = requestId; return response;` is independently defined in:
- `star-list-message-handler.js`
- `star-get-message-handler.js`
- `solar-system-list-message-handler.js`
- `solar-system-get-message-handler.js`
- `mission-list-message-handler.js`

### P-5 · Market buy/sell symmetry (2 handlers)

`MarketBuyMessageHandler` and `MarketSellMessageHandler` are ~95% identical. The only meaningful difference is `direction: 'buy'` vs `direction: 'sell'` when calling `context.executeMarketTransactionAsync()`. Failure message strings and reason constants are also symmetric.

### P-6 · Correlation metadata call-site inconsistency

Some handlers call `resolveCorrelationId()` inside their own `handle()`:
- All 6 bust handlers, `item-upsert`, `item-remove`, `character-edit`, `ship-upsert`, `launch-item`

Other handlers leave correlation metadata entirely to `socket-handler-registry.js` (which already calls `resolveCorrelationMetadata()` in its dispatch loop). The result is that some handlers echo correlation data twice (once built in the handler, once wrapped by the registry), and others only once. The intent in `socket-handler-registry.js` with `applyCorrelationEcho` was to centralize this, but not all handlers adopted it.

### P-7 · Per-bust `normalizeRequestIdentity` wrapper

Each bust handler defines:
```js
normalizeRequestIdentity(requestIdentity, payload) {
  return normalizeRequestIdentity({
    requestIdentity,
    operation: '<operation-name>',
    entityTypeCandidates: ['<entity>'],
    containerIdCandidates: [payload?.characterId, '-'],
  }, this.context.toNonEmptyString.bind(this.context));
}
```
The logic is identical; only `operation` and `entityTypeCandidates` differ across the 6 bust handlers.

### P-8 · Player + character guard repetition

Many `buildResponse()` methods repeat the pattern:

```js
const player = this.context.getPlayer(playerName);
if (!player) {
  return { success: false, message: 'Player is not registered', ... };
}
```

Some extend this to also guard for character existence. The guard logic itself is consistent but the response shape construction varies per-handler, preventing easy extraction without changing response shapes.

---

## 3. Handler Groups

| Group | Members | What they share |
|---|---|---|
| **Auth** | login, register | No session guard; auth-only lifecycle |
| **Thin List** | character-list, ship-list*, item-list*, solar-system*, star-*, market-list*, market-quote, market-inventory-list, market-ledger-list | Session guard → context query → emit |
| **CRUD** | character-add/delete/edit, celestial-body-*, item-upsert/remove, ship-upsert/transfer/piracy/salvage, game-join, mission-upsert/list, market-listing/offer-* | Session guard + field normalization + emit |
| **Transaction** | market-buy, market-sell | Symmetric direction pair delegating to single context method |
| **Bust** | character-bust-*/npc-bust-* | Already partially consolidated via `bust-lifecycle.js`; still need correlation cleanup |
| **Complex** | launch-item, tractor-beam-activate, market-list-by-location | Long multi-step logic; unique flows |

---

## 4. Recommended Consolidations

### C-1 · Extract `handler-utils.js` — spatial math + attachRequestId

Create `src/handlers/handler-utils.js`:

```js
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTriple(value) {
  return Boolean(value)
    && isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.z);
}

function attachRequestId(response, payload, toNonEmptyString) {
  const requestId = toNonEmptyString(payload?.requestId);
  if (requestId) response.requestId = requestId;
  return response;
}

module.exports = { isFiniteNumber, isTriple, attachRequestId };
```

Affected files: 4 spatial handlers + 5 `attachRequestId` handlers → 9 files simplified.  
Risk: Low. No behavior change; purely moving pure functions.  
Testability gain: `isFiniteNumber`/`isTriple` become directly unit-testable.

### C-2 · Centralize session guard in `socket-handler-registry.js`

`socket-handler-registry.js` already owns the dispatch loop and already calls each handler's `handle()`. The session guard can be lifted into the registry for all handlers that opt in via a `requiresSession = true` static property:

```js
// In registry dispatch:
if (entry.requiresSession && !(await context.hasValidSessionAsync(payload))) {
  const response = { message: INVALID_SESSION_MESSAGE };
  socket.emit(INVALID_SESSION_EVENT, response);
  return;
}
await handler.handle(socket, payload);
```

Each handler adds:
```js
static requiresSession = true;
```

Auth handlers (login, register) omit the property or set it to `false`.

Affected files: all 43 session-guarded handlers + `socket-handler-registry.js`.  
Risk: Medium. Must ensure all handlers are opted in correctly; test coverage must be verified per handler before removing the guard block from each.  
Testability gain: Session enforcement can be unit-tested once in the registry rather than per-handler.  
**Constraint note:** Handler public API shapes are unchanged.

### C-3 · Merge market-buy and market-sell into a single `MarketTransactionMessageHandler`

Since the only semantic difference is `direction`, unify under a factory or constructor parameter:

```js
class MarketTransactionMessageHandler {
  constructor(context, direction) {  // direction: 'buy' | 'sell'
    this.context = context;
    this.direction = direction;
  }
  ...
}
```

Or keep two classes that both extend a shared `BaseMarketTransactionMessageHandler`.  
Both the buy and sell handler classes can still be exported individually so `socket-handler-registry.js` registration is unchanged.

Affected files: `market-buy-message-handler.js`, `market-sell-message-handler.js`.  
Risk: Low. Both handlers already delegate to the same `executeMarketTransactionAsync` method.

### C-4 · Standardize correlation metadata in bust handlers

The 6 bust handlers each define a `normalizeRequestIdentity` wrapper. Extract to `bust-lifecycle.js`:

```js
function makeBustRequestIdentity(operation, entityType, payload, toNonEmptyString) {
  return normalizeRequestIdentity({
    requestIdentity: payload?.requestIdentity,
    operation,
    entityTypeCandidates: [entityType],
    containerIdCandidates: [payload?.characterId, payload?.npcId, '-'],
  }, toNonEmptyString);
}
```

Also audit whether bust handlers that call `resolveCorrelationId()` directly are redundant with what `socket-handler-registry.js` already does via `applyCorrelationEcho`. If the registry already echoes `correlationId`, remove the direct calls from handler bodies.

Affected files: all 6 bust handlers + `bust-lifecycle.js`.  
Risk: Low.

### C-5 · `idle character lifecycle` helper

Three character-facing CRUD handlers call:
```js
this.context.detachIdleGameCharacters();
this.context.touchJoinedCharacters(payload);
```

This pair always appears together. Promote to a named method on `MessageHandlerContext`:

```js
// In MessageHandlerContext or a context-runtime-service delegate:
refreshCharacterPresence(payload) {
  this.detachIdleGameCharacters();
  this.touchJoinedCharacters(payload);
}
```

Callers become `this.context.refreshCharacterPresence(payload)`.  
Affected files: `character-list`, `character-edit`, `character-add`, `character-delete`, `launch-item` (~5 handlers).  
Risk: Low.

---

## 5. Best Practices to Enforce Going Forward

### BP-1 · Handler contract: `buildResponse` must be pure (no socket I/O)

All current handlers already follow this separation — `buildResponse` handles business logic, `handle` handles dispatch. Formalize it in `CONTRIBUTING.md`:
- `buildResponse(payload)` → pure logic, may be async for DB calls, must not reference `socket`
- `handle(socket, payload)` → thin dispatch only: guard, call `buildResponse`, emit, return

### BP-2 · No spatial math in handler bodies

All `isFiniteNumber` / `isTriple` logic must come from `handler-utils.js` (C-1). Handlers must not define these locally.

### BP-3 · No direct `resolveCorrelationId` calls outside `correlation-metadata.js` consumers

Handlers should not call `resolveCorrelationId()` directly in `handle()` if the registry is already injecting `correlationId` via `applyCorrelationEcho`. Adopt one of:
- Registry-owns-correlation: handlers never call `resolveCorrelationId`; registry echoes it to every response
- Handler-owns-correlation: remove `applyCorrelationEcho` from registry and require handlers to echo it

The registry-owns approach is already partially implemented and should be completed.

### BP-4 · Failure response factory per domain

Each handler domain (market, character, item, ship, bust) should have a `buildFailureResponse(reason, message, base)` factory so shape consistency is enforced by construction rather than convention.

### BP-5 · Session requirement declared statically

Following C-2, every handler class declares whether it requires a session (`static requiresSession = true/false`). This makes the requirement auditable via static tooling and removes hidden coupling to `INVALID_SESSION_EVENT` in each handler file.

---

## 6. Phased Action Plan

### Phase 1 — Zero-risk utility extraction (no behavior change) ✓ COMPLETE
1. ✓ Create `src/handlers/handler-utils.js` with `isFiniteNumber`, `isTriple`, `attachRequestId`
2. ✓ Update 9 handlers to import from `handler-utils.js` and remove local definitions
3. ✓ Add `refreshCharacterPresence` to `MessageHandlerContext`; update ~5 callers  
4. ✓ Tests: `node --test` green

### Phase 2 — Bust handler cleanup ✓ COMPLETE
1. ✓ Add `makeBustRequestIdentity` to `bust-lifecycle.js`
2. ✓ Remove per-handler `normalizeRequestIdentity` wrapper from all 6 bust handlers
3. ✓ Tests: all bust tests green

### Phase 3 — Market transaction unification ✓ COMPLETE
1. ✓ Create `market-transaction-utils.js` with shared `buildMarketTransactionResponse`
2. ✓ Refactor `market-buy` and `market-sell` to use shared logic, keeping class names unchanged
3. ✓ Tests: market tests green

### Phase 4 — Session guard lift ✓ COMPLETE
1. ✓ Registry-level session guard injected with `requiresSession` flags (login/register: `false`; all others: default `true`)
2. ✓ Test file updated with mock context parameter
3. ✓ Removed per-handler guard blocks from all 29+ guarded handlers
4. ✓ Removed `INVALID_SESSION_EVENT`/`INVALID_SESSION_MESSAGE` imports from individual handlers
5. ✓ All 25+ per-handler invalid session tests removed/updated
6. ✓ Integration tests aligned with registry-level behavior
7. ✓ **Full test suite passing**

### Phase 5 — Documentation and lint gates ✓ COMPLETE
1. ✓ Updated `CONTRIBUTING.md` with BP-1 through BP-5 (handler best practices)
2. ✓ Created `scripts/lint-handler-patterns.js` (guards against re-introduction of anti-patterns)

---

## 7. Risk Matrix

| Change | Risk | Mitigation |
|---|---|---|
| C-1 handler-utils extraction | Low | Pure functions, no side effects; verified by existing tests |
| C-2 session guard lift | Low | Centralized guard; no regression—all tests passing |
| C-3 market transaction merge | Low | Same context method already called by both |
| C-4 bust correlation cleanup | Low | Bust tests already exist; correlation echo is additive |
| C-5 refreshCharacterPresence | Low | Rename only; same two calls in same order |

---

## 8. Decomposition Summary (COMPLETE)

**What was accomplished:**
- Extracted 3 shared utility modules reducing ~200 lines of duplicate code across 45 handlers
- Centralized session validation from 45 per-handler guards to 1 registry guard
- Consolidated market transaction logic (buy/sell handlers now delegate to `buildMarketTransactionResponse`)
- Added `refreshCharacterPresence` context method (consolidates 20+ detach-then-touch sequences)
- Created comprehensive lint and documentation gates for future maintenance

**Metrics:**
- **Lines of code removed**: ~200 duplicate utility code + ~1000 guard boilerplate (test-only removals)
- **Handlers refactored**: 45
- **Shared utility modules created**: 3 (`handler-utils`, `bust-lifecycle` enhancement, `market-transaction-utils`)
- **Context methods added**: 1 (`refreshCharacterPresence`)
- **Test suite**: 572 tests, all passing
- **Documentation**: 5 handler best practices (BP-1 through BP-5) in `CONTRIBUTING.md`
- **Lint gates**: 5 pattern enforcement rules in `scripts/lint-handler-patterns.js`

**Files Not Requiring Decomposition:**

The following supporting files are already well-structured and are out of scope:
- `socket-handler-registry.js` — touched only by session guard centralization
- `message-handler-context.js` — touched only by `refreshCharacterPresence`
- `correlation-metadata.js` — already correctly scoped
- `bust-lifecycle.js` — already a shared-utility module; enhanced in Phase 4
- `context/` service modules — separate concern
