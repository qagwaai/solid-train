# Database Service Test Split

This file documents why the db service tests are split across two files.

- test/db-service-core.test.js
  - Focus: small helper methods and lightweight unit behavior.
  - Pattern: narrow stubs and deterministic assertions around normalization,
    query shaping, and short-circuit branches.

- test/db-service-extended.test.js
  - Focus: broader service workflows and edge-path orchestration.
  - Pattern: multi-step behavior across register/update/mission/celestial flows,
    including negative paths and persistence interaction sequencing.

Rationale:
- Keeps fast micro-behavior checks isolated from larger scenario tests.
- Makes failures easier to triage by intent: helper logic vs workflow behavior.
- Reduces fixture/setup churn for targeted maintenance.
