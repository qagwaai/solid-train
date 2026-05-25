# SW-08 Producer Migration Note Template

Use this template for backend-produced contract changes that may affect consumers.

## Change Summary

- Change ID:
- Date:
- Owner:
- Contract surface:
- Related PR:

## Producer Contract Delta

- Endpoint/event impacted:
- Schema nodes impacted:
- Drift categories (if any):
  - removed required fields:
  - type mismatches:
  - enum narrowing/mismatch:
  - endpoint/event removal or rename:

## Compatibility Strategy

- Backward-compatible alias added: yes/no
- Deprecated fields/endpoints retained: yes/no
- Compatibility window (start/end):
- Fallback behavior:

## Consumer Impact

- Known consumer repos:
- Impacted frontend surfaces:
- Required consumer updates:

## Rollout Sequence

1. Backend merge order:
2. Frontend merge order:
3. Validation checkpoints:

## Verification

- Local SW-08 check command output:
- CI SW-08 report artifact:
- Intentional mismatch fixture status:

## Risk and Contingency

- Risk summary:
- False-positive watch areas:
- Rollback steps:

## Sign-off

- Backend lead:
- Frontend lead:
- QA lead:
