# Contributing

Thanks for your interest in contributing.

## Inbound Contribution Terms

By submitting a pull request, patch, issue attachment, or any other
contribution to this repository, you agree that:

- Your contribution is provided under the repository's current LICENSE terms.
- You have the legal right to submit the contribution.
- Your contribution does not knowingly violate third-party intellectual property rights.
- You grant the repository owner the right to use, modify, relicense, and
  distribute your contribution as part of this project.

If you do not agree to these terms, do not submit a contribution.

## Commercial and Proprietary Rights

This repository is not open source. Public visibility does not grant reuse
rights. Any commercial use requires a separate written license from the owner.

For commercial licensing inquiries, open an issue at:
https://github.com/qagwaai/solid-train/issues
with the subject prefix "[Commercial License]".

---

## Handler Best Practices

Message handlers in `src/handlers/` follow a decomposition pattern to reduce duplication and maintain consistency. New handlers should follow these practices:

### BP-1: Use `handler-utils` for shared spatial and request utilities

Common operations (coordinate validation, request ID attachment) are centralized in [`src/handlers/handler-utils.js`](src/handlers/handler-utils.js). Use these instead of reimplementing:

```javascript
const { isFiniteNumber, isTriple, attachRequestId } = require('./handler-utils');

// ✓ Good: uses centralized utility
if (!isFiniteNumber(positionKm?.x) || !isTriple(positionKm)) {
  return { success: false, message: 'Invalid position' };
}

// ✓ Good: centralizes request ID attachment
response.requestId = attachRequestId(response, payload);
```

### BP-2: Consolidate shared patterns in domain-specific utility modules

When multiple handlers share the same business logic (e.g., multiple bust handlers with correlation metadata), extract into a shared module:

- [`src/handlers/bust-lifecycle.js`](src/handlers/bust-lifecycle.js) — Bust descriptor and correlation utilities for character/NPC bust handlers
- [`src/handlers/market-transaction-utils.js`](src/handlers/market-transaction-utils.js) — Buy/sell transaction logic for market handlers

**Don't repeat**: If two handlers call the same sequence of context methods or perform identical validations, create a utility and use it from both.

### BP-3: Use `MessageHandlerContext` for centralized runtime concerns

Common lifecycle operations are delegated through [`src/handlers/message-handler-context.js`](src/handlers/message-handler-context.js). Examples:

```javascript
// ✓ Good: uses context method to consolidate detach-then-touch pattern
await this.context.refreshCharacterPresence(payload);

// ✓ Good: uses context helper instead of direct validation
const player = this.context.findPlayer(playerName);
```

**Don't repeat**: If multiple handlers call the same sequence of state mutation methods, add a helper to `MessageHandlerContext` and call that instead.

### BP-4: Session validation happens at registry level only

Session validation is centralized in [`src/handlers/socket-handler-registry.js`](src/handlers/socket-handler-registry.js). Do NOT implement per-handler session guards:

```javascript
// ✗ Wrong: per-handler guard (removed in Phase 4)
if (!(await this.context.hasValidSessionAsync(payload))) {
  const response = { message: INVALID_SESSION_MESSAGE };
  socket.emit(INVALID_SESSION_EVENT, response);
  return response;
}

// ✓ Good: rely on registry guard; never called with invalid session
async handle(socket, payload) {
  // Directly proceed with business logic
  this.context.refreshCharacterPresence(payload);
  // ...
}
```

Handlers marked `requiresSession: true` in the registry are never called unless the session is valid.

### BP-5: Keep handler responsibility narrow

Handlers follow a single pattern:

1. **Validate payload** (required fields, types, ranges)
2. **Check business preconditions** (player exists, character is in list, etc.)
3. **Delegate to services** via `context` methods
4. **Emit response** with correlation metadata echoed back

```javascript
async handle(socket, payload) {
  // (1) Validate
  const playerName = this.context.toNonEmptyString(payload?.playerName);
  if (!playerName) return { success: false, message: 'playerName required' };

  // (2) Check preconditions
  const player = this.context.findPlayer(playerName);
  if (!player) return { success: false, message: 'Player not found' };

  // (3) Delegate
  await this.context.updateSomethingAsync(playerName, payload);

  // (4) Emit response (registry auto-echoes correlationId/requestIdentity)
  const response = this.buildResponse(payload);
  socket.emit(this.responseEventName, response);
  return response;
}
```

**Don't add side concerns** like logging, telemetry, or specialized error handling in the handler itself—these belong in context methods or middleware.
