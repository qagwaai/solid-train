# System market density - feature handoff

Date: 2026-11-07

Status (2026-11-08): **M3 exact-five approval received; additive density v1
implemented and validated in disposable Mongo. Real-target execution is
authorized only after clean preflight and is reserved to the parent operator;
density implementation made no real-target writes. The subsequent coupled
catalog/P6 investigation used read-only real-target queries (Section 11.0).**

Bulk expansion status (Section 12): **implemented/offline-validated only;
15,313 proposed additions, no target writes or deployment approval.
Alpha/Barnard preserved-baseline reconciliation and source migration remain
explicit approval gates.**

Current bulk revision: **Section 13 supersedes Section 12's v1 counts,
Alpha/Barnard holds, migration candidate and commands. V2 reconciles actual
baseline markets; no real-target persistent preflight/apply has run.**

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
The startup direction and exact five additions have since been approved
(Sections 10 and 11). Historical assessment text below is retained for context.

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

| Item                          | Accepted baseline                                                   |
| ----------------------------- | ------------------------------------------------------------------- |
| System                        | Copper Vale / GJ 9066, `exo-gj-9066`                                |
| Bodies                        | 57: star 1, planets 5, moons 16, asteroids 26, TNOs 7, comets 2     |
| Planet appearances            | Rocky 2, super-Earth 1, sub-Neptune 1, existing gas giant 1         |
| Body names                    | 18 owner-approved preferred names; other bodies retain labels       |
| Market count                  | **1**                                                               |
| Market ID                     | `copper-vale-asteroid-exchange`                                     |
| Market name                   | Copper Vale Asteroid Exchange                                       |
| Site name shown in Nova       | Copper Vale Inner Planet Orbital Station                            |
| Host                          | Hearthward, `exo-gj-9066-generated-planet-d569077cea00ac968d730c15` |
| Placement                     | Active supported body-orbit metadata; circular, no station keeping  |
| Host-centered orbital radius  | Approximately 12,525.508295 km                                      |
| Surface clearance             | Approximately 6,262.754148 km                                       |
| Period                        | Approximately 16,283.757054 seconds                                 |
| Hill-radius screen            | Approximately 0.041215 of host periapsis Hill radius                |
| Nearest screened envelope gap | Approximately 11,410.975157 km                                      |
| Current economy settings      | Price multiplier 1, drift 4%/hour, restock 60 minutes               |

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

| ID  | Step                                                        | State                                  | Completion evidence / decision                                                                                      |
| --- | ----------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| M0  | Confirm scope and density/economy questions                 | Complete                               | Owner form on 2026-11-08; Section 10                                                                                |
| M1  | Inventory existing markets, capabilities and density inputs | Complete                               | Section 10.4-10.5; canonical six-market inventory/restock/ship totals and capability limits                         |
| M2  | Propose policy and exact Copper Vale sites                  | Complete (offline proposal only)       | Section 10.5; five screened candidates, exact IDs/orbits/snapshots and pairwise envelope checks; no write authority |
| M3  | Owner reviews offline proposal                              | Pending                                | Exact approved candidates and explicit exclusions                                                                   |
| M4  | Implement versioned deterministic market overlay            | Complete                               | Separate additive lifecycle/journal; baseline preserved; Section 11                                                 |
| M5  | Verify persistence and rerun preservation                   | Complete for Copper Vale               | Isolated tests plus authorized persistent apply/readback; Section 11 deployment record                              |
| M6  | Validate Nova destination presentation                      | Complete, scoped                       | Owner confirmed Nova verification on 2026-11-08; mining/travel/trade UI loop remains deferred                       |
| M7  | Owner closes scoped result and chooses expansion            | Scoped slice closed; expansion pending | Owner moved on 2026-11-08; unavailable gameplay validation explicitly deferred; no bulk authorization               |

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

**Current next action:** use Section 11's parent-only preflight/apply/readback
gate. M0-M3 approvals are now recorded; do not widen the approved scope.

## 10. Market-density startup and initial assessment - 2026-11-08

### 10.1 Approved direction

The owner selected:

- A reusable density policy, with Copper Vale as its first reviewed example.
- Copper Vale is an **established** fictional system with multiple trade and
  logistics centers. This is an authored gameplay assumption, not measured
  settlement evidence or a claim of surface habitability.
- Propose count ranges by settlement profile, then screen exact physical sites.
- Assess all five roles: general trade, mining exchange, logistics/supply,
  ship sales/service and research.
- Treat all five as descriptive role themes over existing trading/ship-sales
  capability only; role names do not authorize new capability or mechanics.
- Placement/density first; preserve existing pricing/restock rules and assess
  added supply rather than silently rebalance the economy.
- Supported body/stellar orbits first. Active Lagrange/deep-space evaluators
  remain deferred.
- Retain at least one market per successfully seeded system; exceptions require
  separate review.

This initial direction authorized assessment/proposals only. The later explicit
M3/write authorization in Section 11 supersedes that gate for the exact five
additions only. P6 itself remains the original 57-body/one-station baseline.

### 10.2 Provisional ranges accepted for screening

These are editorial gameplay ranges, **not calibrated economic statistics**.
Counts include retained existing markets; viable placement and meaningful roles
take precedence over reaching a numerical target.

| Profile            | Provisional total markets | Intended distinction                                                 |
| ------------------ | ------------------------- | -------------------------------------------------------------------- |
| Frontier           | 1-2                       | One essential exchange, optionally a remote supply point             |
| Developing         | 3-5                       | Several distinct centers without comprehensive coverage              |
| Established        | 6-9                       | Multiple trade/logistics centers spread across suitable destinations |
| Major trade center | 10-16                     | Denser networks, subject to supply/performance review                |

The owner provisionally accepted these ranges for screening. They do not assign
profiles to other systems or force markets around every planet/moon. No profile
probabilities have been selected.

**Initial Copper Vale proposal: six total markets, retaining the existing one
and proposing five additions.** This is the low end of the established range.
It can represent all five assessed roles without immediately creating nine or
more copies of the current catalog.

### 10.3 Initial destination candidates - not approved placements

The table records the initial host ideas; exact M2 candidates and updated
physical results below supersede its preliminary status text.

| Candidate                              | Role proposal                       | Host/destination                    | Status                                                                               |
| -------------------------------------- | ----------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| Retained Copper Vale Asteroid Exchange | Mining exchange                     | Hearthward                          | Existing accepted market/ID unchanged                                                |
| Inner-system trade center              | General trade                       | Hearthward, separate screened orbit | Exact 3x-radius candidate and station/moon separation pass; pending M3               |
| Mid-system supply depot                | Logistics/supply                    | Stillglass Reach                    | 2x trial intersects P2 ring; 22,000-km candidate passes ring/moon screen; pending M3 |
| Giant-system exchange                  | General trade/logistics             | GJ 9066 c                           | Exact candidate passes moon and station-envelope screens; pending M3                 |
| Outer service center                   | Ship-sales theme                    | Far Compass                         | Exact candidate passes; only existing ship-sale capability, no repair services       |
| Outer research exchange                | Research theme plus ordinary market | Long Horizon                        | Exact candidate passes; no research mechanics authorized                             |

The exact M2 proposals and physical screens are recorded in Section 10.5;
final candidate approval and any changes remain an M3 owner decision.
The four non-Hearthward planets span approximately 0.88, 2.43, 7.22 and
13.79 AU from the star; Hearthward is at approximately 0.124 AU.
These distances suggest destination variety, not proven practical travel times.
Evaluate runtime travel/access constraints separately.

A preliminary circular orbit at twice each planet's mean radius leaves
5,840-61,162 km of surface clearance and uses about 0.00038-0.04122 of each
host's periapsis Hill radius. This is only an initial host screen, not a complete
station dynamics/thermal/ring/encounter validation.

Do not copy the existing Hearthward orbit for the second market. Distinct IDs
or a phase offset alone do not prove station-station clearance over time.

Large moons are not automatically safe alternatives: preliminary two-radius
orbits around Frostward, Silver Traverse and Common Promise use approximately
0.698, 0.118 and 0.102 of their respective periapsis Hill radii. All fail the
existing P3 conservative 0.1 screen at that trial radius; Frostward and Common
Promise also fail the 1,000 km surface-clearance screen. Do not relax those
criteria simply to increase market count.

### 10.4 Capability and supply consequences

The current canonical market bootstrap creates full catalog inventory and
default ship listings at every seeded market. Existing pricing/restock behavior
is per-market, not a shared system-wide stock budget.

- The owner explicitly accepts, for this density-first proposal, the duplicated
  full catalog/ship inventory and approximately sixfold initial-stock, stock-cap
  and restock-capacity increase. This is acceptance of the assessed consequence,
  **not**, at that earlier assessment gate, authorization to write markets.
