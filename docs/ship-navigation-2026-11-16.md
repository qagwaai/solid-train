# Ship Navigation Phase 2 — illustrative single-candidate prediction

Date: 2026-11-16

Status: **Phase 2C complete; Phase 2D formatting cleanup complete (uncommitted, awaiting owner review).**
After Nova's review, the owner authorized `scope=full-phase2b` on 2026-11-16.
The solver, same-capture integration and four contract corrections are implemented.
The owner subsequently relayed Nova's approval and selected
`nextStep=phase2c-readiness`. Nova then reported live validation success and the
owner declared Phase 2C complete (D22). The owner committed the Phase 2 work
locally as `5ce7df13`; Phase 2D cleanup is recorded in Section 12.4.
Phase 1, the paired
direct-distance baseline and the UI-only broad candidate sweep remain unchanged.

Owners:

- **Forge** — backend data/API behavior and OpenAPI (the contract authority).
- **Nova** — illustrative path geometry and Viewer presentation; consumes this
  contract after approval.
- **Owner (user)** — approves contracts, implementation phases and product
  decisions.

Working agreement: one phase at a time; exact validation commands with expected
results; pause for owner validation before proceeding. Prettier stays out of the
edit/test cycle and runs only when the owner requests end-of-session cleanup. A
draft in this document is not implementation approval.

## 1. Progress tracking

### Phase tracker

| Phase                                                 | Depends on    | Status                                           | Completion evidence                                                                                                  |
| ----------------------------------------------------- | ------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1 — Navigation position projection and preview        | —             | Accepted                                         | Commit `5a53dbe7`; owner visual acceptance relayed in Nova's 2026-11-16 prompt; [spatial-model.md](spatial-model.md) |
| 1b — Paired direct baseline (`navigationEstimate`)    | 1             | Accepted                                         | Commit `c18aa84b`; owner visual acceptance relayed in Nova's 2026-11-16 prompt                                       |
| 1c — UI-only broad candidate sweep                    | 1             | Accepted (Nova-only; no backend change)          | Nova's 2026-11-16 prompt                                                                                             |
| 2A — Phase 2 contract proposal                        | 1, 1b         | Approved with the implemented review corrections | Initial provisional approval D11–D16; final Nova approval relayed by owner in D20                                    |
| 2B — Phase 2 backend implementation                   | 2A approved   | Approved by Nova                                 | Owner relayed approval (D20); 87 focused tests pass, Section 12.2; owner commit `5ce7df13`                           |
| 2B.1 — Contract, schemas, examples and contract tests | 2A            | Reviewed; corrections implemented in 2B          | Historical evidence in Section 12.1; Nova's four review items resolved below                                         |
| 2C — Nova consumption and visual acceptance           | 2B            | Complete                                         | D21 readiness (Section 12.3); Nova validation success and owner completion, D22                                      |
| 2D — End-of-session Prettier/cleanup                  | 2B            | Complete (uncommitted)                           | Owner cleanup prompt and scope D22–D24; evidence in Section 12.4                                                     |
| 3+ — Later navigation phases                          | Separate gate | Not started                                      | —                                                                                                                    |

### 2A — contract proposal checklist

- [x] Clarifying decisions captured from the owner (Section 3).
- [x] Timing algorithm prototyped against the real Sol catalog with scratch
      scripts only; no repository changes (Section 6.6).
- [x] Draft contract, OpenAPI/schema diff, outcomes, tests and commands recorded
      (Sections 4–12).
- [x] Draft schemas (10.1–10.4) and examples (10.6) checked in memory with the
      repository AJV validator (`src/model/schema-validator.js`) against the
      dereferenced solarsystem contract. No files were changed. Results: the 3
      new examples are valid; 19 negative cases are rejected (speed bounds,
      type and missing speed, extra key, missing candidate or navigation,
      success with an ineligible state, no candidates, outer failure, positions
      on a rejection, an added duration, residual > 1, iterations > 64, epoch
      ≥ 2100, `INVALID_SESSION`, a reason under the wrong status, the wrong
      association, a missing assumption); and the 6 existing solarsystem
      examples remain valid.
- [x] Provisional owner/Nova approval to apply the contract and draft diff only;
      runtime work requires another review (D11).
- [x] Open product decisions P1–P5 resolved (D12–D16; Section 14).

### 2B — implementation checklist (do not start before 2A approval)

- [x] `api/schemas/navigation-prediction-options.schema.json` (new).
- [x] `api/schemas/navigation-paired-prediction.schema.json` (new).
- [x] `api/schemas/solar-system-get-request.schema.json` (opt-in property,
      handler-owned prediction validation; existing selector rules preserved).
- [x] `api/schemas/solar-system-get-response.schema.json` (sibling property and
      success constraint).
- [x] `api/openapi/solarsystem/openapi.yaml` (description paragraph, one request
      and two response examples).
- [x] `api/openapi.yaml` (root navigation note).
- [x] Contract-only tests in `test/navigation-prediction.test.js` (six tests
      covering request/response constraints and example association).
- [x] Owner/Nova review of step 2B.1 before any runtime implementation.
- [x] `src/handlers/context/navigation-prediction-service.js` (new: constants,
      options validation, pure leg solver, composition and outcome mapping).
- [x] `src/handlers/context/navigation-state-service.js` (optional fifth
      argument, read-only per-epoch evaluator views, prediction inside the
      existing capture pair).
- [x] `src/handlers/solar-system-get-message-handler.js` (compose sibling; skip
      presence refresh).
- [x] Runtime tests in `test/navigation-prediction.test.js` and
      `test/navigation-purchase.mongo.integration.test.js` (persisted lineage).
- [x] `test/celestial-operation-examples.test.js` (solarsystem examples 13 → 16 → 19).
- [x] [spatial-model.md](spatial-model.md) runtime section; pending-runtime notices removed.
- [x] Focused validation passes; exact evidence and broader checks not run recorded in Section 12.2.

### 2C — readiness and consumer acceptance checklist

- [x] Nova's Phase 2B approval recorded (D20).
- [x] Running Forge health and Swagger UI respond successfully.
- [x] Live fully resolved `solar-system-get` operation equals the workspace
      contract; its 12 examples and five prediction transport-edge cases validate.
- [x] Live Socket.IO missing-session guard rejects before navigation handling.
- [x] Server process start follows the prediction runtime edits; no restart
      performed by this checkpoint.
- [x] Copy/paste Nova integration handoff and review scenarios supplied (Section 16).
- [x] Nova's existing authenticated session exercises a successful live prediction
      and nested rejections on a supported owned ship; credentials stay local.
      Nova reported validation success (D22).
- [x] Nova verifies separate prediction markers, unchanged direct preview/distance,
      same-response association and stale-response handling (D22).
- [x] Owner accepts the Viewer presentation: "phase 2c is complete and
      successful" (D22).

### 2D — formatting and cleanup checklist

- [x] Read-only review before writing: Prettier difference list, raw-byte
      hash pins, generator byte-exact checks and the contract artifact.
- [x] Owner chose repository-wide formatting, an unchanged contract artifact and
      uncommitted results (D23), with generated/byte-pinned outputs excluded
      through `.prettierignore` (D24).
- [x] Add `.prettierignore` and run `npm run format` (88 files; second pass for
      four non-idempotent member chains).
- [x] Repository format check, tests, lint, typecheck and generator/manifest
      checks recorded in Section 12.4.
- [ ] Owner reviews and commits the uncommitted formatting changes.

### Update rules

1. Change a tracker status only with evidence: an owner quote, an exact command
   and its result, or a commit hash.
2. Record new decisions in Section 3 with date and source. Do not rewrite past
   decisions; add a superseding entry.
3. Keep the checklists consistent with the tracker.
4. Revisit-register items (Section 15) become decisions only with owner approval.
5. Phase 3+ work needs its own approved contract; do not extend this phase.

## 2. Scope and non-goals

In scope (Phase 2):

- At most one explicitly selected planet or moon candidate (existing
  `navigation.candidateBodyId`).
- Using the existing versioned Sol Kepler evaluator
  (`sol-catalog-kepler-position-v1`), return:
  - departure position and epoch;
  - predicted candidate position and encounter epoch;
  - predicted destination position and arrival epoch.
- A required, explicit, player-supplied scenario speed in km/s with no default.
  It is a planning assumption, not ship capability or measured speed.
- Explicit model, basis, time-scale and source provenance, plus typed
  result/failure states.

Non-goals (explicitly excluded):

- ETA or displayed route duration; assist speed change or benefit; physical
  clearance; safe or reachable route claims; validated gravity assist.
- A physically solved trajectory or curve. Nova owns illustrative geometry.
- Candidate ranking, multiple assists, fuel/engine modeling, travel execution.
- Tiered Navigation Computer capabilities, cost comparison (time/fuel) and
  A*-like search. These are recorded future direction only; Phase 2 does not
  design or implement an optimizer.
- Any change to `navigationState`, the paired `navigationEstimate`, the
  standalone `navigation-route-estimate` operation or the existing preview.

## 3. Decision log

