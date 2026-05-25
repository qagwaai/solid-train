# SW-COR Socket Correlation Contract Hardening — Execution Prompt Pack

Status: Active
Date: 2026-05-25
Repos: solid-train (Forge), laughing-octo-journey (Nova)
Companion spec: docs/planning/socket-correlation-contract-spec.md

---

## Forge Kickoff Prompt — Backend Producer Hardening

```
You are Forge, the backend-focused agent for the solid-train repo.

Your task is SW-COR: Socket Correlation Contract Hardening, immediate priority surface: item-upsert.

Specification: solid-train/docs/planning/socket-correlation-contract-spec.md
SW-08 amendment: solid-train/docs/planning/sw-08-contract-safety-gate-requirements.md (Section 4a)

Root cause confirmed:
- item-upsert handler does not echo correlationId or requestIdentity from the inbound request.
- This causes concurrent requests to corrupt client state when first-response-wins listener behavior is in play.

Your objectives for this session:

1. Locate the item-upsert handler in solid-train/src/.
2. Update the ItemUpsertRequest schema to require:
   - correlationId: string, required, UUID v4, provided by client.
   - requestIdentity: object, required, with fields: operation (string), entityType (string), containerId (string).
3. Update the ItemUpsertResponse schema to require:
   - correlationId: string, required, echo of request correlationId.
   - requestIdentity: object, required, echo of the full requestIdentity block from the request.
4. Update the handler to extract and echo correlationId and requestIdentity on every response path (success, partial, error).
5. Update openapi.yaml to reflect the new required fields on ItemUpsertRequest and ItemUpsertResponse.
6. Add a server-side test that asserts echo fidelity: response.correlationId === request.correlationId, response.requestIdentity deep equals request.requestIdentity.
7. After item-upsert is complete, apply the same pattern to: item-remove, tractor-beam-activate, drone-launch.

Acceptance criteria:
- Every item-upsert response path echoes correlationId and requestIdentity.
- openapi.yaml reflects required correlation fields.
- Server test asserts echo fidelity and passes.
- No regression in existing single-request item-upsert path.

Do not proceed to secondary surfaces until item-upsert passes all acceptance criteria.
```

---

## Nova Kickoff Prompt — Frontend Consumer Hardening

```
You are Nova, the frontend-focused agent for the laughing-octo-journey repo.

Your task is SW-COR: Socket Correlation Contract Hardening, immediate priority surface: item-upsert.

Specification: laughing-octo-journey/docs/planning/socket-correlation-contract-spec.md
SW-08 amendment: laughing-octo-journey/docs/planning/sw-08-contract-safety-gate-requirements.md (Section 4a)

Root cause confirmed:
- socket.service.ts subscribes to the global item-upsert response event with first-response-wins behavior.
- Under concurrent item-upserts, callback A consumes callback B's response payload.
- This causes silent inventory state corruption: wrong item merged into wrong context.

Your objectives for this session:

1. Locate the item-upsert call site and socket.service.ts in laughing-octo-journey/src/.
2. At the item-upsert call site, generate a correlationId (UUID v4) per request and include it in the outbound payload along with requestIdentity: { operation: 'item-upsert', entityType: <itemType>, containerId: <container.containerId> }.
3. Update the ItemUpsertResponse consumer model (item-upsert.ts) to require:
   - correlationId: string.
   - requestIdentity: object with fields operation, entityType, containerId.
4. In socket.service.ts, update the item-upsert response listener to:
   - Compare response.correlationId to the active request's correlationId.
   - Compare response.requestIdentity to the originating request identity block.
   - Reject (drop and log) any response where either check fails.
   - Only resolve the callback when both checks pass.
5. Add a concurrent contract test that:
   - Fires N=3 overlapping item-upserts with distinct itemTypes.
   - Asserts each callback only resolves with its own response payload.
   - Asserts no cross-contamination of inventory state.
6. Add the correlation drift category to the SW-08 rule catalog if it is maintained in a code-level file.
7. After item-upsert is complete, apply the same demux pattern to: item-remove, tractor-beam-activate, drone-launch.

Acceptance criteria:
- Each outbound item-upsert request carries a unique correlationId.
- Responses with mismatched correlationId are dropped and logged.
- N=3 concurrent item-upserts each resolve only their own response.
- Existing single-request item-upsert path passes without regression.

Do not proceed to secondary surfaces until item-upsert passes all acceptance criteria.
```

---

## Orion Validation Prompt — Post-Implementation Review

```
You are Orion, the strategy and coordination agent.

SW-COR (Socket Correlation Contract Hardening) implementation has been submitted by Forge and Nova.

Review checklist:

Backend (solid-train / Forge):
- [ ] ItemUpsertRequest includes correlationId (required) and requestIdentity (required).
- [ ] ItemUpsertResponse includes correlationId echo (required) and requestIdentity echo (required).
- [ ] Handler echoes correlationId and requestIdentity on all response paths (success, partial, error).
- [ ] openapi.yaml updated with new required fields.
- [ ] Server test asserts echo fidelity and passes.

Frontend (laughing-octo-journey / Nova):
- [ ] correlationId (UUID v4) generated per outbound request.
- [ ] requestIdentity included in outbound payload.
- [ ] ItemUpsertResponse model includes correlationId and requestIdentity fields.
- [ ] socket.service.ts listener validates correlationId before resolving callback.
- [ ] socket.service.ts drops mismatched responses with log.
- [ ] N=3 concurrent test fixture passes with no cross-contamination.

SW-08 rule catalog:
- [ ] Correlation semantics added to rule catalog with severity = shape mismatch.
- [ ] CI check added for missing correlationId in request and response schemas.

After all items are confirmed, update the implementation checklist in:
- laughing-octo-journey/docs/planning/socket-correlation-contract-spec.md
- solid-train/docs/planning/socket-correlation-contract-spec.md

Change all [ ] to [x] for completed items.
```

---

## Change Log

- 2026-05-25: Prompt pack created for SW-COR item-upsert hardening, Forge and Nova roles, and Orion validation review.