- The pure assessment invokes the existing canonical `createSeedMarketPayload`
  only in memory. At six markets it reports 126 inventory rows (21 catalog
  entries at each market), aggregate initial stock/maxStock 71,520 units, and
  aggregate restock capacity 5,706 units per 60-minute interval (951 per market).
  One default ship listing/available ship per market gives six listings and six
  available ships; their default starter inventories total 36 units.
  Corresponding one-market totals are 21 rows, 11,920 stock/maxStock and 951
  restock units per interval. Exact per-item totals are in the preview output.
  Actual stock/access still changes through trades and restocking.
- Role labels alone do not specialize inventory. A research exchange remains
  an ordinary market unless real research functionality is separately approved.
- Existing default ship listings support the existing ship-sales path. The
  proposal makes no repair, refit or other service-capability claim.
- Mining-role names do not change deposits or implement refining.
- Keep the existing station's stock, ledger, prices and ownership unchanged.

Preserving pricing/restock rules is not the same as preserving total system
supply; the increase above is now an accepted proposal assumption. No inventory
budget redesign is in scope.

### 10.5 Exact offline screen - M3 now approved

Implementation: [pure market-density preview](../src/model/copper-vale-market-density-preview.js);
focused verification: [preview tests](../test/copper-vale-market-density-preview.test.js).
The module reads P4, P2 ring proposals, existing Kepler/math/placement helpers,
and in-memory canonical market payload initialization only. It does not connect
to a database, write a market, wire runtime behavior or alter P3/P4.

Baseline checksums remained the accepted P3
`cd60edffe10a2b8c14707e0b0776d16251006d769eb6fc8dbb3315dee4ed004a` and P4
`5e580149a6df92a50495fe1fca0c1de02df714c4194ddb3b44ebaa3d933dda04`.
The retained existing market is still `copper-vale-asteroid-exchange`; its
P4 station payload is returned unchanged. Screen result: **six total markets,
five candidate additions, zero physical or pair-envelope blockers**. These
five stable IDs and exact names/sites/orbits are now owner-approved neutral
descriptors, not cultural/source claims. The old proposal digest was
`f22d0915d38ed2e00f570bd67d2c61956d4b73f9aed7a95fadb34f96372fccec`.
The approval-status/name-only preview revision digest is
`7dbbb79542b549c19e389452def883c4ec82ee547525498d049c88d4502c5ba4`.

All five candidates use circular, active body-orbit descriptors with
eccentricity/inclination/node/argument/epoch-mean-anomaly all zero, the stated
semi-major axis, and epoch `2000-01-01T12:00:00.000Z`. Periods below use the
host mass and Kepler's two-body formula. Snapshot XYZ uses the host's P4
barycentric position at that same epoch plus the existing
`computeRelativePositionKm` helper's relative station orbit position; it is not
a copied/phase-only snapshot.

| Market / site name                                                           | Market ID                            | State                           | Role theme only         | Host body ID                                            | Orbit radius / period (km / s) | Surface clearance (km) | Periapsis Hill fraction |          Nearest moon/ring-envelope gap (km) |
| ---------------------------------------------------------------------------- | ------------------------------------ | ------------------------------- | ----------------------- | ------------------------------------------------------- | -----------------------------: | ---------------------: | ----------------------: | -------------------------------------------: |
| Copper Vale Asteroid Exchange / Copper Vale Inner Planet Orbital Station     | `copper-vale-asteroid-exchange`      | Retained existing; P4 unchanged | Mining/exchange         | `exo-gj-9066-generated-planet-d569077cea00ac968d730c15` |  12,525.508295 / 16,283.757054 |           6,262.754148 |              0.04121498 | 11,148.233841 (re-screened incl. moon radii) |
| Hearthward Inner Orbit Trade Exchange / Hearthward Inner Orbit Trade Station | `copper-vale-hearthward-trade`       | Owner-approved                  | General trade           | `exo-gj-9066-generated-planet-d569077cea00ac968d730c15` |  18,788.262443 / 29,915.171909 |          12,525.508295 |              0.06182246 |                                 4,885.479694 |
| Stillglass Reach Supply Depot / Stillglass Reach Orbital Supply Station      | `copper-vale-stillglass-supply`      | Owner-approved                  | Logistics/supply        | `exo-gj-9066-generated-planet-0ec42578e1833c74c9b54d32` |         22,000 / 43,284.211725 |          16,160.356310 |              0.00401767 |                       1,592.468476 (P2 ring) |
| GJ 9066 c Orbital Exchange / GJ 9066 c Orbital Exchange Station              | `copper-vale-gj9066c-exchange`       | Owner-approved                  | General trade/logistics | `exo-gj-9066-c`                                         |      122,323.2 / 52,115.520868 |               61,161.6 |              0.02254212 |                                17,491.174483 |
| Far Compass Ship Sales Exchange / Far Compass Ship Sales Station             | `copper-vale-far-compass-ship-sales` | Owner-approved                  | Ship-sales theme        | `exo-gj-9066-generated-planet-4ec2528f0ada1e4684410f30` |  26,528.462754 / 20,398.317804 |          13,264.231377 |              0.00082712 |                          No host moons/rings |
| Long Horizon Research Outpost / Long Horizon Research Outpost                | `copper-vale-long-horizon-research`  | Owner-approved                  | Research theme          | `exo-gj-9066-generated-planet-77b0fe14208b827c13f50157` |  21,250.249472 / 16,844.453166 |          10,625.124736 |              0.00037943 |                               376,479.442656 |

The second Hearthward station is deliberately at 3x mean host radius, not the
existing 2x orbit. Its orbit is 6,262.754148 km radially separated from the
existing station for every relative phase and is 4,885.479694 km from the
nearest moon envelope after including the moon physical radius. A trial at 2x
for Stillglass Reach would intersect the P2 ring proposal; the screened
22,000-km orbit is 1,592.468476 km outside its 20,407.531523-km outer edge.
All host moons were screened with physical radii included in their envelopes;
the P2 Stillglass ring remains a separate proposal and is not changed.

For the retained station plus five additions, all 15 station pairs passed the
1,000-km envelope screen. Same-host station spacing uses radial-envelope
separation for all phases (minimum: 6,262.754148 km). Different-host pairs use
conservative star-centered Kepler periapsis/apoapsis radial envelopes, including
the station orbital radii, rather than evaluating only epoch positions or
snapshot phases. These are analytic two-body bounds, not full dynamics proof.
The screen passes the 1,000-km surface and moon/ring envelope thresholds and
the existing P3 limit of at most 0.1 of host periapsis Hill radius; it does not
add moon/site evaluators or relax P3 criteria.

For reproducible snapshot readback, candidate barycentric XYZ at the common
epoch (km) is:

| Candidate ID                             |                  x |                     y |                   z |
| ---------------------------------------- | -----------------: | --------------------: | ------------------: |
| Retained `copper-vale-asteroid-exchange` | -18,479,898.130856 |     -4,328,861.555767 |    1,623,724.629706 |
| `copper-vale-hearthward-trade`           | -18,473,635.376709 |     -4,328,861.555767 |    1,623,724.629706 |
| `copper-vale-stillglass-supply`          | -23,571,682.049005 |   -366,293,503.112674 |   28,535,154.438926 |
| `copper-vale-gj9066c-exchange`           | 127,900,490.964955 |     26,008,596.173504 |    3,606,851.004395 |
| `copper-vale-far-compass-ship-sales`     | 868,670,206.723250 |   -518,527,516.245263 | -231,178,083.520282 |
| `copper-vale-long-horizon-research`      | 908,584,908.713345 | -1,885,581,622.853866 | -108,800,034.468316 |

Role descriptions remain descriptive themes over existing mechanics only.
Every site has ordinary market trade. Far Compass repeats the current default
ship-sale listing; it does not add repairs/refits. Long Horizon adds no research
functionality. Stillglass adds no logistics service; the mining/exchange label
on the retained market does not implement refining. No roles specialize stock.

**Candidate-approval gate (M3):** passed on 2026-11-08 for all five exact
additions. Both research `marketName` and `siteName` are **Long Horizon Research
Outpost**, with stable ID `copper-vale-long-horizon-research`; the other four
IDs/names/sites/orbits are approved unchanged. The analytic orbital screen still
leaves N-body perturbations, resonances, long-term stability, station keeping,
thermal/radiation, travel, docking and accessibility unscreened.

## 11. Approved additive lifecycle and parent execution gate - 2026-11-08

The preflight blocker below is historical and has been resolved through the
explicitly authorized five-field repair. The deployment record below captures
actual persistent apply; later unexecuted-command notes are historical.

### Authorized persistent expansion and Nova validation