| #   | Date       | Decision                                                                                                                                                                                                                                                             | Source                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 2026-11-16 | Opt-in sibling `navigationPrediction` on `solar-system-get`, computed inside the same capture pair as `navigationState`. No separate operation, no revision-token protocol.                                                                                          | Owner form answer: `sibling-solar-system-get`                                                                                                                                                                                                                                                                                                                           |
| D2  | 2026-11-16 | Static minimum scenario speed 120 km/s (inclusive).                                                                                                                                                                                                                  | Owner form answer: `static-120`                                                                                                                                                                                                                                                                                                                                         |
| D3  | 2026-11-16 | Maximum scenario speed 10,000 km/s (inclusive).                                                                                                                                                                                                                      | Owner form answer: `10000`                                                                                                                                                                                                                                                                                                                                              |
| D4  | 2026-11-16 | Maximum prediction horizon: arrival at most 10 Julian years (315,576,000,000 ms) after departure.                                                                                                                                                                    | Owner form answer: `10-julian-years`                                                                                                                                                                                                                                                                                                                                    |
| D5  | 2026-11-16 | Names: request/response sibling `navigationPrediction`; speed field `scenarioCruiseSpeedKmPerSec`.                                                                                                                                                                   | Owner form answer: `navigationPrediction+scenarioCruiseSpeedKmPerSec`                                                                                                                                                                                                                                                                                                   |
| D6  | 2026-11-16 | A candidate equal to the departure or destination host body is allowed.                                                                                                                                                                                              | Owner form answer: `allow`                                                                                                                                                                                                                                                                                                                                              |
| D7  | 2026-11-16 | Time display: declare the uniform POSIX-millisecond game time scale; UTC-style labels are identity labels, not conversions.                                                                                                                                          | Owner form answer: `declare-posix-identity-label`                                                                                                                                                                                                                                                                                                                       |
| D8  | 2026-11-16 | Take the most straightforward time-scale approach now and record a revisit for multi-system and multi-galaxy time (Section 15).                                                                                                                                      | Owner: "I am concerned about my answers related to TT/TDB. It feels like we are going to have to revisit this question when we go to other star systems. It does not seem like there is a galaxy wide time system, and it is possible that we might go to other galaxies. take the most straightforward approach for the moment, noting that we might have to revisit." |
| D9  | 2026-11-16 | Departure epoch is the verified stored ship position epoch (`navigationState.epochMs`). The ship is not propagated; request time is never used.                                                                                                                      | Phase 1 semantics; Forge proposal                                                                                                                                                                                                                                                                                                                                       |
| D10 | 2026-11-16 | Every rejection carries only `status`/`reason`/`message`; no partial positions or epochs are returned.                                                                                                                                                               | Nova prompt; Forge proposal                                                                                                                                                                                                                                                                                                                                             |
| D11 | 2026-11-16 | Apply the contract, schemas, examples, focused contract tests and tracker first, then pause for review. No runtime work is authorized in this step.                                                                                                                  | Owner: "Nova has given provisional approval"; form answer `firstStep=contract-first`                                                                                                                                                                                                                                                                                    |
| D12 | 2026-11-16 | P1: Allow clearly illustrative projected epoch labels, never ETA or duration.                                                                                                                                                                                        | Owner form answer: `Allow clearly illustrative epoch labels; never ETA or duration`                                                                                                                                                                                                                                                                                     |
| D13 | 2026-11-16 | P2: Accept `constant-speed-straight-legs-moving-targets-v1` and `stellar:unix-ms-uniform:v1`.                                                                                                                                                                        | Owner form answer: `Accept proposed identifiers`                                                                                                                                                                                                                                                                                                                        |
| D14 | 2026-11-16 | P3: Keep convergence diagnostics and `arrival.hostPositionKm`.                                                                                                                                                                                                       | Owner form answer: `Keep convergence and arrival.hostPositionKm (recommended)`                                                                                                                                                                                                                                                                                          |
| D15 | 2026-11-16 | P4: Confirm D9: departure uses the verified stored ship epoch; no ship propagation.                                                                                                                                                                                  | Owner form answer: `Use the verified stored ship epoch; no ship propagation (recommended)`                                                                                                                                                                                                                                                                              |
| D16 | 2026-11-16 | P5: Keep `info.version` unchanged for the additive opt-in.                                                                                                                                                                                                           | Owner form answer: `No info.version bump for this additive opt-in (recommended)`                                                                                                                                                                                                                                                                                        |
| D17 | 2026-11-16 | Authorize complete Phase 2B runtime, contract corrections, integration and focused tests; supersedes D11's runtime gate.                                                                                                                                             | Owner form answer: `scope=full-phase2b`, no additional notes                                                                                                                                                                                                                                                                                                            |
| D18 | 2026-11-16 | Defer prediction-only input validation to the handler. Missing candidate/invalid speed retain navigationState; existing selector and estimate validation remains unchanged.                                                                                          | Nova review item 1; owner approval D17                                                                                                                                                                                                                                                                                                                                  |
| D19 | 2026-11-16 | Publish the analytic all-phase chain speed bound, exact station/host composition and authoritative game-time calendar semantics. No architecture/product redesign.                                                                                                   | Nova review items 2–4; owner approval D17                                                                                                                                                                                                                                                                                                                               |
| D20 | 2026-11-16 | Accept Nova's approval of the completed Phase 2B backend and revised contract. This is not yet Viewer visual acceptance.                                                                                                                                             | Owner: "Nova has reviewed your changes ... we are approved and green to start the next step."                                                                                                                                                                                                                                                                           |
| D21 | 2026-11-16 | Perform Phase 2C Forge readiness checks read-only, prepare Nova's handoff and update this tracker. Do not assume live-world writes, credentials, server restart, cleanup or Phase 3 authorization.                                                                   | Owner form answer: `nextStep=phase2c-readiness`, no additional guidance                                                                                                                                                                                                                                                                                                 |
| D22 | 2026-11-16 | Close Phase 2C with Nova's live validation and owner acceptance; start Phase 2D end-of-session cleanup.                                                                                                                                                              | Owner: "Nova reports validation success. phase 2c is complete and successful. lets move forward with phase 2d"                                                                                                                                                                                                                                                          |
| D23 | 2026-11-16 | Phase 2D scope: repository-wide Prettier; leave the stale `contract-artifact.json` unchanged (it predates Phase 1 navigation); leave the results uncommitted for owner review.                                                                                       | Owner form answer: `formatScope=repo-wide`, `artifactRefresh=leave`, `commitMode=uncommitted`                                                                                                                                                                                                                                                                           |
| D24 | 2026-11-16 | Exclude generated and byte-pinned outputs through a new `.prettierignore` (`data/`, `reports/`, the generated naming review, `docs/Stellar notes.md`, the crossmatch calibration JSON) so repository formatting does not break exact-output checks or manifest pins. | Owner form answer: `exclusionApproach=prettierignore-generated`                                                                                                                                                                                                                                                                                                         |

## 4. Contract summary

### Request

```json
{
  "solarSystemId": "sol",
  "navigation": {
    "shipId": "owned-ship-id",
    "destinationMarketId": "sol-pluto-orbit",
    "candidateBodyId": "sol-luna"
  },
  "navigationPrediction": { "scenarioCruiseSpeedKmPerSec": 150 }
}
```

The request rules:

- **Transport:** `navigationPrediction` accepts any JSON value. Its schema has
  no shape, speed, navigation dependency or candidate requirement, intentionally
  allowing errors to reach the handler. Existing `navigation` selector validation
  and the `navigationEstimate` dependency are unchanged.
- **Handler success preconditions:** `navigation` and its `candidateBodyId` are
  required. `scenarioCruiseSpeedKmPerSec` is required and has no default. It must be a
  finite number in the inclusive range [120, 10000] km/s.
- The handler accepts only the speed key in the options object; extra keys or a
  non-object yield nested `NAVIGATION_REQUEST_INVALID`. Missing/invalid speed
  yields `SCENARIO_SPEED_INVALID`; an absent candidate yields `CANDIDATE_REQUIRED`.
  The response success schema retains the strict numeric speed bounds.
- It may be combined with `navigationEstimate`. Each sibling is computed
  independently from the same `navigationState`.

### Response sibling

```json
{
  "navigationPrediction": {
    "success": true,
    "association": "same-response-navigation-sources",
    "prediction": { "status": "supported", "...": "Section 10.2" }
  }
}
```

The response rules:

- Outer system-lookup success does not imply prediction success. Nested success
  requires outer success and a supported, eligible navigationState.
- A supported `prediction` contains the identifiers, provenance, epochs and
  positions listed in Section 10.2. It never contains durations, an ETA, a
  curve, a trajectory, limits or ranking.
- A rejected `prediction` contains only `{ status, reason, message }`.

## 5. Data flow and exact source association

```text
solar-system-get { navigation, navigationPrediction?, navigationEstimate? }
└─ SolarSystemGetMessageHandler.buildResponse
   ├─ pre-validate prediction options (shape, speed, candidate present) — no reads
   └─ buildSystemResponse → getNavigationStateAsync(ctx, player, system, navigation,
                                                   { prediction } | undefined)
      ├─ capture #1 → snapshot (structuredClone of characters, Sol bodies, Sol markets)
      ├─ unchanged gates: selectors, Sol only, ownership, durable lineage, ship revision
      ├─ evaluator(snapshot, T0) → departure check, destination, candidate (unchanged)
      ├─ [opt-in only; state supported so far and previewEligibility eligible]
      │    read-only views of the SAME evaluator at other epochs (fresh cache per epoch)
      │    leg 1: T0 → t1* (candidate)   leg 2: t1* → t2* (destination station)
      │    invariants: dependency ids ⊆ T0 dependency ids; dependencyRevision unchanged
      ├─ capture #2 → revision(snapshot) === revision(after), else SOURCES_CHANGED
      │    (a SOURCES_CHANGED state discards any computed prediction)
      └─ return { bodies, navigationState (byte-identical), predictionResult }
   ├─ navigationEstimate = estimateFromNavigationState(state)   (unchanged)
   └─ navigationPrediction = compose(state, predictionResult, pre-validation)
```

Association guarantees:

1. **One capture pair.** On the supported projection path there are exactly two
   source captures, with or without the opt-in; existing early rejections can
   return before either capture or before capture #2. The prediction runs on the already-captured
   `snapshot` object, so the existing second-capture revision check brackets it.
   There are no additional reads.
2. **Same verified sources.** The prediction evaluates only the candidate chain
   and the destination station and host chain. These are exactly the sources
   that `navigationState` already verified at T0. The views refuse any id
   not already in the T0 `dependencies` map; that would produce
   `PREDICTION_SOURCE_MISMATCH`. Positions come from the same bundled model that
   the verified records were proven to match.
3. **Proof in the response.** `prediction.sourceRevision` must equal
   `navigationState.provenance.sourceRevision`. `departure` must equal
   `navigationState.departure`/`epochMs`. `encounter.bodyId` must equal
   `candidates[0].bodyId`, and `arrival.marketId` must equal
   `destination.marketId`. Composition checks all of these and rejects with
   `PREDICTION_SOURCE_MISMATCH` otherwise.
4. **No mixed epochs.** Each evaluation epoch uses a fresh position cache. The
   existing `computeAbsolutePositionKm` cache is keyed by body id only and must
   never be shared across epochs. Returned positions are re-evaluated freshly at
   the returned integer epochs.
5. **Unchanged siblings.** `navigationState` and `bodies` are built exactly as
   today; the prediction never mutates them and clones every vector it copies.
   `navigationEstimate` is computed from the same `navigationState` exactly as
   today. Prediction failures, including unexpected exceptions, are contained
   inside the prediction step and never alter `navigationState`.

This is a same-response historical association, like `navigationEstimate`. It
is not a live freshness guarantee or a transactional database snapshot.

## 6. Timing algorithm (`constant-speed-straight-legs-moving-targets-v1`)

### 6.1 Definitions and units

- `T0` — `navigationState.epochMs`, integer ms (verified stored ship epoch).
- `v` — `scenarioCruiseSpeedKmPerSec`, in km/s.
- `D` — `navigationState.departure.positionKm`; `C(t)` — candidate body
  center; `S(t)` — destination station position; `S_host(t)` — its host body
  center. All positions are in km in `stellar:sol:catalog-cartesian:v1`.
- Leg timing function, with start epoch `tS` (ms), fixed start point `P` and
  moving target `X(t)`:

  `g(t) = tS + 1000 · |X(t) − P| / v` (ms)

Each leg is a straight line at constant scenario speed **for timing only**. It
is not the drawn path, a flown distance or a trajectory.

### 6.2 Calculation order

1. Validate options and speed; require the candidate (Section 8 precedence).
2. Build `navigationState` exactly as today. Proceed only if it is supported and
   `previewEligibility` is `eligible-with-warnings`.
3. **Convergence precondition for both legs, before any iteration.** For leg 1,
   compute `Vbound` for the candidate's parent chain. For leg 2, compute it for
   the destination host chain plus the station link. Require
   `L = Vbound / v ≤ 0.5`, else return `SCENARIO_SPEED_BELOW_CONVERGENCE_BOUND`.
4. **Leg 1 (encounter):** `tS = T0`, `P = D`, `X = C`. Solve, finalize and
   validate (6.3), giving integer `t1*`.
5. **Leg 2 (arrival):** `tS = t1*`, `P = C(t1*)` (the returned encounter
   position), `X = S`. Solve, finalize and validate, giving integer `t2*`.
6. Check the association invariants (Section 5), then capture #2.

Leg 2 is attempted only if leg 1 succeeded. There is no partial success.

### 6.3 Per-leg solve, finalize and independent validation

- Iterate `t_0 = tS`, `t_k = g(t_{k−1})`:
  - A non-finite `t_k` or position returns `PREDICTION_NUMERIC_INVALID`.
  - Early exit when `t_k − T0 > 2H`, returning `PREDICTION_HORIZON_EXCEEDED`.
  - Stop when `|t_k − t_{k−1}| ≤ 0.1 ms`. `iterations` is the stopping `k`.
  - If there is no stop within 64 iterations, return `ENCOUNTER_NONCONVERGENT`
    (leg 1) or `ARRIVAL_NONCONVERGENT` (leg 2).
- Finalize with `t* = Math.round(t_k)`:
  1. `t* − T0 > H` returns `PREDICTION_HORIZON_EXCEEDED`. H is measured from
     departure for both legs.
  2. `t* ≥ MAX_EPOCH_MS` (2100-01-01T00:00:00.000Z, exclusive) returns
     `PREDICTION_EPOCH_UNSUPPORTED`.
- Evaluate the target freshly at integer `t*`.
- Run an independent residual check: `residualMs = |g(t*) − t*| ≤ 1 ms`.
  Otherwise return `ENCOUNTER_NONCONVERGENT` or `ARRIVAL_NONCONVERGENT`.

Horizon is checked before epoch support so the reason is deterministic. The
early exit fires only when `t* − T0 > H`, so it always agrees with the final
check.

### 6.4 Constants

