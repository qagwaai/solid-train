# System market density - feature handoff

Date: 2026-11-07

Status: **Planning and handoff only. No density policy, additional markets,
economic changes, or rollout is approved or implemented.**

## 1. Why this feature exists

During the isolated Copper Vale P5 review, the owner asked:

> after looking again at Copper Vale, i am feeling that we are short on markets.
> is it true that there is only one market for the whole system?

**Yes: the approved Copper Vale preview seeds one market for the entire system.**
The original non-Sol plan required at least one usable station and mineable
asteroid per successfully implemented system. P3 implemented that minimum,
not a calibrated settlement/economic density. One market is not evidence that
this is an appropriate density for a developed system.

This feature should propose how many markets a system needs, where they belong,
and what makes destinations meaningfully different. Do not merely multiply the
current station by an arbitrary fixed count.

The owner requested this document so the feature can resume in another session.
No additional market count, settlement regime, station role or economic model
has been selected.

## 2. Related work and authority

- [Non-Sol seeding plan](seed-non-Sol-systems-2026-11-07.md):
  accepted P0-P4 scopes and P5 isolated-pilot evidence, especially Sections
  13, 14 and 15.
- [Five-system assessment](seed-non-Sol-systems-2026-11-07-five-system-review.md):
  physical/evidence constraints and blocked systems.
- [Nova attribution handoff](seed-non-Sol-systems-2026-11-07-Nova-prompt.md):
  source and hypothetical-generation disclosures.

Forge is authoritative for backend contracts, seed policies and persistence.
Nova consumes those contracts and must be validated against real isolated data.
Do not treat provisional notes, existing UI copy or an old station template as
approval for new gameplay or physically valid station locations.

## 3. Current Copper Vale baseline

| Item | Accepted baseline |
| --- | --- |
| System | Copper Vale / GJ 9066, `exo-gj-9066` |
| Bodies | 57: star 1, planets 5, moons 16, asteroids 26, TNOs 7, comets 2 |
| Planet appearances | Rocky 2, super-Earth 1, sub-Neptune 1, existing gas giant 1 |
| Body names | 18 owner-approved preferred names; other bodies retain labels |
| Market count | **1** |
| Market ID | `copper-vale-asteroid-exchange` |
| Market name | Copper Vale Asteroid Exchange |
| Site name shown in Nova | Copper Vale Inner Planet Orbital Station |
| Host | Hearthward, `exo-gj-9066-generated-planet-d569077cea00ac968d730c15` |
| Placement | Active supported body-orbit metadata; circular, no station keeping |
| Host-centered orbital radius | Approximately 12,525.508295 km |
| Surface clearance | Approximately 6,262.754148 km |
| Period | Approximately 16,283.757054 seconds |
| Hill-radius screen | Approximately 0.041215 of host periapsis Hill radius |
| Nearest screened envelope gap | Approximately 11,410.975157 km |
| Current economy settings | Price multiplier 1, drift 4%/hour, restock 60 minutes |

The 26 asteroids are an initial addressable gameplay sample, **not the real
population or a permanent generation ceiling**. Their Common primary deposits
are silicon 10, iron 8, carbon 4, nickel 2 and copper 2.

Do not derive market counts from this sample size alone. More physical bodies
also do not automatically establish settlements, customers, industrial demand,
or a requirement for a station around every body.

The accepted station is planet-anchored despite its market ID/name referring to
asteroids. This is not a station orbiting an asteroid belt. Preserve its identity
and clarify naming/location distinctions in any future proposal.

Accepted immutable input/output digests:

- P3 resource/station preview:
  `cd60edffe10a2b8c14707e0b0776d16251006d769eb6fc8dbb3315dee4ed004a`
- P4 named preview:
  `5e580149a6df92a50495fe1fca0c1de02df714c4194ddb3b44ebaa3d933dda04`