On 2026-11-08 the owner approved all five additions, the neutral descriptive
roles, the duplicated inventory supply increase and **Long Horizon Research
Outpost** as both research market/site name. They authorized isolated validation
first and then clean-preflight apply to
`mongodb://localhost:27017/solid-train`, with Forge stopped.

After the catalog/P6 interoperability defect was fixed, the owner explicitly
authorized restoring five spatial leaf fields on the two existing catalog
bodies. Exact-old-value guarded updates restored the accepted snapshot epochs
and planet coordinates. All other document fields and all other records were
verified unchanged; valid updatedAt timestamps were retained. No database drop
or gameplay reset was performed.

Density dry-run then reported **ready**. Actual apply and fresh independent
readback both reported **complete**, with protected data unchanged.
Density plan SHA-256:
`3367349c32b93c622493965f9fb610cf7e7679af346e134dfaf4adb2bc204c4c`.

Persistent readback verified **57 bodies and six markets**. The original P6
baseline checkpoint still verifies complete with its unchanged plan digest.
The original station and all bodies were preserved during density apply.
No ship was moved. No new repair, logistics or research services were added.

**Owner Nova validation verified (M6):** On 2026-11-08 the owner stated
**"looking very good - consider this verified in Nova"** after inspecting the
persisted expansion. The presentation checkpoint is complete for the checks
below; this does not establish the separately deferred mining/travel/trade loop.

1. Restart normal Forge with `npm start` to load the interoperability fix.
2. In normal Nova on port 4200, use **Viewer -> search Copper Vale -> select**.
3. Expect the destination card to show **6 markets**, with **5 planets,
   16 moons and 26 asteroids** unchanged.
4. In the detail view, expect **6 station rows** and **63 total body/station
   rows**, with all 18 approved body names unchanged.
5. Confirm the retained inner-planet station plus Hearthward trade, Stillglass
   supply, GJ 9066 c exchange, Far Compass ship-sales station and **Long Horizon
   Research Outpost**. Nova may show `siteName`, not `marketName`.
6. Confirm these are descriptive trade destinations, not implied repair/research
   features. Mining/travel/ship staging remain separately deferred.

On 2026-11-08 the owner closed the current slice and directed work to move on.
Gameplay-loop validation is **unavailable for now**, not passed: the owner
reported that Nova has no way to navigate to these locations. Reopen this check
when a supported travel/location-access path exists; do not substitute direct
database ship moves for normal gameplay evidence. This limitation does not block
the accepted destination-presentation checkpoint or the next assessment.
Further system selection and bulk authorization remain pending.
No commit, push or bulk expansion was performed. The phase-completion formatting
pass remains outstanding.

**Persistent apply blocked at preflight; no added markets were written.**
The owner stopped Forge and authorized clean-preflight apply, but baseline P6
readback found that normal on-demand catalog seeding had changed the base star's
`updatedAt` and spatial epoch from the accepted 2000 epoch to
2026-11-08T15:13:25.491Z. The star position remains zero, but other affected
catalog records require full comparison before repair.
The lifecycle verifier now permits a valid mutable `updatedAt` timestamp
(seven lifecycle tests pass), but still rejects changed spatial seed fields.
Do not bypass spatial verification or drop the database to hide the issue.
Investigate normal catalog-seed/P6-checkpoint interoperability and obtain
approval for reconciliation before retrying market writes.

### 11.0 Catalog/P6 coupled blocker: read-only diagnosis and repair proposal

2026-11-08: normal `SolarSystemGetMessageHandler.buildResponse` calls the lazy
catalog seed. P6 completed its own `game_state` journal without populating the
ordinary per-system catalog seed marker. The missing marker caused normal seeding
to upsert the two catalog base bodies with request/current `asOf`. The ownership
merge preserved gameplay and protected naming but still replaced seed-owned
`spatial` and `updatedAt`. This mixed a current-epoch catalog planet/star with the
55 generated bodies and original station at the accepted J2000 snapshot.

**Real-target read-only evidence:** database names resolved the owner's shorthand
to `mongodb://localhost:27017/solid-train`, collection `cb` (literal `solidtrain`
has no collections). Native Mongo reads only; no connection initialization,
index creation, marker adoption, repair, density writes or server startup.
The P6 journal is `complete`, plan digest remains
`b8b9a82b42c57b5aa78ba330a6a632f986669bb44e5ab423e78911698304ba7f`.
Current approved P4 replay verifies source lineage, expected body hashes and
normal catalog source at the approved epoch. All 57 expected IDs are present:
exactly two base bodies differ; the other 55 match every seed-owned expected
field under the P6 ownership projection. No differences in expected mutable
gameplay fields were observed; extra ownership/gameplay fields are not repair
targets. There is still one market; the density journal is absent. Independent
read-only verification of `copper-vale-asteroid-exchange` also matches every
expected station seed-owned field, allowing valid mutable market gameplay.

Both base bodies retain `spatial.solarSystemId=exo-gj-9066` and
`spatial.frame=barycentric`. Exact expected/actual comparison (delta = actual minus
expected; position units km):

| Body / field                                   | Expected P6                | Actual                     | Delta                                                   |
| ---------------------------------------------- | -------------------------- | -------------------------- | ------------------------------------------------------- |
| `exo-star-gj-9066`, `spatial.positionKm.x/y/z` | `0 / 0 / 0`                | `0 / 0 / 0`                | `0 / 0 / 0`                                             |
| `exo-star-gj-9066`, `spatial.epochMs`          | `946728000000`             | `1794150805491`            | `847422805491` ms                                       |
| `exo-gj-9066-c`, `spatial.positionKm.x`        | `127778167.76495498`       | `-100627910.81334293`      | `-228406078.5782979`                                    |
| `exo-gj-9066-c`, `spatial.positionKm.y`        | `26008596.173503585`       | `28706390.98458219`        | `2697794.8110786043`                                    |
| `exo-gj-9066-c`, `spatial.positionKm.z`        | `3606851.004395202`        | `-2289631.2379934536`      | `-5896482.242388655`                                    |
| `exo-gj-9066-c`, `spatial.epochMs`             | `946728000000`             | `1794150805491`            | `847422805491` ms                                       |
| Both base bodies, `updatedAt`                  | `2000-01-01T12:00:00.000Z` | `2026-11-08T15:13:25.491Z` | Valid mutable shared timestamp; not a seed-owned repair |

**Root fix:** `celestial-operations-service.js` consults the durable P6 checkpoint
before ordinary cache hits, upserts or force. Independent pure
`copper-vale-catalog-reconciliation.js` shares the P6 ownership verifier/hash
projections without importing handler context or lifecycle orchestration.
Approved P4 source replay plus exact current normal catalog output at the accepted
epoch must match checkpoint source/revision/body digests; all 57 seed-owned
readbacks must match. Only then may an absent/outdated ordinary catalog marker be
adopted, at the approved epoch. Bodies, original station, P6 journal and density
overlays are untouched. Incomplete/stale/source-changed checkpoints or corrupt
snapshots fail closed, even with an already-current marker. Force refresh is
explicitly blocked for reviewed P6 pending owner review. No fabricated source
version is inserted into P6 and no repair/apply CLI is supplied.

**Proposed repair, NOT authorized/performed:** restore only five scalar leaf
fields across the two `cb` records: star `spatial.epochMs`; planet
`spatial.epochMs` and `spatial.positionKm.{x,y,z}`, to the expected values above.
Retain both valid current `updatedAt` values (do not backdate to 2000), zero star
position, every other physical/naming/resource/source/orbital field, mutable
gameplay and unknown fields. Do not replace whole records, regenerate bodies,
rewrite P6 or reset the market. Require explicit user authorization, stopped
writers and a fresh read-only comparison/conditional exact-old-value check before
these narrowly scoped writes; if any value changed, stop for re-review.
Then verify all 57 bodies and original station/P6 before density preflight.
The separate density approval remains **five additive markets only**; names,
orbits and accepted plan digest are unchanged.

Isolated regression coverage: real normal first solar-system-get following P6
apply with no ordinary seed marker; fresh service/context restarts; 57 body/raw
record preservation including gameplay/ownership; six-market overlays and changed
stock/price preservation; exact approved source marker adoption; already-current
marker with spatial corruption; incomplete/source-mismatched journal; explicit
force refusal; pure full-body reconciliation and changed normal source refusal.
Final validation: `node --test` across 17 focused P3/P4/P6/density/catalog suites
ran **108 tests: 107 passed, 1 unrelated existing regression failed**. All six
new pure/integration tests pass. The failure is `EX-5.4a` at
`test/exoplanet-catalog-runtime.test.js:98`: its broad script-text scan rejects
the existing read-only `exoplanet-names` reference in unchanged
`scripts/non-sol-celestial-inventory.js`. No test was skipped or this unrelated
policy changed. `npm run typecheck`, scoped ESLint on all five changed/new JS
files, Swagger validation of `api/openapi.yaml`, handler-pattern checks and
contract safety startup preflight pass. No full `npm test` claim is made.