| Constant                 | Value                                                                |
| ------------------------ | -------------------------------------------------------------------- |
| `MIN_SPEED_KM_PER_SEC`   | 120 (inclusive)                                                      |
| `MAX_SPEED_KM_PER_SEC`   | 10,000 (inclusive)                                                   |
| `MAX_CONTRACTION`        | 0.5                                                                  |
| `STOP_TOLERANCE_MS`      | 0.1                                                                  |
| `RESIDUAL_TOLERANCE_MS`  | 1                                                                    |
| `MAX_ITERATIONS`         | 64 per leg                                                           |
| `H` (prediction horizon) | 315,576,000,000 ms (10 Julian years), departure to arrival           |
| `MAX_EPOCH_MS`           | 4,102,444,800,000 (2100-01-01Z, exclusive; existing evaluator range) |

These limits are pinned to `predictionModelId`. Changing any of them requires a
new model id and a contract review; they are not echoed in responses.

### 6.5 Why it converges, and the guarantees

- **Speed bound, not a sampled estimate.** For one Kepler link the maximum speed is the periapsis speed
  `a · (2π / max(1, |P|)) · sqrt((1 + e) / (1 − e))`. The evaluator's own clamps
  apply: `e ≤ 0.999` for bodies and `e ≤ 0.99` for stations. Absolute positions
  are sums along the parent chain, so `Vbound` (the sum of link bounds) bounds
  `|dX/dt|`.
- **Derivation over all phases.** In the unrotated ellipse,
  `r(E) = (a(cos E - e), a sqrt(1-e²) sin E, 0)`.
  Kepler's equation gives `dE/dt = n/(1-e cos E)`, where `n=2π/period`.
  Thus `|dr/dt|² = (a n)² (1+e cos E)/(1-e cos E)`, maximized at
  `cos E=1` for `0≤e<1`. This gives the periapsis expression above for
  **every epoch**, not only the departure or sampled dates. The catalog angles
  are fixed orthogonal rotations, so they cannot increase the norm. Summing
  parent links uses the triangle inequality, a conservative bound even when
  individual periapses cannot occur simultaneously. `sol-sun` is the fixed
  zero-speed origin. The station uses exactly its verified
  `trajectory.orbit` (not a body-orbit shortcut), with
  `max(1, period)` rather than the body evaluator's `max(1, abs(period))`.
  Existing source gates reject elements outside the supported ranges rather
  than silently using fallback/clamped invalid data.
- **Auditable implementation.** `keplerSpeedBound` and `keplerChainSpeedBound`
  in `src/handlers/context/navigation-prediction-service.js` calculate these
  expressions from the exact versioned catalog/verified station elements.
  `evaluator.predictionTargets` allows only T0 dependencies, with the same
  source revision. A missing, cyclic, custom, invalid, nonfinite or underflowed
  bound returns `EVALUATION_UNSUPPORTED`. Both target bounds are checked before
  either leg; a ratio above 0.5 returns
  `SCENARIO_SPEED_BELOW_CONVERGENCE_BOUND`. The analytic bound is global in
  phase, hence valid over the full ten-year horizon and intermediate iterates.
- **Contraction.** `|g(t) − g(s)| ≤ (1000 / v) · |X(t) − X(s)| ≤ (Vbound / v) · |t − s|`.
  With `L ≤ 0.5`, g is a contraction. It has a **unique** fixed point, so there is
  no earliest-root ambiguity, and iteration from `tS` converges geometrically.
  When the fixed point is within 2H, at most about 44 iterations are needed.
  Reaching the cap of 64 therefore signals a model or numeric invariant
  violation, which is reported as `failed`.
- **Early horizon exit is sound.** `t_k ≤ t* + L^k (t* − tS)` with `tS ≥ T0`
  gives `t_k − T0 ≤ 2 (t* − T0)`.
- **Residual bound.** The a-posteriori error after stopping is at most
  `L / (1 − L) · 0.1 ≤ 0.1 ms`. Rounding adds 0.5 ms, so `|t* − fixed point| ≤ 0.6 ms`
  and `residualMs ≤ (1 + L) · 0.6 ≤ 0.9 ms`, below the 1 ms tolerance.
- **Numerical qualification.** The uniqueness/contraction proof and 0.9 ms
  estimate concern the analytic Kepler model, not an assertion that JavaScript
  floating-point evaluations are exact continuous functions. The existing
  versioned eccentric-anomaly routines remain unchanged. Production checks
  finite values, iteration limits and the freshly evaluated integer-epoch
  residual independently for each leg; no physical accuracy follows from
  convergence. Station iteration uses a numeric-epoch entry point to the same
  orbital math so fractional milliseconds are not truncated through `Date`.
  The legacy timestamp entry point and integer-epoch positions are unchanged.
- **Ordering.** `T0 ≤ t1* ≤ t2*` because `g(t) ≥ tS`.
- **Static minimum.** The largest current bound is 59.141 km/s
  (`sol-mercury-orbit` station chain); the largest planet/moon bound is
  58.976 km/s (`sol-mercury`). With a 120 km/s minimum, every current Sol
  planet/moon candidate and every bundled station has `L ≤ 0.4928`. The runtime
  precondition remains as a guard against future catalog changes.

### 6.5.1 Exact arrival placement

`arrival.hostPositionKm = H(tArrival)` includes the host's entire catalog parent
chain in `stellar:sol:catalog-cartesian:v1`.
For the verified station orbit, solve its Kepler anomaly at **that same epoch**,
form `r(E)` above and rotate by the existing argument-of-periapsis, inclination
and ascending-node matrix. Then:

`arrival.positionKm = H(tArrival) + Rstation * rstation(tArrival)`.

The offset is not frozen at departure and is not expressed in a second local
basis in the response. Do not add a host parent again. `hostPositionKm` is kept
to let Nova show the host center separately from the station arrival.
The evaluator supports existing bundled station trajectories with absent
placement metadata or matching active `body-orbit`/`stellar-orbit` metadata;
other kinds, metadata-only placements, changed anchors or changed orbit
elements remain rejected. Current bundled stations have absent metadata and
body hosts; tests also exercise equivalent active body-orbit metadata.
No new stellar, Lagrange, deep-space or station-keeping model is introduced.

### 6.6 Empirical evidence (scratch prototype, real catalog, no repository changes)

The sweep covered 469 planet/moon candidates × 4 routes (Mars→Pluto,
Pluto→Mars, Mars→Mars, Pluto→Pluto) × 4 departure epochs (2000-01-01,
2026-11-14, 2075-06-01, 2089-01-01):

| Speed       | Runs  | Failures | Max iterations (leg 1 / leg 2) | Max residual | Max departure→arrival | Max L  |
| ----------- | ----- | -------- | ------------------------------ | ------------ | --------------------- | ------ |
| 120 km/s    | 7,504 | 0        | 26 / 18                        | 0.661 ms     | 5.44 years            | 0.4915 |
| 10,000 km/s | 7,504 | 0        | 6 / 5                          | 0.501 ms     | 0.064 years           | —      |

Station bounds (km/s): Mercury 59.141, Venus 35.444, Moon 31.511, Earth 30.533,
Mars 26.686, Jupiter 13.958, Saturn 10.434, Uranus 7.334, Pluto 6.239,
Neptune 5.679. Only Mars and Pluto stations are currently preview-eligible.

Reference example (fixture: ship at the Mars station, epoch
2026-11-14T00:00:00.000Z, candidate `sol-luna`, destination `sol-pluto-orbit`,
150 km/s):

- Encounter: 1795713802170 (2026-11-26T17:23:22.170Z), 16 iterations, residual
  0.133 ms.
- Arrival: 1831977600050 (2028-01-20T10:40:00.050Z), 7 iterations, residual
  0.383 ms.

With the current catalog and speeds of at least 120 km/s, the horizon cannot be
reached: the farthest candidates are Pluto moons at about 49.3 AU, giving a
rough worst case of about 7.8 years. Horizon behavior is therefore tested with
synthetic inputs to the pure solver. `PREDICTION_EPOCH_UNSUPPORTED` is reachable
with a ship epoch near 2099.

### 6.7 Explicitly unsupported in this model

The model does not include:

- acceleration or braking;
- gravity, perturbations or assist effects;
- closest approach, flyby offset or periapsis (the encounter is at the body
  center);
- light-time and relativity;
- ship propagation (departure is frozen at T0);
- multiple candidates;
- comets or custom evaluators;
- non-Sol systems;
- route reachability, safety or clearance.

## 7. Time scale

- **Authoritative scale.** Every `epochMs` is an integer ECMAScript/POSIX time
  value: 86,400,000 ms per day, with leap seconds not represented. The evaluator
  treats it as **uniform game time**:
  - Kepler propagation uses elapsed seconds equal to `Δms / 1000`.
  - Orbital element epochs are ISO-8601 `Z` labels parsed with `Date.parse` into
    the same scale. J2000 is labeled `2000-01-01T12:00:00.000Z` = 946728000000.
- **No conversion.** No UTC, TAI, TT or TDB conversion is applied anywhere.
  Real J2000.0 (TT) is 11:58:55.816 UTC, a 64.184 s offset that is now about
  69.184 s. This shifts positions by at most about 4,100 km for the fastest
  candidate. That is immaterial for an illustrative preview and is consistent
  with Phase 1.
- **Declared id.** The prediction declares `timeScaleId:
"stellar:unix-ms-uniform:v1"`, applying to every epoch in the same response,
  including `navigationState.epochMs`. `navigationState` itself is unchanged.
- **Display.** `new Date(epochMs).toISOString()` is only a readable calendar
  rendering of that same game-time value, **not conversion to physical UTC**.
  A provisional UI label may read
  `2026-11-26T17:23:22.170Z (uniform game time; not physical UTC)`.
  Clients keep and compare the exact integer `epochMs`; they never calculate in
  a converted scale.
- **Revisit.** See Section 15, R1–R5 (owner decision D8).

## 8. Outcomes and precedence

| Status        | Reason                                                                                                                                                                                                                                                               | When                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `invalid`     | `NAVIGATION_REQUEST_INVALID`                                                                                                                                                                                                                                         | The options are not an object or have unknown keys. The navigation selection is missing or invalid (no `navigationState`, or state reason `NAVIGATION_REQUEST_INVALID`). |
| `invalid`     | `SCENARIO_SPEED_INVALID`                                                                                                                                                                                                                                             | The speed is missing, null, not a number, non-finite, below 120 or above 10,000.                                                                                         |
| `invalid`     | `CANDIDATE_REQUIRED`                                                                                                                                                                                                                                                 | The selection is valid but `navigation.candidateBodyId` is absent.                                                                                                       |
| `unsupported` | Mirrored: `SYSTEM_UNSUPPORTED`, `SYSTEM_MISMATCH`, `SHIP_NOT_OWNED`, `BASIS_UNKNOWN`, `POSITION_EPOCH_UNSUPPORTED`, `POSITION_INVALID`, `EVALUATION_UNSUPPORTED`, `SOURCE_UNVERIFIED`, `STATION_HOST_UNVERIFIED`, `STATION_PLACEMENT_UNSUPPORTED`, `SOURCES_CHANGED` | `navigationState` is unsupported. This covers missing or unsupported Kepler data or bodies, changed sources and unsupported departure epochs.                            |
| `unsupported` | `SCENARIO_SPEED_BELOW_CONVERGENCE_BOUND`                                                                                                                                                                                                                             | `Vbound / v > 0.5` for either leg (precondition).                                                                                                                        |
| `unsupported` | `PREDICTION_HORIZON_EXCEEDED`                                                                                                                                                                                                                                        | Arrival or encounter is more than H after departure.                                                                                                                     |
| `unsupported` | `PREDICTION_EPOCH_UNSUPPORTED`                                                                                                                                                                                                                                       | A predicted epoch is at or after 2100-01-01Z.                                                                                                                            |
| `ineligible`  | `KNOWN_INVALID_SOURCE`, `KNOWN_INVALID_DESTINATION`                                                                                                                                                                                                                  | `previewEligibility` is ineligible. The solver is not run.                                                                                                               |
| `failed`      | `NAVIGATION_READ_FAILED`                                                                                                                                                                                                                                             | Source read failure (outer `success: false`).                                                                                                                            |
| `failed`      | `ENCOUNTER_NONCONVERGENT`, `ARRIVAL_NONCONVERGENT`                                                                                                                                                                                                                   | The iteration cap was reached or the residual is above 1 ms for that leg.                                                                                                |
| `failed`      | `PREDICTION_NUMERIC_INVALID`                                                                                                                                                                                                                                         | A non-finite epoch or position occurred during prediction.                                                                                                               |
| `failed`      | `PREDICTION_SOURCE_MISMATCH`                                                                                                                                                                                                                                         | An association invariant was violated (Section 5).                                                                                                                       |
| `failed`      | `PREDICTION_EVALUATION_FAILED`                                                                                                                                                                                                                                       | An unexpected exception in the prediction step. It is contained and logged; `navigationState` is unaffected.                                                             |

