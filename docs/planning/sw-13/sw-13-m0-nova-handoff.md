# SW-13 M0 Nova Handoff Packet

Status: Draft (Ready for Nova Acknowledgment)
Date: 2026-05-30
From repo: solid-train (Forge)
To repo: laughing-octo-journey (Nova)
Feature ID: SW-13

## 1. Purpose

Transmit SW-13 M0 contract baseline expectations from Forge to Nova so cross-repo implementation can proceed without descriptor drift.

## 2. Canonical Descriptor Baseline

Descriptor domains:

1. `debris`
2. `ship`
3. `jump_gate`
4. `station`
5. `asteroid`

Asteroid styles:

1. `rocky`
2. `hero_cinematic`

Strict policy:

1. Unknown descriptor values are contract violations.
2. No legacy mapping fallback paths are allowed.
3. Full cutover behavior is required for SW-13.

## 3. Nova Action Checklist

1. Align consumer inventory to canonical descriptor domains.
2. Ensure renderer taxonomy maps only canonical descriptor values.
3. Add/confirm visible violation handling for unsupported descriptor values.
4. Confirm no legacy descriptor compatibility logic remains.
5. Attach alignment evidence in SW-13 cross-repo index.

## 4. Coordinated Gate Expectations

1. Forge producer descriptor gate: hard-fail on drift.
2. Nova consumer preflight gate: hard-fail on drift.
3. Both gates must pass before milestone closure.

## 5. Recommended M0 Verification Commands (Repo-Local Adaptation Allowed)

1. Canonical descriptor check (expected pass).
2. Enum/domain drift fixture (expected fail).
3. Unsupported descriptor fixture (expected fail).
4. Shape mismatch fixture (expected fail).

## 6. Acknowledgment

Nova acknowledgment status: Pending.

Acknowledgment notes:

- Add confirmation, command evidence, and any deviations here.