Contract: `api/openapi.yaml` and `api/openapi/solarsystem/openapi.yaml` document
P6 precedence, exact source/readback marker adoption, explicit failure/review
and force refusal; no new endpoint/event/schema. Local runtime contract is
unavailable (Forge stopped). Canonical GitHub `/main/openapi.yaml` is 404;
relocated repository `/main/api/openapi.yaml` and its SolarSystem module are
available. Parsed comparison shows only the two intentional description changes
(`/info/description`, `/paths/~1socket~1solar-system-get/post/description`).
No unexpected delivered schema drift found in available artifacts; runtime
parity remains unverified. Humans must reconcile the canonical repository URL
and verify runtime after their authorized restart, not start a server here.
Real repair and density remain blocked pending user approval and clean preflight.

### 11.1 Scope, durability and refusals

Owner explicitly authorized **isolated Mongo first**, then actual approved-five
additions to `mongodb://localhost:27017/solid-train` after clean preflight.
The parent operator runs the real target later. No reset/drop/termination,
source/cultural fields, economy redesign, body updates, or server startup is
authorized by this implementation. Other systems remain excluded.

- Implementation: `src/model/copper-vale-market-density-lifecycle.js`;
  persistent CLI: `scripts/copper-vale-persistent-density.js`.
- Revision/journal: `copper-vale-market-density-v1`, independent key
  `copper-vale-market-density-v1:exo-gj-9066` in `game_state`.
- Density plan digest:
  `3367349c32b93c622493965f9fb610cf7e7679af346e134dfaf4adb2bc204c4c`.
- Unchanged baseline P6 plan digest:
  `b8b9a82b42c57b5aa78ba330a6a632f986669bb44e5ab423e78911698304ba7f`.
  Accepted P3/P4 outputs and body checkpoints are not rewritten.
- P6 must have a completed durable journal, all 57 expected body readbacks and
  original station seed-owned fields matching. Missing/incomplete P6 stops for
  review. P6's completed dry-run/readback now validates its original scope,
  without refusing independently added markets; no P6 plan/hash change.
- Density inserts only. The journal preallocates five Mongo ObjectIds before
  market insertion; unique journal creation and sequence-conditional checkpoints
  reject stale/concurrent writers. Immutable ID/name/site/system/orbit/placement/
  spatial and seed configuration readback is required. Even a matching
  unrelated market cannot be adopted without journal ObjectId ownership.
- Existing candidates without a density checkpoint, foreign-system/duplicate
  IDs, altered immutable fields, source/plan changes, missing verified records
  or missing ownership stop for review. No silent repairs/adoption/deletion.
- After-write/before-checkpoint interruption remains `applying`. Ordinary apply
  refuses it; **explicit `resume`** verifies ownership and durable fields before
  checkpointing. Completed reruns are write-free and preserve inventory, ledger,
  ship listings, restock time, prices, unknown ownership/gameplay fields.
- Completion requires durable exact-five readback and the completed journal
  read back from Mongo. Additional unrelated/future markets are not removed.
- Shared persistent helpers provide explicit credential-free local target
  validation, confirmation and Forge-stopped checks on IPv4/IPv6 port 3000.
  Contract preflight runs before connecting. Writes probe Forge twice.
- Shared protected snapshot hashes raw BSON bytes of **all bodies**, the entire
  original station, P6 state, all unrelated collections/gameplay and all other
  markets. Only the five approved added market IDs and density journal are
  excluded. Every operation compares before/after hashes, even on interruption.
  Incomplete resume also requires the journal's initial protected baseline:
  changes to protected data between interruption and resume stop for review.
  Completed reruns use current before/after baselines so later gameplay and
  unrelated future-market additions remain allowed and are never overwritten.

### 11.2 Isolated applied evidence and validation limits

Disposable Mongo integration verifies actual additive persistence and durable
readback, not merely the absence of a drop call:

- Clean baseline 57 bodies/one station becomes 57 bodies/six markets.
- Five inserted markets: 105 inventory rows, 59,600 initial stock/cap units,
  4,755 restock units per 60-minute interval and five default ship listings.
- Clean six-market totals: 126 rows, 71,520 stock/cap, 5,706 restock units per
  interval, six default listings/ships and 36 starter-inventory units.
  Reports label these as `initialSupply`, not a promise of current mutable stock.
- Changed baseline station prices/stock, body ownership, all raw documents/P6
  state, unrelated future market and player records retain their baseline
  hashes. Added-market stock/prices/ledger/ship stock/ownership survive reruns.
- Dirty collisions, missing checkpoint/market, interrupted body baseline,
  market write-before-checkpoint/resume, replacement ObjectId, immutable/source
  tampering and protected-data changes all exercise explicit refusals.
- Temporary-target CLI validates preflight/readback, invalid input rejection
  before connecting, and the live Forge guard. Port 3000 was already listening:
  persistent CLI write roundtrips were **blocked**, and their refusal was
  asserted rather than bypassing/stopping Forge. Actual additive writes were
  validated through lifecycle calls exclusively on disposable Mongo.
- Final relevant Node tests passed (45 tests, excluding server-start tests), checkJs and scoped
  ESLint passed, and P0 preservation passed for 4,844 targets. A preexisting
  isolated-pilot test in that run transiently started its disposable transport
  server and cleaned it up; this was outside the requested no-server-start
  boundary, so it is excluded from subsequent validation. No production server
  was started or stopped and no real Mongo target was connected.
- Read-only runtime `http://localhost:3000/openapi.yaml` matches workspace
  `api/openapi.yaml` after line-ending normalization:
  `9fc98602f58812903aca24e5fbbcadbfa31db66aa15b434e0d1fd7aa3d2cffd1`.
  Root `openapi.yaml` is absent in this checkout (repository-path discrepancy);
  no API endpoint/event/schema change is needed or made. Offline contract
  baseline preflight reports zero issues. No main-plan historical edits made.

### 11.3 Exact commands for the parent, not executed on real target here

Keep Forge stopped through the whole write/readback window using the owner's
normal shutdown procedure. Do not kill/reset/drop anything as a workaround.
Run commands separately and proceed only after checking each result:

```powershell
node scripts/copper-vale-persistent-seed.js --target=mongodb://localhost:27017/solid-train --action=readback
node scripts/copper-vale-persistent-density.js --target=mongodb://localhost:27017/solid-train --action=dry-run
node scripts/copper-vale-persistent-density.js --target=mongodb://localhost:27017/solid-train --action=apply --confirm-write=exo-gj-9066
node scripts/copper-vale-persistent-density.js --target=mongodb://localhost:27017/solid-train --action=readback
node scripts/copper-vale-persistent-seed.js --target=mongodb://localhost:27017/solid-train --action=readback
```

First P6 readback must be complete. Density preflight must be `ready` (or
`verified` for a completed no-op rerun), with the exact approved digests/scope
above. Never proceed on `blocked`; retain output and ask for review. Apply and
density readback must report `complete`, the exact five verified IDs and
`protectedDataUnchanged: true`; final P6 readback remains valid with six markets.
For a genuine interrupted density apply only, review `resumable` preflight then:

```powershell
node scripts/copper-vale-persistent-density.js --target=mongodb://localhost:27017/solid-train --action=resume --confirm-write=exo-gj-9066
```

The deployment record above supersedes the earlier unexecuted-target status.
Nova should consume unchanged market contracts, honor market/site-name
distinctions (research uses the same Outpost name for both), expect six approved
markets with ordinary trading/default ship-sale capability only, and validate
navigation/availability once the parent provides the applied backend.

## 12. Bulk density expansion: offline implementation, NOT deployment approval

Owner correction, 2026-11-08: completed bulk generation did **not** complete
market expansion. The approved selectable scope is all **4,843 newly populated
non-Sol systems**, preserving Copper Vale's existing six markets. No real-target
connection/write, reset/drop, commit/push, server start/stop, ZIP, or artifact
cleanup was performed for this implementation. Forge was already running and
remains under the owner's start/stop control.

### 12.1 Deterministic authored mix and full-cohort evidence

Policy: `data/non-sol-market-density-policy-v1.json`. Hamilton allocation of
40/35/20/5 percent gives a frontier-heavy authored settlement mix, not an
observational population claim. Systems rank by SHA256(policy version, ID);
an independent hash selects an inclusive total within each profile. Targets
include the accepted initial bulk exchange; they are not counts of additions.

| Profile                  | Proportion |   Systems | Total range | Selected totals |  Additions |
| ------------------------ | ---------: | --------: | ----------: | --------------: | ---------: |
| Frontier                 |        40% |     1,937 |         1–2 |           2,908 |        971 |
| Developing               |        35% |     1,695 |         3–5 |           6,818 |      5,123 |
| Established              |        20% |       969 |         6–9 |           7,263 |      6,294 |
| Major trade center       |         5% |       242 |       10–16 |           3,167 |      2,925 |
| **Bulk-artifact cohort** |   **100%** | **4,843** |             |      **20,156** | **15,313** |