Do not overwrite or silently revise these accepted previews. A reviewed market
expansion needs a separate policy/revision and a comparison against this baseline.

## 4. Resume constraints

- Start with questions in a **selectable form with a free-text input field**.
  Obtain decisions before implementing density or economy behavior.
- Keep existing markets, IDs, body names, catalog facts, player ownership and
  mutable gameplay history intact.
- Use offline proposals first, then isolated Mongo and separate Nova validation.
  Never seed the owner's normal/development/live database without separate
  explicit authorization.
- No automatic commits, pushes, deployments or bulk activation.
- Keep Prettier out of normal edit/test cycles until major-phase completion.
- Give exact owner-validation directions and expected observations at each gate.
- Copper Vale is the available first candidate, not an automatically approved
  density template for all systems.
- Alpha Centauri, Barnard's Star, Cygnus X-1 and Toivonranta / HR 8799 remain
  blocked for their recorded physical/source reasons. Market density does not
  resolve those blockers.
- The future 2% complete naming-dominance exception is **naming only**.
  It establishes no population, settlement intensity, culture displacement,
  market count, faction ownership or economic demand.
- Ship staging and Copper Vale mining/trading UI validation were explicitly
  deferred. This handoff does not authorize moving a ship.

## 5. Questions for the next session

Suggested form topics below are **options to review**, not selected policies.
Split into focused forms if necessary.

1. **Scope:** Copper Vale only first; the five-system review where unblocked;
   or a reusable policy with Copper Vale as its first offline example.
2. **Density basis:** authored per-system review; settlement-intensity profiles;
   or a deterministic combination of reviewed profiles and physical opportunities.
   Are settlement profiles fictional gameplay assumptions or already authored
   facts elsewhere in the project?
3. **System variety:** remote/unsettled, frontier, developing, established and
   major trade-center cases are possible design options. Which should exist,
   and can exceptional systems have no market? Reconcile any zero-market case
   with the current minimum-one requirement through explicit approval.
4. **Copper Vale target:** request a proposed range and exact candidate sites
   before choosing a number. Do not assume it is heavily settled.
5. **Roles:** general trade, mining exchange, logistics depot, ship sales/service,
   research outpost or another role. Decide which are flavor labels and which
   require real runtime capability; do not advertise unavailable mechanics.
6. **Economy scope:** keep existing catalog, pricing and restock behavior for the
   first density slice, or separately design differentiated inventory/demand?
   Extra markets may multiply available stock and trading opportunities even
   without changing prices.
7. **Placement:** supported body/stellar orbits first, or a separately scoped
   evaluator for Lagrange/deep-space sites? Review physical evidence and travel
   accessibility, not just visually attractive coordinates.
8. **Naming and ownership:** propose names and motivations; decide whether
   faction/operator metadata is needed. Do not invent settlement histories.
9. **Acceptance:** approve exact offline candidates first, then isolated UI and
   persistence evidence. Keep bulk approval separate.

Include a free-text field for intended feel, preferred market roles, numerical
expectations and exclusions. Record answers in this document before proceeding.

## 6. Implementation starting points

### Forge: current checkout

- [Copper Vale P3 preview](../src/model/non-sol-p3-preview.js):
  approved resource allocation, station construction, physical clearance screens
  and separate resource/station policy versions. It currently returns singular
  `station`; inspect every consumer before introducing a plural overlay/report.
- [Copper Vale P4 preview](../src/model/non-sol-p4-preview.js):
  accepted naming overlay, source pinning, station anchor name and replay checks.
- [Existing system market seeds](../src/model/solar-system-market-seed.js):
  authored Sol/non-Sol examples and market seed version/state key. Existing Sol
  templates provide prior art, not a scientific density or orbital-validity rule.
- [Station placement contracts](../src/model/station-placement.js):
  `body-orbit`, `stellar-orbit`, `lagrange-region`, `deep-space`.
  **Only body/stellar orbits currently support active orbital-elements placement.**
  Lagrange/deep-space metadata must not masquerade as supported active trajectories.