Precedence (the first match wins):

1. Options shape (`NAVIGATION_REQUEST_INVALID`).
2. Speed (`SCENARIO_SPEED_INVALID`).
3. Selection, meaning no state or state reason `NAVIGATION_REQUEST_INVALID`
   (`NAVIGATION_REQUEST_INVALID`).
4. Candidate absent (`CANDIDATE_REQUIRED`).
5. Mirrored unsupported or read-failed state.
6. Ineligible.
7. Speed-bound precondition.
8. Leg 1 outcomes.
9. Leg 2 outcomes.
10. Association invariants.

An unexpected exception at any prediction step maps to
`PREDICTION_EVALUATION_FAILED`. The solver runs only when 1–6 pass.

Additional behavior:

- When `navigation` is missing and only `navigationPrediction` is supplied, the
  outer response is `success: false` with the message
  `navigationPrediction requires navigation`. When `navigationEstimate` is also
  present, the existing message `navigationEstimate requires navigation` is kept
  unchanged.
- An invalid speed, a missing candidate, and every prediction-only outcome
  reject only `navigationPrediction`. An otherwise supported `navigationState`
  and `navigationEstimate` are returned unchanged.

## 9. Gates (unchanged, not weakened)

All existing gates apply unchanged:

- ship ownership by the authenticated player and character;
- durable backend-issued persisted lineage (runtime proofs remain test-only);
- the ship revision check;
- Sol only;
- integer position epochs in [2000, 2100);
- source verification against the bundled model within 0.001 km;
- exact verified station anchors and supported placements;
- a planet or moon candidate only;
- the second-capture `SOURCES_CHANGED` check;
- `previewEligibility`.

Ineligible routes block the prediction. `eligible-with-warnings` remains
`CLEARANCE_UNVERIFIED` and is echoed as the prediction warning. The navigation
branch, including any opt-in, never seeds or refreshes presence.

## 10. Historical first-pass OpenAPI and schema diff

**Archived review draft, not the current contract.** This section records the
2B.1 proposal. D18 supersedes its strict prediction request schema/dependencies,
and D19 clarifies the bound, placement and time descriptions. Current authority:
[root OpenAPI](../api/openapi.yaml), [solarsystem OpenAPI](../api/openapi/solarsystem/openapi.yaml),
[transport options](../api/schemas/navigation-prediction-options.schema.json),
[paired result](../api/schemas/navigation-paired-prediction.schema.json) and
[request](../api/schemas/solar-system-get-request.schema.json).
Do not copy this historical draft over the implemented files.

Applied in step 2B.1 after provisional approval. The live OpenAPI descriptions
also state that runtime implementation is pending. Conditional schema nodes
include explicit object/array types to avoid adding AJV strict-type warnings;
these repeat types already enforced by the referenced schemas and do not change
the approved accepted payloads. Runtime invariants remain future work.

### 10.1 New `api/schemas/navigation-prediction-options.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NavigationPredictionOptions",
  "description": "Opt-in Phase 2 illustrative prediction on solar-system-get. Requires navigation with candidateBodyId. Calculated from the exact source records used for navigationState in the same response; no caller epoch, endpoint, token or additional candidate. Invalid options reject only navigationPrediction, never an otherwise supported navigationState.",
  "type": "object",
  "additionalProperties": false,
  "required": ["scenarioCruiseSpeedKmPerSec"],
  "properties": {
    "scenarioCruiseSpeedKmPerSec": {
      "type": "number",
      "minimum": 120,
      "maximum": 10000,
      "description": "Required player-supplied planning assumption in km/s with no default. Not ship capability, engine performance or measured speed. Finite, inclusive [120, 10000]; the minimum keeps every supported Sol leg a proven timing contraction."
    }
  }
}
```

### 10.2 New `api/schemas/navigation-paired-prediction.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NavigationPairedPrediction",
  "description": "Opt-in Phase 2 illustrative prediction bound exclusively to the navigationState returned in this same response: same captured source records, basis, evaluation model and departure epoch, proven by equal sourceRevision. Nested success is independent of outer system-lookup success. Rejections carry no positions or epochs. Never an ETA, duration, trajectory, clearance, reachability or gravity-assist result.",
  "type": "object",
  "additionalProperties": false,
  "required": ["success", "association", "prediction"],
  "properties": {
    "success": { "type": "boolean" },
    "association": { "const": "same-response-navigation-sources" },
    "prediction": {}
  },
  "allOf": [
    {
      "if": { "properties": { "success": { "const": true } } },
      "then": { "properties": { "prediction": { "$ref": "#/definitions/supported" } } },
      "else": {
        "properties": {
          "prediction": {
            "oneOf": [
              { "$ref": "#/definitions/invalid" },
              { "$ref": "#/definitions/unsupported" },
              { "$ref": "#/definitions/ineligible" },
              { "$ref": "#/definitions/failed" }
            ]
          }
        }
      }
    }
  ],
  "definitions": {
    "epochMs": {
      "type": "integer",
      "minimum": 946684800000,
      "maximum": 4102444799999,
      "description": "Exact integer milliseconds in timeScaleId; authoritative. Display labels are derived from this value, never the reverse."
    },
    "convergence": {
      "type": "object",
      "additionalProperties": false,
      "required": ["iterations", "residualMs"],
      "description": "Diagnostic only; not accuracy, uncertainty or confidence.",
      "properties": {
        "iterations": { "type": "integer", "minimum": 1, "maximum": 64 },
        "residualMs": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Absolute leg timing residual |g(epochMs) - epochMs| re-evaluated at the returned integer epoch."
        }
      }
    },
    "supported": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "solarSystemId",
        "coordinateBasisId",
        "positionEvaluationModelId",
        "predictionModelId",
        "timeScaleId",
        "sourceRevision",
        "classification",
        "scenarioCruiseSpeedKmPerSec",
        "speedProvenance",
        "departure",
        "encounter",
        "arrival",
        "assumptions",
        "warnings"
      ],
      "properties": {
        "status": { "const": "supported" },
        "solarSystemId": { "const": "sol" },
        "coordinateBasisId": {
          "const": "stellar:sol:catalog-cartesian:v1",
          "description": "Same numeric game basis as navigationState; not a physical inertial/barycentric guarantee."
        },
        "positionEvaluationModelId": { "const": "sol-catalog-kepler-position-v1" },
        "predictionModelId": {
          "const": "constant-speed-straight-legs-moving-targets-v1",
          "description": "Each leg epoch is the unique fixed point t = tStart + 1000 * |X(t) - P| / v of a straight-line, constant scenario-speed timing leg from fixed start point P to moving target X evaluated by positionEvaluationModelId. Leg 1: departure to candidate body center. Leg 2: candidate center at the encounter epoch to the destination station. Limits (speed [120, 10000] km/s, contraction <= 0.5, 64 iterations, 0.1 ms stop, 1 ms residual, 10 Julian-year horizon, epochs before 2100) are pinned to this id. Not a physical trajectory or drawn path."
        },
        "timeScaleId": {
          "const": "stellar:unix-ms-uniform:v1",
          "description": "Applies to every epochMs in this response, including navigationState.epochMs: integer ECMAScript/POSIX milliseconds treated as uniform game time (86,400,000 ms per day; leap seconds not represented). Kepler propagation uses elapsed seconds = delta ms / 1000; element epochs are ISO-8601 Z labels in the same scale. No UTC/TAI/TT/TDB conversion. new Date(epochMs).toISOString() is an identity display label, not a conversion."
        },
        "sourceRevision": {
          "$ref": "./navigation-state-response.schema.json#/definitions/revision",
          "description": "Equals navigationState.provenance.sourceRevision in this same response."
        },
        "classification": { "const": "illustrative-not-eta" },
        "scenarioCruiseSpeedKmPerSec": {
          "$ref": "./navigation-prediction-options.schema.json#/properties/scenarioCruiseSpeedKmPerSec"
        },
        "speedProvenance": { "const": "caller-supplied-scenario" },
        "departure": {
          "type": "object",
          "additionalProperties": false,
          "required": ["shipId", "epochMs", "positionKm"],
          "description": "Exact copy of navigationState departure.shipId, epochMs and departure.positionKm. The ship is not propagated.",
          "properties": {
            "shipId": { "type": "string", "pattern": "\\S" },
            "epochMs": { "$ref": "#/definitions/epochMs" },
            "positionKm": { "$ref": "./spatial-state.schema.json#/definitions/vector3" }
          }
        },
        "encounter": {
          "type": "object",
          "additionalProperties": false,
          "required": ["bodyId", "epochMs", "positionKm", "convergence"],
          "description": "Candidate body center at the illustrative encounter epoch (>= departure.epochMs). Not a flyby point, closest approach, periapsis or clearance-checked position.",
          "properties": {
            "bodyId": { "type": "string", "pattern": "\\S" },
            "epochMs": { "$ref": "#/definitions/epochMs" },
            "positionKm": { "$ref": "./spatial-state.schema.json#/definitions/vector3" },
            "convergence": { "$ref": "#/definitions/convergence" }
          }
        },
        "arrival": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "marketId",
            "hostBodyId",
            "epochMs",
            "positionKm",
            "hostPositionKm",
            "convergence"
          ],
          "description": "Destination station and its host body center at the illustrative arrival epoch (>= encounter.epochMs, <= departure.epochMs + 315576000000). Not an ETA.",
          "properties": {
            "marketId": { "type": "string", "pattern": "\\S" },
            "hostBodyId": { "type": "string", "pattern": "\\S" },
            "epochMs": { "$ref": "#/definitions/epochMs" },
            "positionKm": { "$ref": "./spatial-state.schema.json#/definitions/vector3" },
            "hostPositionKm": { "$ref": "./spatial-state.schema.json#/definitions/vector3" },
            "convergence": { "$ref": "#/definitions/convergence" }
          }
        },
        "assumptions": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "legDistanceStraightLine",
            "constantScenarioSpeed",
            "accelerationBrakingOmitted",
            "gravityAndAssistEffectsOmitted",
            "departureFixedAtNavigationEpoch",
            "encounterAtBodyCenter"
          ],
          "properties": {
            "legDistanceStraightLine": { "const": true },
            "constantScenarioSpeed": { "const": true },
            "accelerationBrakingOmitted": { "const": true },
            "gravityAndAssistEffectsOmitted": { "const": true },
            "departureFixedAtNavigationEpoch": { "const": true },
            "encounterAtBodyCenter": { "const": true }
          }
        },
        "warnings": { "const": ["CLEARANCE_UNVERIFIED"] }
      }
    },
    "invalid": {
      "type": "object",
      "additionalProperties": false,
      "required": ["status", "reason", "message"],
      "properties": {
        "status": { "const": "invalid" },
        "reason": {
          "enum": ["NAVIGATION_REQUEST_INVALID", "SCENARIO_SPEED_INVALID", "CANDIDATE_REQUIRED"]
        },
        "message": { "type": "string" }
      }
    },
    "unsupported": {
      "type": "object",
      "additionalProperties": false,
      "required": ["status", "reason", "message"],
      "properties": {
        "status": { "const": "unsupported" },
        "reason": {
          "enum": [
            "SYSTEM_UNSUPPORTED",
            "SYSTEM_MISMATCH",
            "SHIP_NOT_OWNED",
            "BASIS_UNKNOWN",
            "POSITION_EPOCH_UNSUPPORTED",
            "POSITION_INVALID",
            "EVALUATION_UNSUPPORTED",
            "SOURCE_UNVERIFIED",
            "STATION_HOST_UNVERIFIED",
            "STATION_PLACEMENT_UNSUPPORTED",
            "SOURCES_CHANGED",
            "SCENARIO_SPEED_BELOW_CONVERGENCE_BOUND",
            "PREDICTION_HORIZON_EXCEEDED",
            "PREDICTION_EPOCH_UNSUPPORTED"
          ]
        },
        "message": { "type": "string" }
      }
    },
    "ineligible": {
      "type": "object",
      "additionalProperties": false,
      "required": ["status", "reason", "message"],
      "properties": {
        "status": { "const": "ineligible" },
        "reason": { "enum": ["KNOWN_INVALID_SOURCE", "KNOWN_INVALID_DESTINATION"] },
        "message": { "type": "string" }
      }
    },
    "failed": {
      "type": "object",
      "additionalProperties": false,
      "required": ["status", "reason", "message"],
      "properties": {
        "status": { "const": "failed" },
        "reason": {
          "enum": [
            "NAVIGATION_READ_FAILED",
            "ENCOUNTER_NONCONVERGENT",
            "ARRIVAL_NONCONVERGENT",
            "PREDICTION_NUMERIC_INVALID",
            "PREDICTION_SOURCE_MISMATCH",
            "PREDICTION_EVALUATION_FAILED"
          ]
        },
        "message": { "type": "string" }
      }
    }
  }
}
```

Cross-field rules that JSON Schema draft-07 cannot express are runtime
invariants and are covered by tests:

- `T0 ≤ encounter.epochMs ≤ arrival.epochMs`.
- `arrival.epochMs − T0 ≤ H`.
- Equality with `navigationState`: departure, `bodyId`, `marketId`, `hostBodyId`
  and `sourceRevision`.

### 10.3 `api/schemas/solar-system-get-request.schema.json`

```diff
     "navigation": { "$ref": "./navigation-state-request.schema.json" },
     "navigationEstimate": { "$ref": "./navigation-estimate-options.schema.json" },