Final offline report:
`artifacts/non-sol-market-density-v1-final/offline-report.json`
(absolute path in this workspace:
`C:\Development\Projects\Github\solid-train\artifacts\non-sol-market-density-v1-final\offline-report.json`).
All 4,843 systems have deterministic per-system plans, valid runtime Market
documents and **zero placement shortfalls against the accepted bulk-artifact
baseline**. The report includes target histogram, profile totals, rejected
attempts per plan, supply by item, source-migration candidate and artifact hashes.
An earlier unapproved density candidate remains intact; it is not the final
delivery. Do not remove accepted generation artifacts.

**Important baseline-reconciliation hold, not deployment readiness:** the
preserved inventory manifest also identifies `ac-proxima-station`,
`ac-belt-01` (Alpha Centauri), and `bs-main-station` (Barnard). These are outside
the accepted one-exchange bulk artifacts. Their presence on a target causes a
full-cohort density preflight refusal, before any density checkpoint/write.
Alpha would already have three preserved markets versus its selected frontier
target of two; its dust-belt market has an unresolved anchor in the manifest.
Barnard's selected target is eight, but its extra baseline market must be
included in count/clearance reconciliation. `baselineReconciliationHolds` in the
report records both systems explicitly. Do **not** remove old markets, silently
exceed profile totals, or adopt unresolved geometry to clear this hold. The
owner must approve a baseline-aware density-plan revision and fresh full
receipts for such a target. Existing accepted generation plans stay immutable.
Thus 20,156 is the **accepted bulk-artifact cohort target**, not a claim about
the total live universe or a ready-to-apply plan on the current target.

### 12.2 Physical placement and unchanged economy

Bounded search tries generated planetary hosts in accepted artifact order,
then fully specified catalog-planet hosts. No catalog-host missing mass/radius
is invented. The existing Copper Vale circular-orbit screen requires:

- At least 1,000 km surface clearance; radius at most 0.1 periapsis Hill radius.
- At least 1,000 km from moon envelopes including moon physical radius, rings,
  and every previously accepted same-host station orbit, at all phases.
- Different-host stations must share a primary and have disjoint conservative
  primary-centered Kepler radial envelopes with at least 1,000 km clearance.
- Unknown geometry or exhausted bounded search produces an explicit `hold`
  and numerical shortfall, never a silently reduced target.

Existing generation assumptions remain explicit (including screening-only
stellar analogs); this is analytic screening, not N-body certification.
All candidates retain canonical inventory and default ship listings. General
Trade, Logistics Supply, Ship Sales and Research labels are descriptive only:
**no research, repair, refit, logistics service or unlock mechanics**.

| Canonical initial supply                        | Accepted bulk baseline | Proposed additions | Combined cohort |
| ----------------------------------------------- | ---------------------: | -----------------: | --------------: |
| Markets / default ship listings / initial ships |                  4,843 |             15,313 |          20,156 |
| Inventory rows (21 per market)                  |                101,703 |            321,573 |         423,276 |
| Stock units / stock capacity                    |             57,728,560 |        182,530,960 |     240,259,520 |
| Restock units per 60 minutes                    |              4,605,693 |         14,562,663 |      19,168,356 |
| Ship starter-inventory units                    |                 29,058 |             91,878 |         120,936 |

Per new market: 11,920 stock/capacity, 951 maximum replenishment units/hour,
one Scavenger Pod listing (tier 1, price 500), six starter-inventory units.
Restock is capped by capacity; ships are initial listings, **not hourly ship
production**. These figures exclude Copper Vale, Sol, the three non-bulk
baseline markets above, and all live stock evolution. No existing inventory,
ledger, ownership, price, timestamp, ship listing or gameplay field is reset.

### 12.3 Lifecycle, exact ownership and broad source-guard migration

Entry point: `scripts/non-sol-market-density.js`; plan and lifecycle modules
are `scripts/lib/non-sol-market-density-{plan,lifecycle}.js`. Preparation never
opens Mongo. Persistent preflight requires completed, verified bulk generation.
Apply journals exact owned IDs before insertion; inserts use `$setOnInsert`
only. Interrupted work requires a fresh full receipt and explicit resume.
Completed missing markets or immutable identity/placement tampering fail closed.
Pre-existing raw BSON documents across collections are fingerprinted around
apply; only exact newly missing IDs and density checkpoint keys are excluded.
Replay preserves evolved inventory/ledger/ship state.

Bulk readback and normal lazy-seed tolerate exact checkpoint-owned density
markets, without a broad prefix whitelist or weaker bulk body/initial-market
checks. Force catalog reseeding remains refused. There is **no new startup
step/check, bootstrap abstraction or automatic bulk/density seeding**.
Normal server startup still only baseline-seeds Sol/Alpha/Barnard.

Adding these files changes the generation artifact's broad source guard.
`artifacts/non-sol-bulk-v1-delivery` remains untouched, including its original
plans, hash-chain journal, header and deployed checkpoints. Neither re-run
bulk `prepare` into that directory nor rewrite its old guard.

The explicit migration gate is `--approve-source=<migration hash>` on both
bulk and density persistent CLIs, including read-only target preflight.
It authorizes exactly the tuple in the final report's `sourceMigration`:
old source guard, current source guard, accepted journal's final chain hash.
The hash alone is **not** evidence of owner authorization. A human must review
the source delta against the accepted deployed source, approve this tuple,
and record that decision before using the flag. Any further guarded-source or
accepted-input change invalidates it. No checkpoint is migrated/rehashed, and
the old source hash is never silently accepted. If accepted-source provenance
cannot be reviewed, keep this gate blocked; do not generate replacement plans.

Final offline evidence, independently revalidated after the last source change:

- Report SHA256: `ddb35b5524e987a3ff5029357f5810f4a2ec51519fd5ffa6adbba0e6048a92fa`
- Old generation guard: `6e51ce5b2abe35c19e13f5b5979c0182cd7c6d5d0bb74932132ac3a1be5705e0`
- Current guard: `91e04b053f791a122ef444c5a9c9de783c4f020f56c40149e9e56266664685aa`
- Accepted journal tail: `496623c8d83ec0a7404527a5fff9a19148d8d82c9828ee640e54f5a77050e07c`
- Migration **candidate, NOT owner approval**:
  `fd5600e94b1e7137be5e3cdd8f677025c063a0ce11cf0f15f34f43c7cc63123b`

Independent offline checks verified all 4,843 density plan checksums and the
accepted full cohort, confirmed absent/wrong migration authorization refuses,
and validated the exact candidate gate without connecting to any target.

### 12.4 Reproducible explicit CLI sequence for another developer database

These are operator instructions, **not commands executed on the real target
for this work**. Use the reviewed source tree and extract the final accepted
generation plans and final density plans into the paths below (ZIP packaging
is deferred to the parent). Hashes bind content, not the extraction directory;
do not regenerate deployed generation artifacts. Set a credential-free,
explicit **local** Mongo host, port and database; remote URIs are refused.
Use a different local database name for another developer environment.

Keep Forge and all other writers stopped throughout write/receipt/readback
windows using the owner's normal shutdown procedure; these CLIs never stop
Forge for you. Read-only dry-run itself does not require stopping Forge, but
any subsequent target change invalidates the approval receipt. Never use a
reset/drop/delete or a source-guard edit to make preflight pass.

```powershell
$target = 'mongodb://localhost:27017/solid-train-dev'
$bulk = 'artifacts/non-sol-bulk-v1-delivery'
$density = 'artifacts/non-sol-market-density-v1-final'
# ONLY after explicit source-migration review/authorization:
$sourceApproval = (Get-Content "$density/offline-report.json" -Raw | ConvertFrom-Json).sourceMigrationApprovalSha256

# 1. Bulk generation: full read-only target receipt, human approval, apply, readback.
node scripts/non-sol-bulk-seed.js --action=dry-run "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval"
# STOP: inspect all systems, blocked reasons and protected fingerprint.
# Owner must approve THIS target receipt; do not reuse another DB's approval.
$bulkApproval = (Get-Content "$bulk/target-dry-run.json" -Raw | ConvertFrom-Json).approvalSha256
node scripts/non-sol-bulk-seed.js --action=apply "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval" "--approve=$bulkApproval"
node scripts/non-sol-bulk-seed.js --action=readback "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval"

# 2. Density: separate full read-only target receipt, human approval, apply, readback.
node scripts/non-sol-market-density.js --action=dry-run "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval"
# STOP: inspect all 4,843 results. Any Alpha/Barnard baseline hold or other block
# requires owner-reviewed plan reconciliation; DO NOT continue to apply.
$densityApproval = (Get-Content "$density/target-dry-run.json" -Raw | ConvertFrom-Json).approvalSha256
node scripts/non-sol-market-density.js --action=apply "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval" "--approve=$densityApproval"
node scripts/non-sol-market-density.js --action=readback "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval"
node scripts/non-sol-bulk-seed.js --action=readback "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval"
```

