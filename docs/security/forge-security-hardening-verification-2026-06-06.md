# Forge Security Hardening Verification (2026-06-06)

## Scope
- Repository-internal hardening only.
- GitHub org/repo settings are out of scope here and assumed already completed.
- OpenAPI and existing contract hardening guarantees preserved.

## Controls Implemented

### 1) Secrets and hygiene
- Expanded ignore coverage for local env and key material in [.gitignore](../../.gitignore).
- Refreshed placeholder-only env template in [.env.example](../../.env.example).
- Added CI secret scan gate using pinned Gitleaks action in [.github/workflows/security-hardening-gate.yml](../../.github/workflows/security-hardening-gate.yml).

### 2) Dependency and supply chain
- Lockfile policy enforced in CI with `test -f package-lock.json` and `npm ci --ignore-scripts` in [.github/workflows/security-hardening-gate.yml](../../.github/workflows/security-hardening-gate.yml).
- Added high/critical vulnerability gate with `npm audit --audit-level=high` via [package.json](../../package.json) script `security:audit` and CI invocation.
- Added dependency automation in [.github/dependabot.yml](../../.github/dependabot.yml) for npm and GitHub Actions.
- Added pinned Node toolchain file [.nvmrc](../../.nvmrc) and updated workflows to use it.

### 3) CI/workflow hardening
- Set least-privilege top-level permissions in:
  - [.github/workflows/sw-08-contract-safety-gate.yml](../../.github/workflows/sw-08-contract-safety-gate.yml)
  - [.github/workflows/sw-08-weekly-metrics.yml](../../.github/workflows/sw-08-weekly-metrics.yml)
  - [.github/workflows/security-hardening-gate.yml](../../.github/workflows/security-hardening-gate.yml)
- Pinned third-party actions to full commit SHAs across all updated workflows.
- No deploy/release privileged jobs are present in this repo workflow set; PR jobs remain non-privileged.

### 4) Code/API security gates
- Added CodeQL static analysis job in [.github/workflows/security-hardening-gate.yml](../../.github/workflows/security-hardening-gate.yml).
- Added contract security assertions in CI:
  - Stage 3 hardening test
  - SW-01 and SW-13 contract hardening suites
- Preserved existing SW-08 contract safety gate behavior.

## Files Changed
- [.gitignore](../../.gitignore)
- [.env.example](../../.env.example)
- [package.json](../../package.json)
- [package-lock.json](../../package-lock.json)
- [.nvmrc](../../.nvmrc)
- [.github/dependabot.yml](../../.github/dependabot.yml)
- [.github/workflows/sw-08-contract-safety-gate.yml](../../.github/workflows/sw-08-contract-safety-gate.yml)
- [.github/workflows/sw-08-weekly-metrics.yml](../../.github/workflows/sw-08-weekly-metrics.yml)
- [.github/workflows/security-hardening-gate.yml](../../.github/workflows/security-hardening-gate.yml)

Note:
- Pre-existing change in [docs/planning/sw-15/sw-15-m2-a-forge-verification-note.md](../planning/sw-15/sw-15-m2-a-forge-verification-note.md) was intentionally left untouched for this hardening request.

## Test and Scan Evidence

### Security scan results
- Local dependency scan gate: PASS
- Command: `npm run security:audit`
- Result: `found 0 vulnerabilities`

### Dependency scan results
- Local npm audit high/critical gate: PASS
- Command: `npm audit --audit-level=high`
- Result: `found 0 vulnerabilities`

### Contract hardening non-regression results
- Stage 3 contract security tests: PASS (5/5)
- SW-01 mission status hardening tests: PASS (5/5)
- Item type hardening tests: PASS (6/6)
- SW-13 descriptor hardening tests: PASS (13/13)
- Commands executed:
  - `node --test test/sw08-contract-stage3.test.js`
  - `npm run contract:lint:item-types`
  - `npm run contract:lint:mission-status`
  - `npm run contract:lint:sw13-descriptor`

### CI run URLs
- Pending branch push and workflow execution.
- Populate after first run:
  - Security Hardening Gate: TODO
  - SW-08 Contract Safety Gate: TODO
  - SW-08 Weekly Metrics (if manually run): TODO

## Remaining Risks / Exceptions
- No in-source contract/runtime blockers identified.
- Administrative follow-up required to attach GitHub Actions run URLs after push.

## Handoff Decision
- Ready

## Handoff Note
- Repository-internal hardening controls are implemented and locally validated.
- Next owner action: push branch and capture CI run URLs for Orion intake evidence closure.
