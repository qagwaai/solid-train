---
Owner: Project Maintainers
Last Verified: 2026-05-17
Status: Historical
---

# Repair Inventory Persistence Runbook (Hull Patch Kit)

## Purpose

Capture the shortest path to diagnose and resolve the "Hull Patch Kit still appears after Fully Repair Ship" issue class.

This runbook is based on live traces and code fixes applied during the 2026-05-17 investigation.

## What We Learned

1. There are two independent state channels involved:

- Ship inventory references (embedded under character.ships[].inventory)
- Item rows (global items collection, including container/state)

2. A "still visible" report can be caused by either:

- Reference not removed (ship inventory bug)
- Reference removed, but item row still contained during a short request-order window

3. Fast truth source order for this incident class:

- ship-upsert pre/persisted inventory ids
- ship-list projected inventory ids
- item lifecycle logs for hull patch kit state/container

## Quick Triage Decision Tree

Use the same correlation id across related requests whenever possible.

1. Check ship-upsert incoming line:

- hasInventoryPatch=false
  - Ship-upsert will preserve existing references by contract.
  - If repair expects removal, this is a caller contract issue unless backend safeguard applies.
- hasInventoryPatch=true
  - Continue.

2. Compare ship-upsert pre-persist vs persisted ids:

- Removed id still present in persisted
  - Persistence/merge bug in backend update path.
- Removed id absent in persisted
  - Ship refs are correct. Continue.

3. Check ship-list projected ids for same ship:

- Removed id appears in projectedItemIds while absent from inventoryRefIds
  - Projection bug (unreferenced contained item being appended).
- Removed id absent in projectedItemIds
  - Projection is correct. Continue.

4. Check item lifecycle logs:

- hull-patch-kit-updated shows state=destroyed and container=null
  - Item consumed correctly.
- hull-patch-kit-fetched-by-container shows contained after reference removal
  - Ordering window: item-upsert/destroy happened later than ship-upsert.

## Canonical Log Signatures

### Healthy repair result

- ship-upsert-diag incoming hasInventoryPatch=true (or repair safeguard runs)
- ship-upsert-diag pre-persist: removed kit id absent in prePersistInventoryItemIds
- ship-upsert-diag persisted: removed kit id absent in inventoryItemIds
- ship-list-diag projectedItemIds: removed kit id absent
- item-lifecycle-diag hull-patch-kit-updated: state=destroyed containerType=null

### Caller contract miss

- ship-upsert-diag incoming hasInventoryPatch=false
- previousInventoryItemIds and prePersistInventoryItemIds are identical
- persisted inventory keeps kit reference

### Ordering window (not recreation)

- ship-upsert persisted inventory excludes kit reference
- ship-list projected inventory excludes kit reference
- a nearby hull-patch-kit-fetched-by-container may still show contained
- later item-upsert/hull-patch-kit-updated transitions item to destroyed/null

## Fixes Applied During Incident

1. Ship-upsert diagnostics expanded:

- incoming patch intent and payload
- pre-persist and post-persist inventory id sets
- correlation id propagation

2. Ship-list projection hardened:

- Do not append arbitrary unreferenced contained items to projected ship inventory.
- Allow only authoritative references plus explicit starter subsystem exceptions.

3. Repair safeguard in ship-upsert:

- On repair transition to intact with omitted inventory patch, auto-consume one hull patch kit:
  - remove inventory reference
  - set item state=destroyed, damageStatus=destroyed, container=null

4. Concurrency diagnostics added:

- update-character conflict/retry/recovered/fail lines with correlation id

5. Mission path diagnostics added:

- before/after mission-upsert ship inventory snapshots

## Short-Circuit Workflow For Future Incidents

Run this in order and stop at first definitive answer.

1. Collect one end-to-end correlation id.
2. Read ship-upsert incoming and persisted lines.
3. Read one ship-list line for same ship and correlation id.
4. Read item-lifecycle lines for hull patch kit id.
5. Classify as:

- caller patch omission
- backend merge/persist bug
- projection bug
- ordering window only

Typical time to classification: under 2 minutes with complete logs.

## Guardrails To Keep

1. Keep contract semantics explicit:

- inventory present means authoritative patch
- inventory omitted means preserve existing (except explicit repair safeguard branch)

2. Keep correlation id propagation on all state-mutating handlers.

3. Keep ship-upsert and ship-list diag lines while repair work is active.

## Temporary Logs Cleanup Plan

After repair workflow is stable and no regressions observed for one release window:

1. Keep:

- correlation id in handler base logs
- concise ship-upsert incoming/persisted inventory summaries

2. Remove or downgrade:

- incoming-patch JSON payload dump
- verbose mission-upsert before/after inventory snapshots
- hull-patch-kit-specific lifecycle debug lines

3. Preserve this runbook for future incidents.