Only proceed after each command succeeds. Any blocked result prevents **all**
cohort writes, including when a receipt hash exists. Each receipt includes the
explicit target URI, full cohort status/missing IDs, report/source hash and
whole-database fingerprint. Use one operator per output directory; target
receipts are overwritten by the next dry-run. For interruption, run that
stage's full `--action=dry-run` again, obtain a **new owner approval**, then use
the same apply command with `--action=resume` and the new receipt hash.
Never reuse the pre-interruption receipt. Finish that stage's readback before
proceeding. Read-only commands need no `--approve` write flag.

For **offline reproduction only**, without Mongo or any deployment approval:

```powershell
node --no-warnings scripts/non-sol-market-density.js --action=prepare --input=artifacts/non-sol-bulk-v1-delivery --out=artifacts/non-sol-market-density-reproduction
```

Changing the checkout's source invalidates the final report/source authorization;
produce a separate unapproved offline density report, review the delta and
obtain fresh approvals. Never overwrite accepted bulk plans to clear a mismatch.

**Copper Vale is separate.** Generic bulk preparation/apply explicitly skips
`exo-gj-9066`, and density preserves/skips it as well. The generic sequence is
not a full-universe/Copper Vale setup. If this dev database needs Copper Vale,
run its separately authorized sequence before bulk, or confirm its P6 and
six-market readbacks if already applied:

```powershell
node scripts/copper-vale-persistent-seed.js "--target=$target" --action=dry-run
# Only after ready preflight and separate P6 authorization:
node scripts/copper-vale-persistent-seed.js "--target=$target" --action=apply --confirm-write=exo-gj-9066
node scripts/copper-vale-persistent-seed.js "--target=$target" --action=readback
node scripts/copper-vale-persistent-density.js "--target=$target" --action=dry-run
# Only after ready preflight and separate exact-five density authorization:
node scripts/copper-vale-persistent-density.js "--target=$target" --action=apply --confirm-write=exo-gj-9066
node scripts/copper-vale-persistent-density.js "--target=$target" --action=readback
node scripts/copper-vale-persistent-seed.js "--target=$target" --action=readback
```

For genuine interrupted Copper Vale stages, require `resumable` dry-run and
separate authorization, then replace only that stage's `apply` with `resume`.
Do not use the generic bulk receipt as Copper Vale approval.

### 12.5 Validation and Nova handoff

- Final scoped Node regression command (58 passing, no failures):
  `node --no-warnings --test --test-concurrency=1 test/non-sol-market-density.test.js test/non-sol-market-density.mongo.integration.test.js test/non-sol-bulk.test.js test/non-sol-bulk.mongo.integration.test.js test/copper-vale-market-density-preview.test.js test/copper-vale-market-density-lifecycle.mongo.integration.test.js test/copper-vale-catalog-reconciliation.test.js test/copper-vale-catalog-interoperability.mongo.integration.test.js test/copper-vale-seed-lifecycle.mongo.integration.test.js test/copper-vale-persistent-density.test.js test/copper-vale-persistent-seed.test.js`
- Disposable Mongo only: interruption/resume, collision/geometry/count refusal,
  baseline/all-gameplay preservation, evolved new-market stock/ships surviving
  replay, bulk readback and ordinary lazy-seed with exact density checkpoints.
  Existing Copper Vale CLI tests observed live Forge and validated write
  refusal; no real target connection or server stop was used.
- `npm run typecheck` and scoped ESLint passed. OpenAPI validation:
  `npx --yes @apidevtools/swagger-cli validate api/openapi.yaml` passed.
  An earlier unscoped `swagger-cli --no-install` package lookup was unavailable;
  the repository's scoped validator above succeeded.
- `node scripts/non-sol-celestial-inventory.js --check-preservation` passed for
  4,844 manifest targets, preserving Sol/P0 and accepted Copper Vale outputs.
  Accepted generation artifacts are checksum-verified on every offline pass.
- `api/openapi.yaml` and `api/openapi/solarsystem/openapi.yaml` receive additive
  descriptions of density retention/exact-checkpoint drift refusal. No new
  endpoint/event/schema. Runtime `http://localhost:3000/openapi.yaml` exactly
  matched the workspace API document; approved repository contract-artifact
  comparison reported zero compatibility issues. Root `openapi.yaml` remains
  absent (existing repository-path discrepancy); no unexpected drift was fixed.
- Nova should pull the contract descriptions, retain market/site-name
  distinctions, expect ordinary complete inventories/ship listings at each
  addition, and not infer research/repair mechanics from names. Actual live
  counts remain unchanged until owner-approved deployment and readback.

**Stopped before persistent apply.** Next human actions: review known
Alpha/Barnard baseline holds and source migration, approve a reconciled offline
scope if needed, run full target preflight, then explicitly approve the exact
target receipt. Parent owns main-plan decision recording and later packaging.

## 13. Reconciled v2: Alpha/Barnard actual-baseline overrides

This section supersedes Section 12's proposed v1 deployment, generic
Alpha/Barnard holds, counts, paths and source-migration candidate. Earlier
evidence remains historical; redundant loose candidate artifacts are removed only
after final archive verification (main plan Section 26.6). Accepted generation
delivery is **unchanged**.
Owner-authorized correction: preserve **all** existing markets, count them
toward totals, promote Alpha to developing/three total with zero additions,
and keep Barnard established/eight total with six additions.

### 13.1 Focused real-target inspection — read-only

Focused Mongo `find`/count/hash queries (not either persistent CLI preflight)
inspected `mongodb://localhost:27017/solid-train` with Forge still running.
No target writes, source-approval bypass, server start/stop, resets or cleanup.
Evidence: `data/non-sol-market-density-baseline-v2.json`, inspection
`2026-11-09T00:15:10.127Z`. A subsequent focused read-only verification matched
all five raw market-document BSON hashes, identities and baseline counts.
No inventory, ledger or credentials are exported; only immutable market
identity/placement snapshots, aggregate supply and document hashes.

| System         | Actual preserved IDs                                                       | Existing | V2 target | Additions |
| -------------- | -------------------------------------------------------------------------- | -------: | --------: | --------: |
| Alpha Centauri | `ac-belt-01`, `ac-proxima-station`, `alpha-centauri-bulk-initial-exchange` |        3 |         3 |     **0** |
| Barnard        | `bs-main-station`, `barnards-star-bulk-initial-exchange`                   |        2 |         8 |     **6** |

These are exact, versioned baseline constraints, **not an ID-prefix whitelist**.
Unknown extra markets, missing expected legacy records, duplicate global IDs,
changed identity/geometry or applied v1 density checkpoints refuse before
insertion. Raw stock/ledger/ship/gameplay data remain unrestricted and unchanged
by density. V2 readback/lazy-seed also verifies the exact legacy identities.
No ownership of these legacy documents is transferred to the density writer.

### 13.2 Exact legacy defects, no silent geometry certification

The inspection resolved the earlier _generic_ holds but confirmed real defects
in the existing baseline. They are reported in every relevant system plan and
the final report's `legacyGeometryFindings`, not silently treated as valid:

1. **`ac-belt-01`:** missing persisted `ac-dust-belt` anchor. Its stated local
   ellipse has axis 5,500 km, eccentricity 0.14; its reference center and
   overlap with other Alpha markets cannot be certified. **Alpha has no new
   markets**, so no additive orbit is accepted against this unknown envelope.
2. **`ac-proxima-station`:** Proxima radius 107,276.94 km; existing local ellipse
   3,136–3,264 km. Periapsis surface clearance **−104,140.94 km**. Preserved
   exactly; no Alpha addition, claim of validity, orbit repair or field rewrite.
3. **`bs-main-station`:** Barnard b radius 4,587.12 km; existing local ellipse
   2,716–2,884 km. Periapsis surface clearance **−1,871.12 km**. Preserved exactly.
   The existing defect is not a new station placement approval.

All six new Barnard markets are screened against **both** existing markets and
all earlier additions. The legacy station's full elliptical apses are included
in a conservative common-primary all-phase radial envelope:
**3,320,133.5018590996–3,531,448.9762009 km** around the primary. Minimum
new-to-legacy envelope separation across the six candidates is
**169,665,603.71047616 km**, far above 1,000 km. Same-anchor comparisons use the
entire periapsis–apoapsis interval, not a circular/axis-only approximation.
New markets still pass surface/Hill/moon/ring/other-station screens.