- [Context bootstrap](../src/handlers/context/context-bootstrap-service.js):
  canonical market payload initialization currently fills the market catalog,
  ledger and default ship listings. Role specialization is not provided simply
  by giving a station a different name.
- [Market service](../src/handlers/context/market-service.js) and
  [database service](../src/db/service.js):
  canonical reads, persistence and runtime economy paths.
- [Isolated pilot launcher](../scripts/copper-vale-isolated-pilot.js),
  [worker](../scripts/copper-vale-isolated-worker.js) and
  [pilot seed/readback](../src/model/copper-vale-isolated-pilot.js):
  temporary Mongo, explicit opt-in, private URI handoff and real backend transport.
  The current pilot/readback assumes one station; update deliberately if a new
  reviewed overlay is authorized.
- [P3 tests](../test/non-sol-p3-preview.test.js),
  [P3 Mongo gameplay tests](../test/non-sol-p3.mongo.integration.test.js),
  [P4 Mongo tests](../test/non-sol-p4.mongo.integration.test.js) and
  [pilot tests](../test/copper-vale-isolated-pilot.test.js):
  prior art for deterministic previews, preservation, actual mining/trades and
  durable readback.

### Nova: adjacent checkout

Location: `C:\Development\Projects\Github\laughing-octo-journey`.

Inspect system Viewer/list/detail, scene market rendering, Market Hub,
location filtering and station selection. Ensure markets shown in the UI match
the canonical backend, including `siteName` versus `marketName`.

That checkout now has an opt-in `copper-vale-pilot` Angular configuration and
`npm run start:pilot:copper-vale` on port 4201. Its `pilotApiPort` URL parameter
selects only a temporary loopback backend, rejects port 3000 and persists in
tab-local session storage. Normal configuration remains unchanged.

## 7. Proposed steps and progress tracking

Mark a step complete only with recorded evidence. Use this table as the feature's
tracker; fill the final column with decisions, commands/results and owner approval.

| ID | Step | State | Completion evidence / decision |
| --- | --- | --- | --- |
| M0 | Confirm scope and density/economy questions | Pending | Selectable owner form with free-text field |
| M1 | Inventory existing markets, capabilities and density inputs | Pending | Read-only per-system inventory; distinguish source facts from authored assumptions |
| M2 | Propose policy and exact Copper Vale sites | Pending | Counts, roles, host IDs, physical screens, naming and economic implications |
| M3 | Owner reviews offline proposal | Pending | Exact approved candidates and explicit exclusions |
| M4 | Implement versioned deterministic market overlay | Pending | No accepted baseline mutation; stable IDs; normal runtime still opt-in |
| M5 | Verify isolated persistence and rerun preservation | Pending | Fresh reads, history/stock/ownership retained, no duplicate markets |
| M6 | Validate Nova destinations and market usability | Pending | Counts/labels/locations agree; supported actions work without mocks |
| M7 | Owner accepts scoped result and chooses expansion | Pending | Exact digests and recorded approval; bulk authorization separate |

Dependencies: M1 follows M0; M2 follows M1; M3 follows M2; M4 follows M3;
M5 follows M4; M6 follows M5; M7 follows M6.

For M2, propose a compact table with one row per candidate: stable ID, role,
market/site names, physical host/region, trajectory support, clearance/stability
evidence, resource/travel rationale, inventory policy and uncertainty.
Give the owner an understandable comparison with the current single market.

For M4/M5, add a separate market revision rather than regenerating bodies or
renaming them. Reuse existing canonical helpers. Changes to contracts, active
placement evaluators or trading balance must be explicitly scoped and tested.
Retain useful existing markets; never delete a player-modified market simply
because a new density policy would choose another location.

## 8. Validation and known limitations

Required checks for the eventual feature:

- Exact market counts per reviewed profile/system and exact approved output shapes.
- Same seed/revision produces identical IDs, placements and report digests;
  changing market density does not alter celestial physics or accepted names.
- Placement fails explicitly for invalid hosts, unsupported trajectories,
  surface intersections and relevant Hill/moon/ring conflicts.
- Market overlay preserves stock, ledger/trade history, prices changed through
  gameplay, ownership and unrelated records across reruns.
- Real isolated backend list/get/location responses and fresh DB reads agree
  with Nova's destination card, detail table, scene and Market Hub.
- Inspect travel/docking constraints and economic supply effects rather than
  using a successful market list as a proxy for accessible gameplay.
- Existing buy/sell behavior does **not** enforce docking; P3 tested trades with
  `isDocked:false`. Do not claim density changes add docking enforcement.
- No generic crafting handler was established by P3. Do not promise fabrication,
  refining or repair services based solely on station-role names.
- P3 mining uses an expendable dart drone; all initial 26 asteroid yields hit
  the existing 100-unit cap. Density work must not silently change this balance.
- Full-suite testing previously had an unrelated exoplanet-runtime assertion
  concerning an `exoplanet-names` source reference. Do not fix unrelated failures
  or claim the full suite passed from targeted results.

Useful existing targeted commands from the Forge root:

```powershell
node --test --test-concurrency=1 test\non-sol-p3-preview.test.js test\non-sol-p3.mongo.integration.test.js test\non-sol-p4.mongo.integration.test.js test\copper-vale-isolated-pilot.test.js
npm run typecheck
npm run seed:non-sol:preservation
```

These are starting points, **not validation of an unimplemented density feature**.
Add exact new policy/overlay/count/economy tests once scope is approved.

## 9. Session handoff state

P0-P5 are accepted for their recorded scopes. The owner accepted P5 on
2026-11-07 for the reviewed isolated Copper Vale slice, not the full
representative pilot or bulk rollout. Deferred browser count confirmation and
ship staging/mining/trading UI checks remain deferred, not verified by acceptance.

The real isolated Nova inspection showed 57 bodies plus one station and all 18
approved names. A destination-card discrepancy was found: catalog counts 1
planet/0 moons versus detail counts 5/16. The owner approved **fix counts only**
and deferred ship staging.

The correction is implemented in list/get response paths: live generated counts
contribute without reducing frozen catalog baselines, and `minPlanetCount` uses
enriched counts before paging. Registry/source facts remain unchanged.
Twenty targeted list/get/pilot/Mongo tests, typecheck, scoped lint,
`git diff --check` and P0 preservation passed. Browser confirmation of the
corrected card is pending temporary-backend restart.

During this session:

- Normal Forge port 3000 and Nova port 4200 were left running unchanged.
- Temporary pilot Nova used port 4201 and a temporary backend on port 59085.
  **These are ephemeral session details, not reusable configuration guarantees.**
- The running temporary backend predates the count correction and was left
  running to preserve the owner's current account/review.
- Restarting the pilot launcher creates a fresh temporary database and likely
  a different backend port. Use its new readiness URL, register a new temporary
  account/character and navigate through the normal Viewer menu.
- Normal character creation starts the ship in Sol. No ship was staged in
  Copper Vale, and Copper Vale mining/trading UI validation is incomplete.
- Prefer **Viewer -> search Copper Vale -> select result**. A bare details
  deep-link without character navigation state showed `missing-session`; normal
  menu navigation succeeded. Do not bypass this with copied credentials.
- Backend P4/P5 changes and adjacent Nova pilot configuration may be uncommitted.
  Inspect both worktrees; do not revert owner changes. In particular,
  `docs\ai-npc-2026-11-07.md` is unrelated owner work.

**First action next session:** read this document and the main plan's Section 15,
inspect current repository/process state read-only, then ask the M0 approval form.
Do not infer market-expansion approval from the existence of this handoff.
