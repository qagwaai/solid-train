# SW-08 Contract Safety Gate Prompt Pack

Status: Draft
Date: 2026-05-24
Repo: solid-train
Purpose: Reusable prompts for implementing and operating producer-side contract safety.

## Usage Rules

1. Start from SW-08 requirements before using any prompt.
2. Keep prompts aligned with current contract artifact paths.
3. Require explicit acceptance criteria in prompt outputs.

## Prompt 1: Generate Canonical Contract Artifact

"Create or refine deterministic contract artifact generation for solid-train APIs and socket events. Ensure stable ordering and consistent schema serialization for CI diffs."

## Prompt 2: Detect Producer Breaking Changes

"Implement checks to classify breaking producer changes: removed required fields, type mismatch, enum narrowing, endpoint/event removal, and renamed contract nodes. Output owner and impacted consumer surfaces."

## Prompt 3: Add CI Gate Stages

"Add SW-08 CI stages for report-only, soft fail, and hard fail. Promote PRs to hard-fail once rollout is approved. Publish detailed diagnostics as CI artifact and include remediation hints."

## Prompt 4: Build Compatibility Fixtures

"Add test fixtures for intentional producer-side breaks and compatibility-preserving alternatives. Verify that hard breaks fail and compatible migrations pass."

## Prompt 5: Write Migration Notes

"Given this contract change, draft migration notes including deprecated fields, compatibility window, and required frontend update steps."

## Prompt 6: Coordinate Cross-Repo Change

"Produce a coordinated merge plan for this contract change across solid-train and laughing-octo-journey, including sequence, temporary compatibility strategy, and rollback checkpoints."

## Prompt 7: Runbook Update

"Update SW-08 runbook sections with new failure signatures, local reproduction instructions, and owner mapping based on latest CI output."

## Prompt 8: Exception Validation

"Review requested SW-08 exception for required fields: reason, impact, expiry date, rollback plan, and owner. Reject if incomplete."

## Prompt 9: Hard-Fail Triage

"For a SW-08 hard-fail, identify producer location, impacted consumer surface, severity, and owner first. If the exception is expired or missing approvals, reject it and fix the producer contract or alias instead."