Unknown geometry would still block any _new_ placement; there is no blanket
exception. Existing unresolved Alpha overlap is disclosed, with zero additions,
under the owner's explicit preserve-all/three-total instruction. Correcting
legacy orbital defects is a separate future owner decision, not part of this
additive pass.

### 13.3 Full-cohort v2 plan and recomputed supply

Policy: `data/non-sol-market-density-policy-v2.json`. Retain the v1 Hamilton
40/35/20/5 settlement assignment and its hash seed, except the explicit Alpha
promotion; do not reshuffle 4,842 other systems merely because the policy
version changes. Barnard retains its original eight-total profile, now counting
the inspected second baseline market.

| Profile            |   Systems | Preserved baseline markets | Selected totals |  Additions |
| ------------------ | --------: | -------------------------: | --------------: | ---------: |
| Frontier           |     1,936 |                      1,936 |           2,906 |        970 |
| Developing         |     1,696 |                      1,698 |           6,821 |      5,123 |
| Established        |       969 |                        970 |           7,263 |      6,293 |
| Major trade center |       242 |                        242 |           3,167 |      2,925 |
| **Total**          | **4,843** |                  **4,846** |      **20,157** | **15,311** |

**Zero placement holds, zero baseline-reconciliation holds, zero shortfalls.**
The three existing geometry findings above remain explicit disclosures, not
repaired defects. Copper Vale's six markets are excluded/preserved; Sol is
excluded. Total universe market count is not asserted.

| Canonical supply                                | Preserved cohort baseline | Proposed additions | Combined cohort |
| ----------------------------------------------- | ------------------------: | -----------------: | --------------: |
| Markets / default ship listings / initial ships |                     4,846 |             15,311 |          20,157 |
| Inventory rows                                  |                   101,766 |            321,531 |         423,297 |
| Stock units / stock capacity                    |                57,764,320 |        182,507,120 |     240,271,440 |
| Restock units per 60 minutes                    |                 4,608,546 |         14,560,761 |      19,169,307 |
| Ship starter-inventory units                    |                    29,076 |             91,866 |         120,942 |

The three inspected legacy markets had canonical aggregate stock at inspection:
35,760 units/capacity, 63 inventory rows, 2,853 restock units/hour, three ships.
Existing gameplay may evolve; baseline figures are not a promise of current
live stock. Proposed additions retain 21 inventory rows/11,920 stock/951
restock units per hour/one initial Scavenger Pod each. Restock is capacity-capped;
no automatic hourly ship production, research, repair or other new services.

New immutable evidence directories/files:

- Final report: `artifacts/non-sol-market-density-v2/offline-report.json`
- Per-system v2 plans: same directory, `<systemId>.json`
- Semantic generation replay: same directory, `semantic-replay.json`
- V1 candidate/final directories and
  `artifacts/non-sol-bulk-v1-delivery` were **not overwritten or cleaned**.

Absolute final report path:
`C:\Development\Projects\Github\solid-train\artifacts\non-sol-market-density-v2\offline-report.json`

### 13.4 Exact source migration and semantic replay proof

The changed source guard is intentional, but **not automatically approved**.
No accepted generation hash, journal, plan or deployed checkpoint was rewritten.
The offline semantic replay regenerated each accepted generation plan in the
original cumulative naming order/options, then required exact payload equality
and identical original `planSha256`, not just equal body counts. All **4,843**
plans matched, including physical/orbit/naming/resource/market fields.
Pilot P3/P4/P6 hashes exactly matched the accepted generation header as well.
The replay report records per-system plan/body/naming/market hashes.

| Evidence                                     | SHA256                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Accepted old source guard                    | `6e51ce5b2abe35c19e13f5b5979c0182cd7c6d5d0bb74932132ac3a1be5705e0` |
| Current reviewed candidate source guard      | `7ac8b1dfa0461a7e09257c62ac8960e236d767a9265d9e88a68e4d072444fb4b` |
| Unchanged accepted journal tail              | `496623c8d83ec0a7404527a5fff9a19148d8d82c9828ee640e54f5a77050e07c` |
| Semantic replay report                       | `9f5434f45b190cefdc743a10cf30ae39adc46b940fec1dc36cf32b7aba49c3f3` |
| V2 offline report                            | `9b463713ee28c13ac6f68cbccca58b9a21a32ecb52f21eb78e586442a4ba0501` |
| Source migration **candidate, not approval** | `b35bffe0e0c1bd28208388d80789f42d3b1b44e684b1a9b19a2557073df8600f` |

Explicit owner approval form:

> Approve source migration candidate
> `b35bffe0e0c1bd28208388d80789f42d3b1b44e684b1a9b19a2557073df8600f`,
> old/new source guards and accepted journal tail above, with exact 4,843-plan
> semantic replay and preserved pilot outputs. Authorize read-only full-target
> preflight for density v2. This does **not** authorize persistent apply;
> approve the resulting exact target receipt separately.

The existing preserve-all Alpha/Barnard instruction authorizes the policy
overrides, not this source migration or a future database-write receipt.
No persistent target dry-run was executed pending that source approval.
Semantic replay proves unchanged **generation semantics**; it does not
certify legacy market geometry, accept arbitrary source deltas, or replace
review of the new density code. Any further guarded-source change requires
a fresh semantic replay/offline report/source approval.

### 13.5 Reproducible v2 preparation and exact operator deployment sequence

