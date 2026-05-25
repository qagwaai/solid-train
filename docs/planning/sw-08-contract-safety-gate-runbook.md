# SW-08 Contract Safety Gate Runbook (Backend-Led)

Status: Draft
Date: 2026-05-24
Repo: solid-train

## 1. Trigger

Use this runbook when SW-08 CI fails due to contract drift or incompatible producer changes.

## 2. Triage Sequence

1. Read drift type and severity.
2. Identify producer artifact segment and affected consumer domains.
3. Reproduce locally.
4. Decide compatibility fix, consumer update, or exception.

## 3. Local Reproduction Steps

1. Pull latest main.
2. Regenerate contract artifact.
3. Run the Stage 3 hard-fail check with `npm run contract:gate:hard`.
4. Run the approved-exception path with `npm run contract:gate:hard:approved`.
5. Run the expired-exception rejection check with `npm run contract:gate:hard:expired`.
6. Run the missing-approval rejection check with `npm run contract:gate:hard:missing-approval`.
7. Run the compatibility-window check with `npm run contract:compat-check:hard`.
8. Run the weekly metrics report with `npm run contract:metrics:weekly`.
9. Compare expected vs actual contract nodes.

## 4. Resolution Paths

Producer compatibility fix:

- Restore removed field.
- Add compatibility alias.
- Expand enum handling.

Coordinated migration:

- Keep old and new shapes during window.
- Publish migration note.
- Merge frontend adaptation in planned sequence.

Exception path:

- Use only when urgent, documented, and still inside the expiry window.
- Keep triage within 1 business day and closure or approved exception within 2 business days.
- Approved bypass metadata must include reason, impact, expiry date, rollback steps, follow-up ticket, owner, and approvals.backendLead/frontendLead set to true.
- Expired or missing-approval exceptions must fail CI automatically.

## 5. Exception Requirements

Required fields:

- Reason and impact.
- Expiry date.
- Rollback steps.
- Follow-up owner and ticket.

Approval:

- Backend lead + frontend lead.

## 6. Hard-Fail Triage Note

- Start with `producerLocation`, `consumerSurfaces`, `severity`, and `owner`.
- If the drift is intentional, attach a valid exception with both lead approvals before retrying.
- If the exception is expired or incomplete, treat it as a release blocker and fix the producer or rename alias instead.
- For a hard failure, the next action should be either producer compatibility restoration or a corrected exception with a valid expiry window.
- Keep the rollback plan and follow-up ticket in the handoff thread so the frontend team can sequence their update.

## 7. Communication Template

- Failure ID:
- Contract surface:
- Impacted consumer areas:
- Resolution owner:
- ETA:
- Need exception: yes/no

## 8. Escalation

Escalate when:

- Same drift class repeats in two consecutive releases.
- Exception requested multiple times for same surface.
- No owner assigned within one business day.

Path:

1. Backend lead
2. Frontend lead
3. Engineering manager

## 9. Postmortem Checklist

- Root cause category.
- Missed detection opportunity.
- Test/rule/documentation update.
- Preventive action owner.
