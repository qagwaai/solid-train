# SW-08 Nova Handoff

Status: Completed (Maintenance Mode)
Date: 2026-05-24
Completed: 2026-05-25

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

## Highest-Risk Producer Surfaces

- `market.list`.
- `fabrication.printableItem`.
- `shipExterior.launchItem`.

## Next Diagnostic Metadata

- Explicit `ownerTag` on producer surfaces.
- A stable migration-note link for intentional change windows.
- A clear taxonomy that separates intended additions from breaking changes.

## Routing Rules

- Route producer fixes to `backend-lead`.
- Route consumer updates to `frontend-lead`.
- Route fixture or gate-health follow-up to `qa-lead`.

## Stage 2 Notes

## Stage 3 Notes

- Hard fail is expected on breaking drift unless an approved exception is attached.
- Treat expired or incomplete exceptions as release blockers.
- Approved exceptions must include expiry, rollback steps, follow-up ticket, and both lead approvals.

## Hard-Fail Triage

- Start with `producerLocation`, `consumerSurfaces`, `severity`, and `owner`.
- If the drift is intentional and still inside the expiry window, attach the approved exception and rerun the gate.
- If the exception is expired or missing approvals, fix the producer contract or restore the alias instead of retrying.

## Stage 5 Continuous Assurance Note

- Use `artifacts/contracts/sw08-trend-report.json` for weekly and rolling 30-day drift trends.
- If `recurrenceEscalation.active=true`, escalate repeat offenders (class + producer surface) to backend/frontend leads.
- Track near-expiry exceptions in `exceptionHygiene.nearExpiryExceptions` and enforce owner assignment before release cut.
- PRs touching producer contract surfaces now require the SW-08 checklist and a migration-note link (or `not-required`).