No new startup step/check/automatic seeding. Forge baseline startup remains
Sol/Alpha/Barnard only. The existing explicit CLI sequence is sufficient.
The [main plan's delivery section](./seed-non-Sol-systems-2026-11-07.md#266-final-artifact-cleanup-and-archive)
records final ZIP verification, cleanup, extraction and reusable monthly/quarterly
packaging commands. For
another developer, extract the reviewed generation delivery and **v2** density
delivery with its semantic replay report; do not regenerate/overwrite deployed
generation plans, old evidence, or target baseline snapshots to pass a guard.

Offline reproduction (no Mongo connection, no migration approval needed):

```powershell
node --no-warnings scripts/non-sol-market-density-replay.js --input=artifacts/non-sol-bulk-v1-delivery --out=artifacts/non-sol-market-density-v2-reproduction
node --no-warnings scripts/non-sol-market-density.js --action=prepare --version=v2 --input=artifacts/non-sol-bulk-v1-delivery --out=artifacts/non-sol-market-density-v2-reproduction
```

Operator commands below are **not executed here**. Run separately and inspect
every result. Keep Forge and other database writers stopped during writes and
the receipt/apply/readback window, using the owner's normal shutdown procedure;
the implementation never stops Forge. No reset/drop or forced hash acceptance.
The source-approval flag is mandatory even for persistent read-only preflight.

```powershell
$target = 'mongodb://localhost:27017/solid-train'
# Other dev DB: use an explicit local URI, e.g.
# $target = 'mongodb://localhost:27017/solid-train-dev'
$bulk = 'artifacts/non-sol-bulk-v1-delivery'
$density = 'artifacts/non-sol-market-density-v2'

# ONLY after the owner accepts the source migration form in 13.4:
$sourceApproval = 'b35bffe0e0c1bd28208388d80789f42d3b1b44e684b1a9b19a2557073df8600f'

# A. Generic generation (skips/preserves Copper Vale).
node scripts/non-sol-bulk-seed.js --action=dry-run "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval"
# STOP: review full cohort, no blocked systems, fingerprint; obtain target approval.
$bulkApproval = (Get-Content "$bulk/target-dry-run.json" -Raw | ConvertFrom-Json).approvalSha256
# For a new dev target only, after explicit approval and Forge stopped:
node scripts/non-sol-bulk-seed.js --action=apply "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval" "--approve=$bulkApproval"
node scripts/non-sol-bulk-seed.js --action=readback "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval"

# B. Reconciled density v2.
node scripts/non-sol-market-density.js --action=dry-run --version=v2 "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval"
# STOP: inspect all 4,843 results, Alpha 3 existing/0 missing, Barnard 2 existing/6
# missing, complete bulk baseline, exact legacy identities, no blocked systems.
# Obtain explicit owner approval of THIS full-target approvalSha256.
$densityApproval = (Get-Content "$density/target-dry-run.json" -Raw | ConvertFrom-Json).approvalSha256
node scripts/non-sol-market-density.js --action=apply --version=v2 "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval" "--approve=$densityApproval"
node scripts/non-sol-market-density.js --action=readback --version=v2 "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval"
node scripts/non-sol-bulk-seed.js --action=readback "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval"
```

`scripts\run-non-sol-bulk-seed.ps1` runs both the bulk and density-v2 market
stages. It requires the already prepared/reviewed density offline artifacts
(`offline-report.json` and `semantic-replay.json`) in the density output
directory, defaulting to `artifacts\non-sol-market-density-v2`:

```powershell
.\scripts\run-non-sol-bulk-seed.ps1 -Target 'mongodb://localhost:27017/solid-train-dev'
# If bulk already passed its full readback, start at the market stage:
.\scripts\run-non-sol-bulk-seed.ps1 -Target 'mongodb://localhost:27017/solid-train-dev' -MarketsOnly
# Optional artifact directory overrides:
.\scripts\run-non-sol-bulk-seed.ps1 -Target 'mongodb://localhost:27017/solid-train-dev' `
  -Bulk 'artifacts\non-sol-bulk-v1-delivery' -Density 'artifacts\non-sol-market-density-v2'
```

The runner resolves relative artifact paths from the repository root and uses
absolute script paths, so PowerShell's process working directory cannot redirect
them to `C:\Windows\System32`. If the archive was extracted one level too deep,
it also detects `artifacts\artifacts\...` and reports the selected directories.

If the archived density report has an older source guard, the runner preserves
it and creates a sibling directory suffixed with `-source-<current guard>`.
It runs exact generation semantic replay and density-v2 offline preparation
there before target preflight. A completed offline report in that directory is
reused and validated by the existing density CLI; a partial preparation can be
rerun. `-MarketsOnly` skips the initial bulk deployment/readback, but density
preflight still requires complete bulk checkpoints and the final bulk readback
still runs. If source changes require a new migration hash, the runner displays
the replay-verified candidate and accepts `APPLY` to supply it automatically;
no source or target receipt hash needs to be copied.

The accepted old source guard
`6e51ce5b2abe35c19e13f5b5979c0182cd7c6d5d0bb74932132ac3a1be5705e0` is **not**
the `--approve-source` value. The wrapper defaults to the owner-authorized migration
hash `1ad335a985c782e2b7c6acc13e4feeea38094b6af9e6967303b08c4a6ad720fe`.
It reads each fresh dry-run receipt and passes its hash directly to the matching
apply command; no receipt hash needs to be copied. After reviewing the complete
bulk report, enter `APPLY` for new bulk writes or `READBACK` if bulk is already
complete. It then performs the density-v2 full-target market dry-run, requires
all 4,843 results with no blocked systems, and asks separately for `APPLY` or
`READBACK` for density markets. It finishes with density readback and a second
bulk readback. The target must meet the Copper Vale and Alpha/Barnard baseline
prerequisites above; a blocked or mismatched target stops before market writes.

For a new environment lacking the three legacy Alpha/Barnard markets, the
runner now invokes `scripts\non-sol-density-baseline-seed.js` before density
preflight. It checks all three globally by exact ID/identity/placement and
offers `APPLY` to insert only missing baseline markets. Payloads use canonical
initial inventory, empty ledgers and default ship listings; this is not a copy
of the other database's live economy. Existing markets and other database
documents remain unchanged. The helper uses a fresh fingerprint-bound receipt,
the existing local-target/source/artifact checks, stopped-writer checks and
independent readback. No hash copying is required.

Existing canonical baseline markets may have different snapshot times and
positions in a new environment. The initial preflight accepts those snapshot
differences only when identity, anchors, orbital dimensions and phase elements
still match the delivered baseline. Station orbit epochs remain fixed; the
free-floating belt's orbit epoch must match its snapshot epoch. Snapshot
positions must be finite and epoch values valid. All-phase density clearance
screens use the unchanged orbital envelopes, not snapshot positions.
The density checkpoint captures the target's exact baseline identity/placement
and subsequent readback/resume refuses any change to it. Target-receipt
fingerprints also prevent changes between dry-run and apply.

This intentionally restores the delivered legacy placements, including the
known invalid/unknown geometry in the baseline evidence; it does not repair or
certify them. A present but different/duplicate baseline still refuses without
inserting any missing baseline markets. Copper Vale is still a separate
prerequisite. Run with `-MarketsOnly` when bulk readback already succeeded.

On the current already-completed bulk target, stage A needs its full dry-run
and readback but **no bulk apply**. For genuine interruptions at either stage,
rerun that stage's full target dry-run, review all results, obtain a **new**
receipt approval, then substitute `--action=resume` for that stage's apply
command with the new hash. Do not reuse the original receipt. Keep one operator
per artifact directory; a target dry-run replaces that directory's target receipt.
Full-database fingerprint changes invalidate approval; no receipt is portable
between target URIs.

**Cross-environment baseline prerequisite:** this v2 delivery expects the exact
three inspected legacy market identity/placement snapshots (not their stocks).
A dev DB with different lazy-seed snapshot epochs/geometry or additional
markets will refuse. The runner can insert missing legacy markets from the
exact delivered snapshots as described above. Do not rewrite live markets,
baseline JSON or old accepted artifacts to force a match. Capture focused
read-only evidence there, prepare a **new versioned, owner-reviewed baseline
snapshot/density revision**, then obtain its source migration and target
receipt approvals. The generic CLIs deliberately do not invent, reset or adopt
unknown existing markets. Generation plans remain portable and unchanged;
target-specific density geometry must be verified, not assumed portable.

Copper Vale remains a **separate prerequisite/sequence**, never included in
generic bulk/density setup. If already deployed, separately read back both P6
and exact-five density. If needed on another dev DB, use Section 12.4's explicit
`copper-vale-persistent-seed.js` dry-run → separately authorized apply/resume →
readback, followed by `copper-vale-persistent-density.js` dry-run → separately
authorized exact-five apply/resume → readback. Their confirmation remains
`--confirm-write=exo-gj-9066`, not a generic bulk receipt. Perform this before
stage A so subsequent full-target fingerprints include Copper Vale unchanged.

### 13.6 Validation and handoff status

- Final combined Node validation: **67/67 passed, zero failures**:
  `node --no-warnings --test --test-concurrency=1 test/non-sol-market-density-v2.test.js test/non-sol-market-density-v2.mongo.integration.test.js test/non-sol-market-density.test.js test/non-sol-market-density.mongo.integration.test.js test/non-sol-bulk.test.js test/non-sol-bulk.mongo.integration.test.js test/copper-vale-market-density-preview.test.js test/copper-vale-market-density-lifecycle.mongo.integration.test.js test/copper-vale-catalog-reconciliation.test.js test/copper-vale-catalog-interoperability.mongo.integration.test.js test/copper-vale-seed-lifecycle.mongo.integration.test.js test/copper-vale-persistent-density.test.js test/copper-vale-persistent-seed.test.js`
- V1/v2 focused unit and isolated Mongo regressions passed, including Alpha's
  zero-addition journal/readback and Barnard interruption/resume with six new
  markets. Whole pre-existing-document fingerprints, changed stocks/ledgers,
  empty ship listings and custom gameplay survive apply/replay/lazy-seed.
- Tests explicitly reject changed/missing legacy geometry and unknown peer
  anchors; elliptical peers use their full radial interval.
- Bulk/Copper Vale regressions passed (42 tests in that validation run);
  `npm run typecheck`, scoped ESLint, OpenAPI validation and 4,844-target source/
  pilot preservation passed. Full 4,843-generation semantic replay and full
  4,843-system v2 offline density pass succeeded with no mismatches/shortfalls.
- Independent offline final-delivery validation rechecked all 4,843 plan/report
  hashes, exact cohort allocation, 15,311 additions/20,157 selected totals, and
  current source guard. Missing source authorization was explicitly refused.
  The migration candidate was exercised **offline only** to validate artifact
  parsing; it was not treated as human approval or used for a target preflight.
- API descriptions updated in `api/openapi.yaml` and the SolarSystem module;
  no endpoint/event/schema changes. Runtime `/openapi.yaml` matched workspace
  exactly; approved repository artifact comparison had zero compatibility issues.
  Root `openapi.yaml` remains absent (existing path discrepancy).
- Nova: pull updated descriptions; expect Alpha three preserved markets and
  Barnard eight only **after authorized deployment/readback**. Existing geometry
  findings are backend disclosures, not frontend correction instructions.
  Full ordinary inventory/default ship sales remain; no research/repair mechanics.

**Subsequent parent execution and owner validation:** The owner explicitly
approved the source migration and then persistent deployment after the
full-target preflight passed. Density apply completed; independent density
readback verified all 4,843 systems with existing data unchanged, and separate
generation readback verified all 4,843 with protected data unchanged. The owner
confirmed successful Nova market validation on 2026-11-08. Deployment gates
are complete for this target. Subsequent CI remediation passed locally
(850/850 tests and coverage thresholds); the historical remote action awaits
submission/rerun. Final delivery, reproducibility and formatting/source-guard
compatibility evidence are recorded in the main plan's Section 26.6.
Approval receipts and deployment details are recorded in the main plan,
Section 26.4; they are not reusable authorization for another environment.
