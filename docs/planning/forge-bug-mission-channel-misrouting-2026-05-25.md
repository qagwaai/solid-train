# Forge Bug Report: Socket Response Channel Misrouting

Status: Completed
Date: 2026-05-25
Completed: 2026-05-25
Reported by: Nova
Owner: Forge (backend)
Severity: High
Area: Socket contract routing / ship-exterior bootstrap

## Title

Mission-list response is being emitted on ship-list-by-owner response channel, causing strict correlation rejection and blocking ship-exterior bootstrap.

## Summary

During ship-exterior bootstrap, a ship-list-by-owner request is sent, but a response payload with mission-list identity is received on the ship-list-by-owner response channel. This violates the socket contract and prevents the client from receiving a matching ship-list response.

## Observed Evidence

Frontend log excerpt:

[socket-correlation] Contract violation: foreign operation payload on ship-list-by-owner response channel. code=socket-contract-violation channel=ship-exterior-wrapper operation=ship-list-by-owner reason=foreign-operation-on-channel requestEvent=ship-list-by-owner-request responseEvent=ship-list-by-owner-response expectedCorrelationId=ship-list-by-owner:... expectedRequestOperation=ship-list-by-owner expectedRequestEntityType=ship expectedRequestContainerId=player-character:... responseCorrelationId=mission-list:... responseRequestOperation=mission-list responseRequestEntityType=mission responseRequestContainerId=...

## Contract Reference

Distinct socket operations/channels are defined for:
- ship-list-by-owner request/response
- mission-list request/response

Frontend uses separate constants/listeners for each channel:
- laughing-octo-journey ship-list-by-owner contract
- laughing-octo-journey mission-list contract
- laughing-octo-journey ship-exterior socket service listener
- laughing-octo-journey mission service listener

## Reproduction

1. Start app and navigate to ship exterior flow.
2. Trigger ship-exterior bootstrap (seed policy resume or new path that requests ship-list-by-owner).
3. Observe contract-violation log where responseRequestOperation is mission-list while received on ship-list-by-owner-response channel.

## Expected Result

- ship-list-by-owner-request receives only ship-list-by-owner-response payloads.
- response.requestIdentity.operation must be ship-list-by-owner.
- response.correlationId must echo the correlationId from the triggering ship-list-by-owner request.
- response.requestIdentity should echo operation/entityType/containerId semantics from request.

## Actual Result

- mission-list payload appears on ship-list-by-owner-response channel.
- response correlation/identity do not match pending ship-list request.
- ship-list callback is never invoked for that request instance.

## Impact

- Ship-exterior bootstrap cannot complete as designed.
- Asteroid seeding path can stall waiting for ship list.
- Correlation noise increases and masks real signal during debugging.

## Acceptance Criteria

- No mission-list payloads are emitted on ship-list-by-owner-response channel.
- No ship-list payloads are emitted on list-missions-response channel.
- For each socket operation, response correlationId and requestIdentity echo the initiating request.
- Repro flow produces zero socket-contract-violation logs for foreign-operation-on-channel.
- Ship-exterior bootstrap receives matching ship-list response and proceeds deterministically.

## Suggested Backend Diagnostics

Add server-side structured logging at emit point with:
- socket event name emitted
- requestIdentity.operation
- correlationId
- request route/handler name

Add assertion/guard before emit:
- emitted channel must match operation mapping table

Add integration tests for channel-operation mapping:
- operation ship-list-by-owner -> channel ship-list-by-owner-response
- operation mission-list -> channel list-missions-response

## Proposed Work Items (Forge)

1. Audit emit sites for ship-list-by-owner and mission-list responses and verify event constants used by each handler.
2. Add a central operation-to-response-channel mapping table and enforce it before emit.
3. Add emit-time structured logging for operation, correlationId, emitted event, and handler source.
4. Add integration tests validating operation-channel mapping and cross-channel negative assertions.
5. Verify ship-exterior bootstrap path end-to-end with strict correlation enabled.

## Related Documents

- docs/planning/socket-correlation-contract-spec.md
- docs/planning/sw-08-contract-safety-gate-requirements.md
- docs/planning/sw-08-cross-repo-index.md

## Change Log

- 2026-05-25: Initial bug report created from Nova recommendation and correlation-violation logs.
- 2026-05-25: Bug closed. Channel-operation routing corrected, correlation semantics enforced at emit paths, and regression protections added.
