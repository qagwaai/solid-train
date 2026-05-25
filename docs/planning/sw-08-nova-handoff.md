# SW-08 Nova Handoff

Audience: Nova
Owner tags: backend-lead, frontend-lead, qa-lead

## Expected Consumer-Impact Signals

- `removed required fields` means a consumer is still relying on the old required surface.
- `type mismatches` means a frontend model or guard is stale.
- `enum narrowing/mismatch` means a frontend fallback path may need widening or a migration window.
- `endpoint/event removal or rename` means a consumer path or event handler is tied to a removed surface.

## What Nova Should Watch

- Drift report artifact path in CI.
- `producerLocation` in the diagnostic report.
- `consumerSurfaces` and `knownConsumers` tags.
- `owner` and `severity` for triage routing.

## Routing Rules

- Route producer fixes to `backend-lead`.
- Route consumer updates to `frontend-lead`.
- Route fixture or gate-health follow-up to `qa-lead`.

## Stage 2 Notes

- Soft fail is expected on breaking drift unless an approved bypass is attached.
- Approved bypasses must include expiry, rollback steps, follow-up ticket, and both lead approvals.