+    "navigationPrediction": { "$ref": "./navigation-prediction-options.schema.json" },
     "asOf": { "type": "string", "format": "date-time", "description": "..." },
     "requestId": { "type": "string" }
   },
-  "dependencies": { "navigationEstimate": ["navigation"] }
+  "dependencies": {
+    "navigationEstimate": ["navigation"],
+    "navigationPrediction": ["navigation"]
+  },
+  "allOf": [
+    {
+      "if": { "required": ["navigationPrediction"] },
+      "then": {
+        "properties": { "navigation": { "type": "object", "required": ["candidateBodyId"] } }
+      }
+    }
+  ]
 }
```

### 10.4 `api/schemas/solar-system-get-response.schema.json`

```diff
     "navigationState": { "$ref": "./navigation-state-response.schema.json" },
     "navigationEstimate": { "$ref": "./navigation-paired-estimate.schema.json" },
+    "navigationPrediction": { "$ref": "./navigation-paired-prediction.schema.json" },
 ...
   "allOf": [
     { "if": { "required": ["navigationEstimate"], "...": "unchanged" } },
+    {
+      "if": {
+        "required": ["navigationPrediction"],
+        "properties": {
+          "navigationPrediction": {
+            "type": "object",
+            "required": ["success"],
+            "properties": { "success": { "const": true } }
+          }
+        }
+      },
+      "then": {
+        "required": ["navigationState"],
+        "properties": {
+          "success": { "const": true },
+          "navigationState": {
+            "type": "object",
+            "properties": {
+              "status": { "const": "supported" },
+              "previewEligibility": {
+                "type": "object",
+                "properties": { "status": { "const": "eligible-with-warnings" } }
+              },
+              "candidates": { "type": "array", "minItems": 1 }
+            }
+          }
+        }
+      }
+    }
   ]
```

### 10.5 `api/openapi/solarsystem/openapi.yaml` — description paragraph

Insert this after the `navigationEstimate` paragraph ("... No new candidate
planning or UI is included."):

```yaml
        Optional sibling navigationPrediction (Phase 2) requires navigation with
        candidateBodyId and a required scenarioCruiseSpeedKmPerSec in [120, 10000]
        km/s: a player planning assumption with no default, never ship capability.
        The response sibling contains success, association:
        same-response-navigation-sources, and prediction. It is computed inside the
        same source capture pair as navigationState from the same verified records,
        with no additional read; sourceRevision equals the navigationState
        provenance sourceRevision. Departure is the exact navigationState departure
        at epochMs; the ship is never propagated. Encounter (candidate body center)
        and arrival (destination station) epochs are unique fixed points of
        constant-speed straight-leg timing against Kepler-moving targets, model
        constant-speed-straight-legs-moving-targets-v1, solved sequentially and
        validated independently. Positions are evaluated at the returned integer
        epochs. Epochs use timeScaleId stellar:unix-ms-uniform:v1: uniform POSIX
        milliseconds without leap seconds or TT/TDB conversion; ISO labels are
        identity labels. Arrival must be within 10 Julian years of departure and
        before 2100. Supported predictions require supported eligible projections.
        Invalid options, a missing candidate, and horizon, epoch, convergence or
        numeric outcomes reject only the prediction and leave navigationState and
        navigationEstimate unchanged. Rejections carry status/reason/message only,
        never partial positions or epochs. classification illustrative-not-eta:
        no ETA, duration, trajectory, clearance, assist benefit, reachability,
        ranking, fuel or travel execution. Legs are straight only for timing; Nova
        owns drawn geometry. Omitting the opt-in preserves existing responses.
```

Append this response note:

```yaml
- navigationPrediction success is independent of outer success; inspect prediction.status.
```

### 10.6 `api/openapi/solarsystem/openapi.yaml` — examples

The examples add one request and two responses, so the module example count goes
from 13 to 16. The values come from the real fixture run (Section 6.6), with
provenance shown as `trusted-persisted-placement`. During implementation, the
values will be regenerated from the implemented solver.

Request (after `pairedDirectBaseline`):

```yaml
pairedPrediction:
  summary: Illustrative single-candidate prediction at an explicit scenario speed
  value:
    playerName: PilotOne
    sessionKey: session-123
    correlationId: 36ea198f-0df8-4fa9-82b3-7bdfe0d9fd66
    requestIdentity:
      operation: solar-system-get
      entityType: solar-system
      containerId: sol
    solarSystemId: sol
    navigation:
      shipId: owned-ship-id
      destinationMarketId: sol-pluto-orbit
      candidateBodyId: sol-luna
    navigationPrediction:
      scenarioCruiseSpeedKmPerSec: 150
```

Responses (after `failedSolarSystemGet`). The celestial arrays are omitted for
brevity, which the schema permits, and the summary says so:

```yaml
pairedPredictionSupported:
  summary: Supported illustrative prediction paired with its navigationState (stars/bodies omitted)
  value:
    success: true
    message: Solar system navigation positions evaluated
    playerName: PilotOne
    correlationId: 36ea198f-0df8-4fa9-82b3-7bdfe0d9fd66
    requestIdentity:
      operation: solar-system-get
      entityType: solar-system
      containerId: sol
    solarSystemId: sol
    navigationState: &pairedPredictionState
      status: supported
      solarSystemId: sol
      coordinateBasisId: stellar:sol:catalog-cartesian:v1
      epochMs: 1794614400000
      departure:
        shipId: owned-ship-id
        positionKm: { x: -68497108.89898615, y: 230490599.55439094, z: 6513204.619689254 }
        provenance:
          kind: trusted-persisted-placement
          lineageId: f08d2910-b9d0-4aea-a749-a9f1cd1015d0
          sourceMarketId: sol-mars-orbit
          offsetKm: { x: 0, y: 0, z: 0 }
          shipRevision: c226ceb9d805b260146979f9562abb5802f98943558b8c973055e1f4af9dad2a
      destination:
        marketId: sol-pluto-orbit
        hostBodyId: sol-pluto
        positionKm: { x: 2974293648.201258, y: -4397750958.234561, z: -390278339.2324666 }
        hostPositionKm: { x: 2974292253.685408, y: -4397752426.080326, z: -390278377.66936064 }
        hostSourceEpochMs: 1776384000000
        orbitalReferenceEpoch: '2026-01-01T00:00:00.000Z'
        placementKind: null
        association: verified-exact-anchor
      candidates:
        - bodyId: sol-luna
          positionKm: { x: 92713269.03814426, y: 115056805.05196837, z: 14921.888450147251 }
          sourceEpochMs: 1776384000000
      provenance:
        evaluationModelId: sol-catalog-kepler-position-v1
        sourceRevision: d41b0b0f05177509ea34d3533b81dca5f63c1d95c230a5e632a24bb8dac9e9b2
        positionToleranceKm: 0.001
      previewEligibility: { status: eligible-with-warnings, reason: CLEARANCE_UNVERIFIED }
      motion: { status: unsupported }
      clearance: { status: unsupported }
      gravityAssist: { status: unsupported }
    navigationPrediction:
      success: true
      association: same-response-navigation-sources
      prediction:
        status: supported
        solarSystemId: sol
        coordinateBasisId: stellar:sol:catalog-cartesian:v1
        positionEvaluationModelId: sol-catalog-kepler-position-v1
        predictionModelId: constant-speed-straight-legs-moving-targets-v1
        timeScaleId: stellar:unix-ms-uniform:v1
        sourceRevision: d41b0b0f05177509ea34d3533b81dca5f63c1d95c230a5e632a24bb8dac9e9b2
        classification: illustrative-not-eta
        scenarioCruiseSpeedKmPerSec: 150
        speedProvenance: caller-supplied-scenario
        departure:
          shipId: owned-ship-id
          epochMs: 1794614400000
          positionKm: { x: -68497108.89898615, y: 230490599.55439094, z: 6513204.619689254 }
        encounter:
          bodyId: sol-luna
          epochMs: 1795713802170
          positionKm: { x: 64474291.511722974, y: 133169650.84930696, z: -17879.967533573898 }
          convergence: { iterations: 16, residualMs: 0.133056640625 }
        arrival:
          marketId: sol-pluto-orbit
          hostBodyId: sol-pluto
          epochMs: 1831977600050
          positionKm: { x: 3146423889.109306, y: -4326655970.758481, z: -447745954.4471171 }
          hostPositionKm: { x: 3146424514.4662237, y: -4326653939.490068, z: -447745901.25648177 }
          convergence: { iterations: 7, residualMs: 0.3828125 }
        assumptions:
          legDistanceStraightLine: true
          constantScenarioSpeed: true
          accelerationBrakingOmitted: true
          gravityAndAssistEffectsOmitted: true
          departureFixedAtNavigationEpoch: true
          encounterAtBodyCenter: true
        warnings: [CLEARANCE_UNVERIFIED]
pairedPredictionSpeedRejected:
  summary: Invalid scenario speed rejects only the prediction; navigationState is unchanged
  value:
    success: true
    message: Solar system navigation positions evaluated
    playerName: PilotOne
    correlationId: 36ea198f-0df8-4fa9-82b3-7bdfe0d9fd66
    requestIdentity:
      operation: solar-system-get
      entityType: solar-system
      containerId: sol
    solarSystemId: sol
    navigationState: *pairedPredictionState
    navigationPrediction:
      success: false
      association: same-response-navigation-sources
      prediction:
        status: invalid
        reason: SCENARIO_SPEED_INVALID
        message: scenarioCruiseSpeedKmPerSec is required and must be a finite number in [120, 10000] km/s
```

### 10.7 `api/openapi.yaml` — root navigation note

Insert this after the `navigationEstimate` paragraph (it ends with "candidate/curve
length is never measured."):

```yaml
    Phase 2 illustrative prediction: solar-system-get may also opt in with
    navigationPrediction and a required player scenarioCruiseSpeedKmPerSec in
    [120, 10000] km/s alongside navigation with one candidateBodyId. Inside the
    same source capture pair as navigationState, it returns departure, candidate
    encounter and destination arrival positions at integer epochs found by bounded
    constant-speed straight-leg fixed points against Kepler-moving targets, with
    association same-response-navigation-sources and equal sourceRevision. Epochs
    use the uniform POSIX-millisecond game time scale without TT/TDB or leap-second
    conversion. Results are illustrative-not-eta: no ETA, duration, trajectory,
    clearance, assist benefit, ranking, fuel or travel execution. Every failure is
    an explicit typed rejection without partial positions or epochs.
    navigationState and navigationEstimate are unchanged with or without it.
