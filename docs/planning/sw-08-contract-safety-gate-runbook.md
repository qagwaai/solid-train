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
3. Run SW-08 local check.
4. Compare expected vs actual contract nodes.

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

- Use only when urgent and documented.

## 5. Exception Requirements

Required fields:

- Reason and impact.
- Expiry date.
- Rollback steps.
- Follow-up owner and ticket.

Approval:

- Backend lead + frontend lead.

## 6. Communication Template

- Failure ID:
- Contract surface:
- Impacted consumer areas:
- Resolution owner:
- ETA:
- Need exception: yes/no

## 7. Escalation

Escalate when:

- Same drift class repeats in two consecutive releases.
- Exception requested multiple times for same surface.
- No owner assigned within one business day.

Path:

1. Backend lead
2. Frontend lead
3. Engineering manager

## 8. Postmortem Checklist

- Root cause category.
- Missed detection opportunity.
- Test/rule/documentation update.
- Preventive action owner.
