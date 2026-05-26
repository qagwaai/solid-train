# Socket Request-Response Correlation Contract Specification

Status: Completed (Maintenance Mode)
Date: 2026-05-25
Completed: 2026-05-25
Repos: solid-train (producer), laughing-octo-journey (consumer)
Owner: Backend lead (producer), Frontend lead (consumer), QA lead (validation)
Triggered by: item-upsert race condition root cause analysis

## 1. Problem Statement

SW-08 enforces shape-level contract correctness. It does not currently enforce communication-semantic correctness: that a response belongs to the request that originated it.

Under concurrent socket operations (for example overlapping item-upsert calls), a first-response-wins listener can consume another request's response payload. The data shape is valid, the fields are present, but the correlation is wrong. The client merges state from the wrong operation.

This class of drift is invisible to shape-only contract checks and requires an explicit correlation contract layer.

## 2. Root Cause (item-upsert specific)

Confirmed failure pattern:

1. Client fires item-upsert(sensor-array) and item-upsert(expendable-dart-drone) concurrently.
2. Both subscribe to the global item-upsert response event.
3. callback-A receives expendable-dart-drone response (which arrived first).
4. callback-A merges drone state into sensor-array context.
5. From the player perspective: sensor-array appears to succeed but inventory shows drone instead.

Root cause layers:

1. item-upsert.ts: ItemUpsertResponse does not require correlationId or request identity echo.
2. socket.service.ts (consumer): listener accepts first matching event without correlation validation.
3. SW-08: treats missing correlation semantics as out of scope (shape only).

## 3. Canonical Correlation Contract

All socket request/response pairs must satisfy:

### 3.1 Request Requirements

Every socket request must include:

- `correlationId`: string, required, UUID v4, generated client-side per request.
- `requestIdentity`: object, required, containing at minimum:
  - `operation`: string (for example "item-upsert")
  - `entityType`: string (for example itemType or equivalent domain key)
  - `containerId`: string

### 3.2 Response Requirements

Every socket response must echo:

- `correlationId`: string, required, exact echo of request correlationId.
- `requestIdentity`: object, required, echo of the full request identity block.

### 3.3 Client Demux Rule

Clients must:

1. Validate that `response.correlationId === activeRequest.correlationId` before processing.
2. Validate that `response.requestIdentity` matches the originating request identity block.
3. Reject (drop and log) any response that fails either check.
4. Never resolve a request callback with a mismatched response.

### 3.4 Server Echo Rule

Backend handlers must:

1. Extract correlationId from the incoming request.
2. Include the exact correlationId in every response emitted for that request.
3. Include the full requestIdentity block as received.
4. This applies to success, partial, and error responses.

## 4. Scope of Application

Apply this contract to all socket event pairs where:

- The client fires requests concurrently or in rapid sequence.
- The response triggers a client-side state mutation.
- Multiple in-flight requests to the same event name are possible.

Immediate priority surfaces:

1. item-upsert (confirmed failure source)
2. item-remove
3. tractor-beam-activate
4. drone-launch

Secondary priority surfaces (apply after immediate pass):

1. fabrication-enqueue
2. market-buy / market-sell
3. mission-accept / mission-complete
4. scan-target

## 5. SW-08 Correlation Rule Amendment

SW-08 must treat the following as contract violations, same severity as shape mismatch:

- Response does not echo correlationId.
- Response correlationId does not match any active request correlationId.
- Response requestIdentity does not match the originating request identity block.
- Client listener resolves a request with a mismatched response.

CI checks must:

1. Validate that request schema includes correlationId as required.
2. Validate that response schema echoes correlationId as required.
3. Include a concurrent-request fixture that fires overlapping operations and asserts each callback only consumes its own response.

## 6. Test Requirements

### Unit tests

- correlationId is required on outbound request, fails if missing.
- Response with non-matching correlationId is dropped.
- Response with matching correlationId is accepted and merged correctly.

### Concurrent contract tests

- Fire N overlapping item-upserts (minimum N=3).
- Assert each callback only resolves with its own response payload.
- Assert no cross-contamination of state merges.

### Fixture requirements

- Intentional mismatch fixture: response correlationId deliberately differs from request.
- Prove: client drops mismatched response.
- Prove: client resolves correct response when correlationId matches.

## 7. Implementation Checklist

Backend (solid-train / Forge):

- [x] Add correlationId (required, UUID v4) to ItemUpsertRequest schema.
- [x] Add correlationId echo + requestIdentity echo to ItemUpsertResponse schema.
- [x] Update handler to echo correlationId and requestIdentity in every response path.
- [x] Apply same pattern to item-remove.
- [x] Apply same pattern to tractor-beam-activate.
- [x] Apply same pattern to drone-launch (`launch-item` surface in solid-train).
- [x] Add server-side test asserting echo fidelity.
- [x] Update openapi.yaml with correlationId fields on all in-scope event pairs.

Frontend (laughing-octo-journey / Nova):

- [x] Generate correlationId (UUID v4) per request in socket call site.
- [x] Update ItemUpsertResponse consumer model to include correlationId.
- [x] Add demux validation in socket.service.ts: reject responses with mismatched correlationId.
- [x] Apply same demux pattern to item-remove, tractor-beam-activate, drone-launch.
- [x] Add concurrent test fixture covering N=3 overlapping item-upserts.
- [x] Add SW-08 drift rule for missing correlation echo.

QA:

- [x] Validate all in-scope fixtures pass in CI.
- [x] Confirm concurrent test is non-flaky over repeated runs.
- [x] Add correlation check to SW-08 rule catalog.

## 8. Acceptance Criteria

1. item-upsert passes correlationId on every request.
2. Backend echoes correlationId and requestIdentity on every response.
3. Frontend drops responses with mismatched correlationId.
4. N=3 concurrent item-upserts each resolve only their own response.
5. SW-08 CI catches missing correlationId as a hard failure.
6. No regression in existing item-upsert single-request path.

## 9. Long-Term Governance

This specification becomes the canonical correlation contract for all new socket event pairs:

1. Any new socket event pair must include correlationId by default.
2. PR reviewer must confirm correlationId echo is present in both request and response schemas.
3. SW-08 rule catalog must include correlation echo as a standing required rule.
4. Periodic audit: quarterly review of in-scope surface list for any newly added event pairs.

## 10. Related Documents

- solid-train/docs/planning/sw-08-contract-safety-gate-requirements.md
- solid-train/docs/planning/sw-08-contract-safety-gate-runbook.md
- laughing-octo-journey/docs/planning/sw-08-contract-safety-gate-requirements.md
- laughing-octo-journey/docs/planning/socket-correlation-contract-spec.md

## Change Log

- 2026-05-25: Initial correlation contract specification created from item-upsert race condition root cause analysis.
- 2026-05-25: Completion recorded. Nova and Forge confirmed SW-COR implementation complete; moved to maintenance mode.
