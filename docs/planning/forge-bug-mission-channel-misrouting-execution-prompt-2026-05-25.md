# Forge Execution Prompt: Mission/Ship Channel Misrouting

Status: Completed
Date: 2026-05-25
Completed: 2026-05-25
Owner: Forge (backend)
Input bug report: docs/planning/forge-bug-mission-channel-misrouting-2026-05-25.md

## Copy/Paste Prompt

```text
You are Forge, the backend-focused agent working in solid-train.

Task: Fix high-severity socket response channel misrouting where mission-list responses are emitted on ship-list-by-owner response channel.

Primary bug report:
- solid-train/docs/planning/forge-bug-mission-channel-misrouting-2026-05-25.md

Contract and governance references:
- solid-train/docs/planning/socket-correlation-contract-spec.md
- solid-train/docs/planning/sw-08-contract-safety-gate-requirements.md (correlation semantics amendment)

Problem statement:
- During ship-exterior bootstrap, ship-list-by-owner-request is sent.
- A payload with requestIdentity.operation=mission-list is received on ship-list-by-owner-response channel.
- Frontend strict correlation rejects this as foreign-operation-on-channel.
- Ship-list callback never resolves for this request instance.

Execution goals:
1. Locate and audit all emit sites and handlers for:
   - ship-list-by-owner response path
   - mission-list response path
2. Verify and correct event constants/channels used by each handler so operation-channel mapping is strict.
3. Add a central operation-to-response-channel mapping table (single source of truth).
4. Add an emit-time guard/assertion:
   - If requestIdentity.operation does not match mapped response channel, fail fast and log structured diagnostic.
5. Add structured emit logging fields:
   - emitted event name
   - requestIdentity.operation
   - correlationId
   - handler/route name
6. Add integration tests:
   - ship-list-by-owner operation emits only ship-list-by-owner-response
   - mission-list operation emits only list-missions-response
   - negative assertions prove no cross-channel emission
7. Validate ship-exterior bootstrap flow end-to-end with strict correlation enabled.

Definition of done:
- No mission-list payload is emitted on ship-list-by-owner-response.
- No ship-list payload is emitted on list-missions-response.
- response.correlationId and requestIdentity echo initiating request semantics for each operation.
- Repro flow yields zero foreign-operation-on-channel violations.
- Ship-exterior bootstrap receives matching ship-list response and proceeds deterministically.

Output format required:
- Files changed with concise rationale.
- Tests added/updated and exact test names.
- Before/after behavior summary for emit routing.
- Residual risk notes (if any) and follow-up recommendations.
```

## Change Log

- 2026-05-25: Execution prompt created from Nova-reported channel misrouting bug report.
- 2026-05-25: Prompt execution completed and bug marked closed in planning records.