```

There is no `info.version` bump. This is additive and opt-in, consistent with
the earlier navigation additions, and the 4.0.0 alignment test is unchanged.

## 11. Test plan (`test/navigation-prediction.test.js` unless noted)

Compatibility and association:

1. Without the opt-in, the following are deep-equal and JSON-identical to
   current behavior: navigation only; navigation plus `navigationEstimate`; no
   navigation.
2. With the opt-in, `navigationState` and `bodies` are JSON-identical to the same
   request without it. With both siblings, `navigationEstimate` is identical to
   an estimate-only request.
3. With the opt-in, alone or with the estimate, there are exactly two
   `getCelestialBodies` captures.
4. A supported prediction validates against the dereferenced response schema.
   The following equal their `navigationState` values: `sourceRevision`,
   `departure`, `encounter.bodyId` (`candidates[0].bodyId`), and
   `arrival.marketId`/`hostBodyId`.
5. Returned positions exactly equal independent fresh evaluations
   (`computeAbsolutePositionKm` and `computeRelativeOrbitPositionKm`) at the
   returned integer epochs.
6. Independently recomputed leg residuals are ≤ 1 ms. Epochs are integers, with
   `T0 ≤ t1* ≤ t2*`, `t2* − T0 ≤ H` and `t2* < MAX_EPOCH_MS`.
7. A candidate equal to the departure host (`sol-mars`) or the destination host
   (`sol-pluto`) is supported.
8. The same request twice gives deep-equal predictions (determinism).

Options and request outcomes (each also asserts that `navigationState` is
supported and unchanged):

9. Speeds 120 and 10000 are supported.
10. `SCENARIO_SPEED_INVALID` for 119.999, 10000.001, 0, −1, null, `'150'`, and a
    missing key (`{}`).
11. `NAVIGATION_REQUEST_INVALID` for an extra key and for non-object options
    (null, `[]`, 150).
12. `CANDIDATE_REQUIRED` when `candidateBodyId` is absent.
13. Missing `navigation` gives outer `success: false` with
    `navigationPrediction requires navigation`, a nested
    `NAVIGATION_REQUEST_INVALID`, no seeding and no presence refresh. Invalid
    selectors give `NAVIGATION_REQUEST_INVALID`.

Mirrored world outcomes:

14. Legacy ship → `BASIS_UNKNOWN`; non-Sol → `SYSTEM_UNSUPPORTED`; unsupported
    candidate → `EVALUATION_UNSUPPORTED`.
15. Destination `sol-earth-orbit` → `ineligible`/`KNOWN_INVALID_DESTINATION`;
    the solver is not invoked.
16. A changed second read (`updatedAt` mutation) → `unsupported`/`SOURCES_CHANGED`
    with no positions.
17. A read failure → outer `success: false`, `failed`/`NAVIGATION_READ_FAILED`.
18. A ship epoch near 2099-12 → `PREDICTION_EPOCH_UNSUPPORTED`.

Pure solver and composition (synthetic inputs):

19. Horizon exceeded via the early exit (a receding target), and via the final
    check.
20. Iteration cap: a dishonest bound forces nonconvergence →
    `ENCOUNTER_NONCONVERGENT` or `ARRIVAL_NONCONVERGENT` by leg.
21. Residual failure: a target that differs at integer epochs → nonconvergent
    for that leg.
22. A NaN position → `PREDICTION_NUMERIC_INVALID`.
23. Bound above 0.5 → `SCENARIO_SPEED_BELOW_CONVERGENCE_BOUND`, with zero
    position evaluations. Both legs are checked before leg 1 iterates.
24. A `sourceRevision` or departure mismatch in composition →
    `PREDICTION_SOURCE_MISMATCH`.
25. A throwing evaluation → `PREDICTION_EVALUATION_FAILED`, logged, with
    `navigationState` unaffected.
26. Catalog guard: the maximum bound over planet/moon candidates and bundled
    stations is ≤ 60 km/s, so the 120 km/s minimum keeps `L ≤ 0.5`.

Handler, socket and contract:

27. `handle()` does not call `refreshCharacterPresence` when
    `navigationPrediction` is present, with or without `navigation`.
28. A socket round trip through the registry with the opt-in.
29. `test/celestial-operation-examples.test.js`: the solarsystem count is 19 and
    every example validates.
30. `test/navigation-purchase.mongo.integration.test.js`: a paired prediction for
    a real persisted-lineage purchase, against in-memory MongoDB.
31. The existing standalone and paired estimate tests and the Phase 1 position
    contract tests pass unchanged.

## 12. Validation commands and expected results

Node ≥ 24 is required.

| Command                                                                                                                                                                                                                   | Expected result                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `node --test test/navigation-prediction.test.js`                                                                                                                                                                          | All new tests pass                                                                                             |
| `node --test test/navigation-prediction.test.js test/navigation-route-estimate.test.js test/navigation-position-contract.test.js test/solar-system-get-message-handler.test.js test/celestial-operation-examples.test.js` | All pass; the solarsystem diagnostic reports `19 examples validated`                                           |
| `node --test test/navigation-purchase.mongo.integration.test.js`                                                                                                                                                          | Passes (in-memory MongoDB)                                                                                     |
| `npx --yes @apidevtools/swagger-cli validate api/openapi.yaml`                                                                                                                                                            | `api/openapi.yaml is valid`                                                                                    |
| `npm run typecheck`                                                                                                                                                                                                       | Exit 0                                                                                                         |
| `npm run lint`                                                                                                                                                                                                            | 0 errors (ESLint only; Prettier is not part of it)                                                             |
| `npm test`                                                                                                                                                                                                                | Full suite passes                                                                                              |
| `npm run contract:artifact`, then `npm run contract:gate:hard`                                                                                                                                                            | `totalIssues: 0`, exit 0. The path/socket set is unchanged and only additive optional schema members are added |

`contract:artifact` and the gate invoke Prettier internally and rewrite tracked
files under `api/artifacts/contracts/`. Do not run these CLIs while formatting is
deferred. Use their exported calculation functions without writes instead (12.1).
If regeneration is later authorized, preserve any pre-existing artifact changes;
do not discard the entire directory's changes as cleanup.

### 12.1 Step 2B.1 validation evidence (2026-11-16)

This checkpoint validates the contract, not runtime prediction. The six new
tests cover speed boundaries and no default/coercion, navigation/candidate
dependencies, eligible paired success, complete results, integer epochs and
per-leg convergence limits, typed failures without partial predictions, and the
example's source/endpoint association. The existing navigation tests exercise
unchanged Phase 1 and direct-distance behavior.

| Exact command                                                                                                                                                                                                             | Observed result                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `node --test test\navigation-prediction.test.js test\navigation-route-estimate.test.js test\navigation-position-contract.test.js test\solar-system-get-message-handler.test.js test\celestial-operation-examples.test.js` | 39 passed, 0 failed; solarsystem: `16 examples validated`           |
| `npx --yes @apidevtools/swagger-cli validate api\openapi.yaml`                                                                                                                                                            | `api\openapi.yaml is valid`, exit 0                                 |
| `npx --no-install eslint test\navigation-prediction.test.js test\celestial-operation-examples.test.js`                                                                                                                    | Exit 0, no errors or warnings                                       |
| `npm run typecheck`                                                                                                                                                                                                       | Exit 0                                                              |
| `git --no-pager diff --check`                                                                                                                                                                                             | Exit 0; Git notes existing CRLF normalization on the request schema |
| `node -` with the stdin script below                                                                                                                                                                                      | `totalIssues: 0`; assertion passed; no artifact writes or Prettier  |

```js
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { buildArtifact } = require(path.resolve('scripts', 'sw08', 'generate-contract-artifact.js'));
const { analyzeDrift } = require(path.resolve('scripts', 'sw08', 'check-contract-drift.js'));
const baseline = JSON.parse(
  fs.readFileSync(
    path.resolve('api', 'artifacts', 'contracts', 'baseline-contract-artifact.json'),
    'utf8'
  )
);
const report = analyzeDrift(baseline, buildArtifact(process.cwd()));
console.log(JSON.stringify(report.summary, null, 2));
assert.equal(report.summary.totalIssues, 0, JSON.stringify(report.issues));
```

The in-memory check uses the existing drift analyzer with an explicit zero-issue
assertion; it is not a run of the CLI's enforcement/report-writing path. Existing
direct-estimate schemas still emit AJV strict-type warnings; the new conditional
nodes do not. The first test run caught a malformed response-schema insertion,
which was corrected before the passing run. The initial unscoped
`npx --no-install swagger-cli` command was unavailable; the documented scoped
package command above succeeded.

Not run in this contract-only step: full `npm test`, whole-repository lint, MongoDB
purchase integration, or runtime solver/handler tests. These remain in the
runtime implementation gate. No production source, server process, world data,
generated contract artifact or contract version was changed. No Prettier ran.

### 12.2 Complete Phase 2B validation and Nova review resolutions (2026-11-16)

The owner approved `scope=full-phase2b`. This step implements runtime prediction,
not only the contract. No operation/event name, contract version, existing
eligibility gate or agreed product scope changed.

| Nova item                                    | Resolution and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Request validation versus nested failures | `navigation-prediction-options.schema.json` is intentionally transport-unconstrained; the request's prediction dependency/candidate requirement is removed. Handler shape/speed/candidate checks return typed nested failures. Strict speed bounds remain on successful results via `definitions.validSpeed`. Existing selector/estimate schema rules remain unchanged. Unit tests, transport-valid rejection examples and real authenticated Socket.IO round trips cover missing/invalid speed, absent candidate and malformed options while preserving the preview/direct estimate.                                                                                                                                                                          |
| 2. Auditable contraction bound               | Section 6.5 derives the all-phase periapsis maximum and parent-chain triangle bound from the actual versioned elements, period conventions and rotations. The test enumerates every one of 469 candidate chains and all 10 station chains, calculating analytic bounds rather than sampling epochs: maxima 58.976 and 59.141 km/s, both below 60. Both runtime ratios must be <=0.5 before any iteration; unavailable bounds return `EVALUATION_UNSUPPORTED`. Tests cover zero eccentricity, high supported eccentricities, negative body periods, invalid station periods, missing/cyclic/custom sources, numeric overflow, exact ratio 0.5 and just above. Analytic-model guarantees are distinguished from floating-point arithmetic and physical accuracy. |
| 3. Arrival station position                  | Section 6.5.1 and the result schema specify future host-chain position plus the verified station orbit's future rotated offset in the same basis/epoch. Tests independently recompute both vectors and cover absent metadata and equivalent active body-orbit metadata; unsupported placement stays rejected. The numeric-epoch station entry point preserves fractional milliseconds during iteration, with unchanged legacy timestamp behavior and integer positions.                                                                                                                                                                                                                                                                                        |
| 4. Authoritative calculation time            | Uniform POSIX/game milliseconds remain authoritative. ISO-8601 `Z` is a readable calendar rendering, not conversion to physical UTC. No UTC/TAI/TT/TDB calculation or conversion is introduced. Exact integer epochs remain on every returned point; the UI wording in Section 7 is corrected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Final validation:

| Exact command                                                                                                                                                                                                                                                                                                                                                                                                                         | Observed result                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node --test test\navigation-prediction.test.js test\navigation-route-estimate.test.js test\navigation-position-contract.test.js test\solar-system-get-message-handler.test.js test\celestial-operation-examples.test.js test\navigation-purchase.mongo.integration.test.js test\station-market-snapshot.test.js test\station-market-snapshot.mongo.integration.test.js`                                                              | **87 passed, 0 failed, 0 skipped**, exit 0. Includes real Socket.IO, isolated Mongo purchase/reload lineage and station regression tests. All **19 solarsystem examples** validate.        |
| `npx --yes @apidevtools/swagger-cli validate api\openapi.yaml`                                                                                                                                                                                                                                                                                                                                                                        | Valid, exit 0                                                                                                                                                                              |
| `npx --no-install eslint src\handlers\context\navigation-prediction-service.js src\handlers\context\navigation-state-service.js src\handlers\context\orbital-math.js src\handlers\solar-system-get-message-handler.js test\navigation-prediction.test.js test\navigation-route-estimate.test.js test\navigation-purchase.mongo.integration.test.js test\celestial-operation-examples.test.js test-support\navigation-test-helpers.js` | Exit 0, no errors or warnings                                                                                                                                                              |
| `npm run typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                   | Exit 0                                                                                                                                                                                     |
| `node scripts\lint-handler-patterns.js`                                                                                                                                                                                                                                                                                                                                                                                               | Exit 0, no critical violations; existing notices for credit-ledger/launch-item spatial checks and market handler sharing remain                                                            |
| `node -` with the Section 12.1 in-memory artifact/drift script                                                                                                                                                                                                                                                                                                                                                                        | `totalIssues: 0`, assertion passed; no writes or formatting                                                                                                                                |
| `git --no-pager diff --check`                                                                                                                                                                                                                                                                                                                                                                                                         | Exit 0; Git reports CRLF normalization notices on existing files                                                                                                                           |
| `git --no-pager status --short -- api\artifacts\contracts`                                                                                                                                                                                                                                                                                                                                                                            | Empty at start and earlier validation. A later check reported modified report paths during unrelated worktree activity; all were preserved, with no task-owned artifact writes or cleanup. |
| `git --no-pager diff --numstat -- api\artifacts\contracts`                                                                                                                                                                                                                                                                                                                                                                            | Empty at the final check despite the status markers; no content diff reported                                                                                                              |

The full runtime reproduces the reviewed encounter/arrival epochs, positions,
iteration counts and residuals exactly. The zero-candidate example's distinct
source revision was regenerated from the runtime. Unit tests verify JSON-identical
navigationState, bodies, stars and navigationEstimate with/without prediction,
exactly two source captures, no source mutation, changed-source rejection, and
no partial result on either-leg failure. Existing shared navigation fixture setup
was extracted to `test-support/navigation-test-helpers.js` rather than duplicated.

During development, a one-ULP analytic-bound assertion was changed to a numeric
tolerance, check-JS annotations/union guards were corrected, and a YAML merge-key
example rejected by the parser was replaced with explicit properties/ordinary
aliases. The final rerun above is clean. Existing direct-estimate AJV strict-type
warnings remain unchanged.

Not run: whole-repository `npm test`/`npm run lint`, formatting, or the writing
contract CLIs. Focused validation covers all changed behavior plus directly
affected station callers. No live-world writes, server restart, artifact cleanup,
Prettier, commit, or Phase 3+ work was performed by this task. Unrelated
configuration, formatting and worktree changes appeared during final validation;
they were not reverted or incorporated into this task. Nova's running server
needs to load these changes before runtime review.

### 12.3 Phase 2C live readiness evidence (2026-11-16)

Nova approved Phase 2B, as relayed by the owner (D20). The owner then selected
read-only Forge readiness and handoff (D21). This checkpoint changes only this
design/tracking document; it does not add API/runtime behavior.

| Probe                                                                                      | Observed result                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invoke-WebRequest -Uri 'http://localhost:3000/docs/' -UseBasicParsing -TimeoutSec 15`     | HTTP 200; Swagger UI with its normal bundle/init scripts                                                                                                                                                                                                                                                                |
| `GET http://localhost:3000/health` using Node `fetch`                                      | HTTP 200; exactly `{ "status": "ok" }`                                                                                                                                                                                                                                                                                  |
| `GET http://localhost:3000/openapi.yaml` using Node `fetch`                                | HTTP 200, YAML content, `Cache-Control: no-store`                                                                                                                                                                                                                                                                       |
| `node -` with the live-contract script below                                               | Fully resolved live `socketSolarSystemGet` operation deep-equals the workspace operation. All **12 examples belonging to this operation** validate, plus four invalid-option inputs and the missing-candidate transport case. The **19** in Section 12.2 counts the entire solarsystem module, not only this operation. |
| `node -` with the missing-session script below                                             | WebSocket connection succeeds; exactly the expected `invalid-session` payload is received; no `solar-system-get-response`/prediction is emitted during the observation window. Empty session key fails before player/world lookup. Socket is disconnected after the probe.                                              |
| `Get-NetTCPConnection -LocalPort 3000 -State Listen` and `Get-Process -Id <OwningProcess>` | Existing Node listener started at 16:40:47 local time, after all four prediction runtime source modification times (latest 16:34:12). No process was started, stopped or restarted.                                                                                                                                     |
| `git --no-pager diff --numstat -- api\artifacts\contracts`                                 | Empty. No generated artifacts were cleaned or reverted.                                                                                                                                                                                                                                                                 |

The schema parser's default safe-URL resolver declined localhost on the first
attempt, even though direct GET succeeded. The successful probe explicitly
allows **only** `http://localhost:3000`, disables file resolution for the remote
document and follows no redirects. No dependency or repository configuration
was changed.

Live-contract probe (PowerShell: pipe this JavaScript in a single-quoted
here-string to `node -`):

```js
const assert = require('node:assert/strict');
const path = require('node:path');
const Parser = require('@apidevtools/swagger-parser');
const { createSchemaValidator } = require('./src/model/schema-validator');
(async () => {
  const origin = 'http://localhost:3000';
  const [live, local] = await Promise.all([
    Parser.dereference(`${origin}/openapi.yaml`, {
      resolve: {
        file: false,
        http: {
          safeUrlResolver: false,
          redirects: 0,
          timeout: 10000,
          canRead: (file) => new URL(file.url).origin === origin,
        },
      },
    }),
    Parser.dereference(path.resolve('api', 'openapi.yaml')),
  ]);
  const operation = live.paths['/socket/solar-system-get'].post;
  assert.deepEqual(operation, local.paths['/socket/solar-system-get'].post);
  assert.equal(operation.operationId, 'socketSolarSystemGet');
  console.log('Live fully resolved solar-system-get operation matches workspace: PASS');
  const ajv = createSchemaValidator({ strict: false });
  const request = operation.requestBody.content['application/json'];
  const response = operation.responses['200'].content['application/json'];
  let count = 0;
  for (const [kind, content] of [
    ['request', request],
    ['response', response],
  ]) {
    const validate = ajv.compile(content.schema);
    for (const [name, example] of Object.entries(content.examples)) {
      assert.equal(
        validate(example.value),
        true,
        `${kind} ${name}: ${JSON.stringify(validate.errors)}`
      );
      count++;
    }
  }
  const validateRequest = ajv.compile(request.schema);
  for (const options of [
    {},
    null,
    { scenarioCruiseSpeedKmPerSec: 10 },
    { scenarioCruiseSpeedKmPerSec: '150' },
  ]) {
    const value = structuredClone(request.examples.pairedPrediction.value);
    value.navigationPrediction = options;
    assert.equal(validateRequest(value), true, JSON.stringify(validateRequest.errors));
  }
  const value = structuredClone(request.examples.pairedPrediction.value);
  delete value.navigation.candidateBodyId;
  assert.equal(validateRequest(value), true, JSON.stringify(validateRequest.errors));
  console.log(
    `Live solar-system-get examples: ${count} valid; invalid-option and missing-candidate transport checks: PASS`
  );
  const prediction =
    response.examples.pairedPredictionSupported.value.navigationPrediction.prediction;
  console.log(
    JSON.stringify(
      {
        version: live.info.version,
        predictionModelId: prediction.predictionModelId,
        timeScaleId: prediction.timeScaleId,
        encounterEpochMs: prediction.encounter.epochMs,
        arrivalEpochMs: prediction.arrival.epochMs,
      },
      null,
      2
    )
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
```

Missing-session probe (same `node -` invocation):

```js
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { io } = require('socket.io-client');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('./src/model/session');
(async () => {
  const socket = io('http://localhost:3000', {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
    timeout: 5000,
  });
  let responses = 0;
  socket.on('solar-system-get-response', () => {
    responses++;
  });
  let timer;
  try {
    const invalid = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Read-only session probe timed out')), 8000);
      socket.once('connect_error', reject);
      socket.once(INVALID_SESSION_EVENT, resolve);
      socket.once('connect', () =>
        socket.emit('solar-system-get-request', {
          playerName: 'phase2c-readiness-probe',
          sessionKey: '',
          correlationId: randomUUID(),
          requestIdentity: {
            operation: 'solar-system-get',
            entityType: 'solar-system',
            containerId: 'sol',
          },
          solarSystemId: 'sol',
          navigation: {
            shipId: 'not-an-owned-ship',
            destinationMarketId: 'sol-pluto-orbit',
            candidateBodyId: 'sol-luna',
          },
          navigationPrediction: { scenarioCruiseSpeedKmPerSec: 150 },
        })
      );
    });
    socket.connect();
    const response = await invalid;
    assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(responses, 0);
    console.log(
      `Live Socket.IO: ${INVALID_SESSION_EVENT} received; no prediction/solar-system response; missing session was not bypassed: PASS`
    );
  } finally {
    clearTimeout(timer);
    socket.disconnect();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
```

**Evidence boundary:** static contract parity and process timestamps are not an
authenticated live prediction test. No existing player session was supplied for
this checkpoint; no credentials were retrieved, no login/registration/purchase
was performed, and no ordinary lazy-seeding system read was sent. The successful
authenticated Socket.IO and persisted-lineage tests in Section 12.2 are isolated
test evidence, not a result from this live process. Nova must perform the live
smoke using its already-authorized session and an existing supported ship.
Visual acceptance is likewise pending. No broader test suite, Prettier, artifact
generation/cleanup or Phase 3 work was run.

### 12.4 Phase 2D formatting cleanup evidence (2026-11-16)

Scope (D22–D24): repository-wide Prettier with generated/byte-pinned outputs
excluded through a new `.prettierignore`; `contract-artifact.json` unchanged;
results left uncommitted for owner review. Base: owner commit `5ce7df13`.

Read-only review before any write:

- `npx --no-install prettier --list-different .` listed 112 files: 13 of the 17
  Phase 2 files (five of them were already unformatted before Phase 2) and 99
  other repository files.
- Byte-exact consumers in that list:
  `test/system-naming-finalization.test.js` requires
  `renderMarkdown(report)` to equal
  `docs/system-naming-final-review-2026-11-06.md`;
  `scripts/finalize-system-naming.js --check` compares that document and three
  naming JSON outputs byte for byte; and
  `data/non-sol-celestial-generation-manifest-v1.json` pins raw SHA-256
  `sourceFiles`, including eight listed data/doc files that still matched.
  Exoplanet, Kepler-11, benchmark-report and crossmatch-calibration JSON is
  generator-written and would revert on regeneration.
- Not affected: weighted-allocation protected hashes (files not in the list)
  and universe packaging (reads ignored `artifacts/` delivery folders).
- `contract-artifact.json` lacks Phase 1 and Phase 2 navigation surfaces (stale
  before Phase 2); in-memory drift against the baseline was 0. Left unchanged.
- Pre-write baselines: finalization `--check` passed; the inventory strict
  `--check` already failed (pre-existing stale P0 baseline);
  `--check-preservation` passed with 12 historical source changes and equal
  body hashes.

Changes:

- `.prettierignore` (new): `data/`, `reports/`,
  `docs/system-naming-final-review-2026-11-06.md`, `docs/Stellar notes.md`,
  `scripts/lib/exoplanet-crossmatch-calibration.json`. Prettier 3 still honors
  `.gitignore` as well.
- `npm run format` formatted 88 files. Prettier's member-chain layout was not
  idempotent in four files (`scripts/lib/non-sol-market-density-lifecycle.js`,
  `scripts/lib/non-sol-market-density-plan.js` and two Mongo integration tests);
  a second `npm run format` settled them.
- Net: 88 tracked files changed plus the new ignore file. No other worktree
  change.

Final independent revalidation reproduced the checks below against the current
worktree. For each changed file except this tracker, formatting its `HEAD`
contents with the current Prettier configuration until stable reproduced the
worktree bytes exactly: 87 of 87 files. The tracker was reviewed separately
against its formatted `HEAD` version; its content changes record completion,
approved scope and validation evidence. The ignore rules exactly match D24.
The structural comparisons below also passed independently.

The complete review patch (including the untracked `.prettierignore`), the
tracker-only content diff, the verification script, per-file SHA-256 evidence
and full validation logs are retained with the local session review evidence,
not added to the repository.

| Command                                                                                | Result                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`                                                                 | `All matched files use Prettier code style!`                                                                                                                                                           |
| Equivalence against `HEAD` (espree AST without locations/raw, `JSON.parse`, `js-yaml`) | 75 JS, 5 JSON, 1 YAML: no semantic differences. Six of seven Markdown files changed only whitespace/emphasis; this tracker's other changes are D22–D24 edits, table padding and embedded-sample layout |
| `npm test`                                                                             | `api/openapi.yaml is valid`; no critical handler-pattern violations; 1015 tests, 1015 pass, 0 fail, 0 skipped (~259 s on final revalidation)                                                           |
| `npm run lint`                                                                         | exit 0, no problems                                                                                                                                                                                    |
| `npm run typecheck`                                                                    | exit 0                                                                                                                                                                                                 |
| `git --no-pager diff --check`                                                          | clean                                                                                                                                                                                                  |
| `node scripts\finalize-system-naming.js --check`                                       | pass; `manifestSha256` `4d223d0f…`, `liveDatabaseWrites: 0`                                                                                                                                            |
| `node scripts\non-sol-celestial-inventory.js --check-preservation`                     | PASS (4844 targets); historical source changes now 13, adding the formatted pinned input `src\model\cygnus-x1-system-catalog.js` (body hashes unchanged)                                               |
| In-memory `buildArtifact`/`analyzeDrift` (Section 12)                                  | `totalIssues` 0; no artifact writes                                                                                                                                                                    |

The full test run retained the existing non-critical handler-pattern notices;
repository ESLint reported no problems. Hashes of all 88 changed tracked files
were unchanged across the test run.

Test side effect: `npm test` rewrote seven tracked
`artifacts/contracts/*-report.json` files, replacing committed absolute
`D:\at-template\…` paths with the local checkout path. The diffs were inspected
(path-only) and exactly those seven files were restored to their captured
pre-test bytes. No other files were restored; both artifact directories have
no remaining changes and `api/artifacts` was untouched.

Not done: commit or push, server restart, contract-artifact regeneration, or a
rewrite of the stale P0 inventory baseline (owner decision, outside Phase 2).

## 13. Compatibility risks

- **Additive opt-in.** Non-opt-in requests are byte-identical (tests 1–2).
  Clients that ignore unknown fields are unaffected. The top-level response
  schema is not closed.
- **Example count.** It changes from 13 to 16 (2B.1) to 19 (2B) and is pinned by a test; this is
  intentional.
- **Presence refresh.** Requests carrying only `navigationPrediction` now skip
  presence refresh, like the other navigation opt-ins. Existing requests are
  unchanged.
- **Speed floor.** Scenario speeds below 120 km/s are rejected. Realistic
  chemical-propulsion speeds (about 10–30 km/s) cannot be represented in
  Phase 2. This is the accepted cost of proven convergence (D2, R8).
- **Past departure epoch.** Departure is the stored ship epoch, which can be in
  the past, so predicted epochs can also be in the wall-clock past. The UI must
  label them as projected epochs, not schedule times (P1, P4).
- **Payload and cost.** The existing payload (about 7 MB of Sol bodies) is
  unchanged; the prediction adds under 2 KB. Computation runs a few hundred
  Kepler evaluations (well under 10 ms) inside the existing capture window.
- **Time-scale declaration.** It lives only on the prediction; `navigationState`
  remains unchanged (R5).
- **Contract artifacts.** Regeneration is a tracked-file side effect (Section 12).

## 14. Open product decisions

**Resolved for step 2B.1 on 2026-11-16:** the owner accepted all recommendations
below (D12–D16). These original review questions are retained for context, not as
outstanding blockers. D17 subsequently approved runtime implementation.

- **P1 — Epoch labels in the UI.** May Nova label the projected encounter and
  arrival markers with their epochs? Recommended: yes, as "projected at
  `<game-time calendar label>` — illustrative N km/s scenario". Never "ETA", "arrives in",
  countdowns or epoch differences (durations).
- **P2 — Identifier names.** Finalize `predictionModelId`
  (`constant-speed-straight-legs-moving-targets-v1`) and `timeScaleId`
  (`stellar:unix-ms-uniform:v1`).
- **P3 — Diagnostic fields.** Keep `convergence` diagnostics and
  `arrival.hostPositionKm`? Recommended: keep. They are cheap, aid review, and
  Nova may ignore them.
- **P4 — Departure epoch.** Accept departure at the stored ship epoch for
  Phase 2. Recommended: accept. Real-time departure and ship propagation are
  Phase 3+ (R6).
- **P5 — Contract version.** Confirm there is no `info.version` bump.
  Recommended: no bump, consistent with prior navigation additions.

## 15. Revisit register (owner decision D8)

| #   | Item                                                                       | Current Phase 2 approach                                              | Trigger to revisit                                                                                                                                       |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Universe-wide game time standard (multi-system, multi-galaxy)              | A single uniform POSIX-millisecond game time scale, used for Sol only | First non-Sol navigation or prediction, inter-system travel, or any galaxy/intergalactic scope                                                           |
| R2  | Per-system time scales and mapping between system clocks                   | Not modeled                                                           | Same as R1, or a per-system ephemeris                                                                                                                    |
| R3  | TT/TDB fidelity in Sol (64–69 s offset; ≤ ~4,100 km)                       | Ignored; consistent with Phase 1                                      | Any accuracy claim beyond illustrative, or an ephemeris/model upgrade                                                                                    |
| R4  | Light-time and relativistic effects (≤ 3.3% c; Sol light-time up to hours) | Ignored; positions are geometric instants                             | Observation/communication features, or raising the maximum speed                                                                                         |
| R5  | `timeScaleId` on `navigationState` itself                                  | Declared on the prediction only                                       | Next `navigationState` contract revision                                                                                                                 |
| R6  | Departure at request time, with ship propagation                           | Frozen at the stored ship epoch                                       | Phase 3+ gate                                                                                                                                            |
| R7  | True UTC display with leap seconds                                         | Identity label only                                                   | Any real-world clock synchronization claim                                                                                                               |
| R8  | Static 120 km/s minimum                                                    | Global proven-contraction floor                                       | Catalog changes raising bounds (guarded by test 26), or a product need for slower scenarios (route-specific bounds or a bracketing earliest-root solver) |

Future direction, not designed here: tiered Navigation Computer capabilities
comparing costs such as time and fuel, working toward A*-like search. Phase 3
and later remain separately gated.

## 16. Copy/paste Nova Phase 2C handoff

```text
Nova — Phase 2B is approved. Please proceed with Phase 2C consumption and
Viewer review against Forge's existing illustrative prediction contract.
No backend architecture redesign or Phase 3 work is requested.

Authority and readiness
- Forge docs: http://localhost:3000/docs/
- Contract: http://localhost:3000/openapi.yaml and its referenced schemas.
- Operation remains socketSolarSystemGet; events remain
  solar-system-get-request / solar-system-get-response.
- Read-only Forge readiness checks passed: health/docs, live resolved contract
  parity, all 12 operation examples and missing-session rejection.
- The running process started after the runtime edits. Authenticated prediction
  on this live process still needs your smoke test; the prior 87 passing backend
  tests (including authenticated sockets and persisted purchase lineage) used
  isolated fixtures.

Request and input
- Use your existing authenticated session and an existing owned ship with valid
  backend-issued purchase lineage. Example ship IDs in Swagger are illustrative,
  not guaranteed live entities. Keep credentials out of logs, screenshots and
  committed fixtures.
- Keep navigation { shipId, destinationMarketId, candidateBodyId } and add
  navigationPrediction { scenarioCruiseSpeedKmPerSec }.
- Exactly one explicitly selected planet/moon; explicit player speed, finite
  number in [120,10000] km/s, no default/coercion. Do not infer it from ship
  capability or reuse a direct-estimate speed implicitly.
- navigationEstimate may coexist, unchanged; {} requests the existing direct
  distance without supplying a duration assumption.
- Include the existing correlationId and requestIdentity metadata.
- Always use the navigation opt-in for these live probes. Ordinary system reads
  can seed/refresh presence. Do not buy, seed, edit epochs, repair stations,
  create accounts, restart Forge or change world data for this checkpoint.
  If no suitable session/ship exists, report that prerequisite rather than
  fabricating lineage or creating live fixtures.

Association and presentation
- Consume navigationState, navigationEstimate and navigationPrediction from
  one response; retain/replace the prediction with that same-response state.
  Correlation/IDs alone do not authorize mixing independently captured results.
  Discard superseded replies when selection or scenario input changes.
- Draw prediction only for outer success, supported eligible navigationState,
  and navigationPrediction.success=true with prediction.status=supported.
  Require association=same-response-navigation-sources; sourceRevision, basis,
  model and departure must agree with that same navigationState. Candidate and
  destination/host identities must agree with the selected endpoints.
- Keep the existing direct preview and direct endpoint distance separate and
  unchanged. Do not replace canonical body positions or the frozen T0 preview
  markers with predicted positions. Add clearly distinct prediction markers.
- Use departure.positionKm, encounter.positionKm and arrival.positionKm at their
  own exact epochMs. arrival.hostPositionKm is the future host center; the station
  position already includes its verified orbital offset. Never add that offset
  or a host parent again.
- You own illustrative curves/geometry. Forge's straight legs are for timing
  only, not a physically solved trajectory or the length of your drawn curve.
- timeScaleId=stellar:unix-ms-uniform:v1 is authoritative uniform POSIX/game
  time. new Date(epochMs).toISOString() is a calendar rendering, not conversion
  to physical UTC. Keep the integer epoch. Label displayed epochs as
  illustrative game time; do not present them as ETA, countdown or route duration.
- On nested rejection, retain the valid same-response preview/direct estimate
  and clear the rejected prediction geometry. Show its explicit reason/message;
  never keep an older successful prediction or draw a partial encounter.
- No assist benefit/speed change, physical clearance, safe/reachable claim,
  validated gravity assist, ranking, multiple assists, fuel/engine modeling,
  optimizer or travel execution.

Focused live and UI review
1. Supported route: existing eligible Mars/Pluto-source ship, eligible
   destination, explicit Luna (or other supported planet/moon), speed 150.
   Expect complete departure/encounter/arrival, exact source association,
   independent convergence diagnostics and CLEARANCE_UNVERIFIED.
2. Explicitly enter 120 and 10000: both speed boundaries are accepted for
   eligible supported sources; prediction markers can change while the frozen
   direct preview/distance does not. Do not make 150 a hidden UI default.
3. Keep a valid navigation selection and send speed 10 or {}: expect nested
   SCENARIO_SPEED_INVALID with the preview/direct estimate retained. Omit only
   candidateBodyId: expect CANDIDATE_REQUIRED and the zero-candidate preview.
   Non-object options or extra keys yield NAVIGATION_REQUEST_INVALID.
   Existing malformed/multiple navigation-selector schema rules still apply.
4. Ineligible destination such as sol-earth-orbit remains blocked:
   KNOWN_INVALID_DESTINATION, no prediction. A legacy ship without lineage
   remains BASIS_UNKNOWN. Do not repair either condition as part of this phase.
5. Toggle prediction off, change candidate/speed while replies are in flight,
   and handle invalid-session: no stale/mixed prediction geometry, no partial
   success, no hidden fallback. Invalid session is a separate socket event.
6. Compare opt-in and non-opt-in preview/direct fields only while source
   revisions remain unchanged. A source change is not permission to mix pairs.
   Horizon/nonconvergence/source-change edge cases are already covered by
   isolated backend tests; do not mutate the live world to induce them.

Return the live request/response and UI review outcomes without credentials,
screenshots of supported and rejected scenarios, any exact contract mismatch,
and items requiring owner visual acceptance. Keep Phase 2C open until that
acceptance; Phase 2D formatting/cleanup and Phase 3 remain separately gated.
```
