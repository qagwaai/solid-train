# Non-Sol celestial seeding and naming plan

Date: 2026-11-07

Status: **P0 accepted; P1 implemented and awaiting owner validation.** P2-P7 remain
planning-only. The direction below incorporates the initial user question forms
and implementation-startup decisions. P1 adds optional backend contracts and
ownership safeguards, not new bodies, names, stations, or deployment records.
The offline P0 manifest is explicitly pending
and runtime-disabled. Pilot approval and bulk activation are separate future gates.

Implementation owner: Forge for backend generation, persistence, and contracts;
Forge owns the authoritative backend tech-tree definition. Nova consumes the
completed definition; its local development integration is validated at the
appropriate checkpoints. The universe owner approves the pilot,
bulk activation, and any additional black-hole system.

Working agreement: implement one major phase at a time, provide exact validation
commands and expected results, then pause for owner validation before proceeding.
Keep Prettier out of the normal edit/test cycle; run it on changed files only at
major-phase completion. Automated persistence checks use isolated test databases,
never the owner's live/development data.

## 1. Agreed direction

- Lean toward scientific realism, with explicitly recorded artistic license for
  interesting destinations and gameplay. Do not present invented bodies or
  estimated properties as confirmed discoveries.
- Cover every registered system except Sol, including exoplanet-catalog systems,
  HYG/procedural systems, and the curated Alpha Centauri and Cygnus X-1 systems.
  Preserve their existing bodies and identities; supplement rather than replace.
- Consider planets, moons, dwarf planets, asteroid populations and representative
  asteroids, comet populations and representative comets, and rings. Inclusion in
  scope does **not** require every system to contain every category.
- Every system needs at least one station and at least a sparse mineable asteroid
  population. Abundance, composition, accessibility, hazards, and economic value
  may vary widely. An asteroid population need not form a conspicuous belt.
- Usually place stations around a suitable larger body. Also allow Lagrange-region,
  stellar-orbit, and deep-space placements rather than inventing a large body just
  to host a station.
- Name all planets and dwarf planets, moons with diameter **at least 200 km**, and
  smaller bodies when story-significant. A systematic label may be the complete
  assigned name; not every eligible body needs a new poetic name.
- Body naming mostly follows the system's cultural profile, with a **60% inherited /
  40% narrative-exception target**. No deviation review is required merely because
  a small or unusual system differs from that target.
- Use the existing naming proportions for **system cultural profiles**, not forced
  percentages across individual bodies. Report body-level proportions without
  reshuffling names to meet them.
- Review a representative pilot, then seek bulk authorization with an exception
  queue. This is not authorization to publish an unreviewed pilot or bulk batch.
- Keep Cygnus X-1; allow **at most one additional, individually reviewed black-hole
  system**. Do not distribute black holes randomly through the catalog.
- Support discovery across many systems, possible artifact-search arcs,
  market-driven mining, and character development tied to the current tech tree.
  Major story themes remain open; do not invent a fixed story arc or new tech tree.
- Do not optimize or cap generation for performance yet. Preserve current request
  limits; later Nova contracts can provide selective fetching.

## 2. Verified starting point

Read-only Node inspection of the checked-in registry and body/market generators on
2026-11-07 produced the following counts. These are **local seed outputs**, not a
census of the live database, discovered objects, or a paginated Nova view.
The exoplanet-system snapshot is dated 2026-11-01.

| Inventory                                                  |     Current value |
| ---------------------------------------------------------- | ----------------: |
| Registered systems, including Sol                          |             4,845 |
| Non-Sol target systems                                     |             4,844 |
| Registry sources: curated / procedural / exoplanet-catalog |     3 / 4 / 4,838 |
| Non-Sol stars / planets / black holes                      | 5,331 / 6,456 / 1 |
| Non-Sol seeded moons / dwarf planets / asteroids / comets  |     0 / 0 / 0 / 0 |
| Non-Sol systems with a currently seeded station            |                 2 |
| System name assignments in the checked-in manifest         |             4,025 |
| Existing exoplanet planet-name overrides to preserve       |                29 |

The two non-Sol station systems are Alpha Centauri and Barnard's Star, each with
one seeded station. Alpha Centauri also has a non-station belt market. Market
labels and fallback belt anchors are not evidence of canonical asteroid bodies.
Rings already exist as optional planet properties in exoplanet generation; the
zero small-body counts above do not mean there are no rings.

### Relevant existing surfaces

| Surface                                                                                                                                              | Current behavior and planned responsibility                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [System registry](../src/model/solar-system-registry.js)                                                                                             | Canonical scope and source classification; currently exposes planet/moon/asteroid counts. Counts must reflect the combined output after augmentation.                                                |
| [Celestial seed dispatch](../src/model/solar-system-celestial-seed.js)                                                                               | Curated catalogs win; HYG systems can replace procedural planets with archive planets; otherwise exoplanet catalogs supply stars and planets. Add supplementation without bypassing this precedence. |
| [Exoplanet generator](../src/model/exoplanet-system-generator.js)                                                                                    | Catalog-constrained stars/planets, per-body/per-purpose seeds, `approximateFields`, and conditional rings. Reuse these foundations without re-running catalog planets as wholly procedural bodies.   |
| [Procedural generator](../src/model/procedural-system-generator.js)                                                                                  | Game-grade spectral-class counts and geometric orbital spacing; actual output is stars/planets, not a scientific stability model or moon generator.                                                  |
| [Exoplanet catalog access](../src/model/exoplanet-catalog.js)                                                                                        | Snapshot caches, hand-maintained names, and per-system source hashes. Preserve catalog IDs and refresh behavior.                                                                                     |
| [Celestial persistence](../src/handlers/context/celestial-operations-service.js) and [seed state](../src/db/service/celestial-seed-state-service.js) | Batched body upserts and per-system seed versions. Existing database failure can return an in-memory fallback; that must never qualify as verified persistent completion.                            |
| [Market seeds](../src/model/solar-system-market-seed.js) and [market runtime](../src/handlers/context/market-service.js)                             | Stations are market/site records, not celestial `bodyType` values. Extend non-Sol coverage while preserving inventory, transactions, and existing station IDs.                                       |
| [Station orbital math](../src/handlers/context/orbital-math.js) and [market schema](../src/db/models/market-model.js)                                | Static/orbital-elements trajectories and circular/elliptical orbit types exist. Lagrange-region motion requires deliberate modeling, not an invented supported enum.                                 |
| [Celestial contract](celestial-body-contract.md) and [celestial schema](../src/db/models/celestial-model.js)                                         | Separate body classification, appearance, physical catalog values, gameplay composition, and provenance. Belts are not currently celestial body types.                                               |
| [Naming resolver](../src/model/system-naming.js) and [weighted allocation](../src/model/system-naming-weighted-allocation.js)                        | Reusable alias/collision checks and deterministic Hamilton allocation; current scope bounds are for systems, not an unlimited body-naming allocator.                                                 |

The [canonical item catalog](../src/model/canonical-items.js) supplies existing
item IDs, tiers, recipes, and dependencies. [Stellar notes](Stellar%20notes.md)
contains provisional 50-level hierarchies and alternative designs. Per the owner,
Forge owns the final authoritative tree; the notes can vary and are not final
runtime unlock rules. P0 records current IDs and unresolved references rather than
inventing a finished research graph or changing recipes.

## 3. Naming policy and cultural continuity

Use the proportions in the user-supplied documents:

- [Weighted allocation](system-naming-weighted-allocation-2026-11-05.md).
- [Restart handoff](system-naming-restart-2026-11-05.md).
- [Full-catalog review](system-naming-full-catalog-review-2026-11-05.md).
- [Final review](system-naming-final-review-2026-11-06.md).

The 2026-11-06 final review supersedes older activation/count statements, not the
language weights. The [main naming plan](naming-algorithm-2026-11-05.md) supplies
the settlement, landscape, aspiration, journey, Earth-remembrance, and original
hopeful science-fiction patterns.

| Profile language bucket   |   Weight |
| ------------------------- | -------: |
| English                   |      30% |
| Mandarin                  |      18% |
| Russian                   |      12% |
| Spanish                   |       6% |
| Arabic                    |       5% |
| Hindi                     |       5% |
| Portuguese                |       4% |
| Japanese                  |       4% |
| French                    |       4% |
| Swahili                   |       3% |
| Indonesian                |       3% |
| Turkish                   |       2% |
| Korean                    |       1% |
| German                    |       1% |
| Other reviewed traditions |       2% |
| **Total**                 | **100%** |

### Allocation rules

1. Recover explicit profile language and theme metadata from existing approved
   system assignments. Do not guess a language from spelling, a script, or a
   presumed national origin. Profile language does not establish population,
   ethnicity, faction, ownership, or settlement history.
2. For systems lacking an explicit profile, allocate profiles over a frozen
   unprofiled-system scope using the same weights and Hamilton largest-remainder
   method, with the same policy-order tie-break. Preserve existing assignments;
   report historical totals separately instead of retroactively rebalancing them.
   Profile assignment does not rename a protected system.
3. Keep scope allocation separate from deployment batches. Splitting rollout into
   small batches must not repeatedly round away low-weight languages. Record the
   frozen scope quotas, input digest, language tags, and remaining slots.
4. For newly assigned cultural body names, target 60% inherited profile language/
   themes and 40% narrative exceptions. Use deterministic selection and record
   actual fractions; small populations and protected names may make exact ratios
   impossible. These differences do not enter the exception queue.
5. Exceptions can reflect migration, later surveys, remembrance, industrial
   nicknames, or future story hooks. Store the motivation as fictional editorial
   metadata, not asserted demographic or astronomical evidence. Choose their
   language from the existing weighted palette unless a curated exception is
   explicitly authorized.
6. Report profile-level weights and body-level language counts separately.
   Protected existing names and neutral systematic-only names are separate
   reporting categories, not forced into cultural quotas.
7. Preserve all original IDs, catalog designations, established body names, and the
   29 hand-maintained planet-name overrides. Never modify source snapshots to
   disguise editorial assignments.
8. Each eligible body has one preferred name, which may be systematic. A
   systematic-only preferred name needs no duplicated alias or extra systematic
   field. When a proper name replaces a label, retain meaningful old/catalog
   designations as aliases for lookup and saved references.
9. Roman-numeral labels describe a chosen, documented orbital ordering, not NASA
   discovery-letter order. Keep existing labels stable; newly discovered inner
   planets must not silently renumber previously named bodies. Freeze the initial
   label-to-ID mapping and retain it across catalog updates.
10. Reuse normalized collision checks. Require unambiguous names within each
    system; cross-system repetition can be acceptable when system qualification
    disambiguates it. Avoid unreviewed transliterations and claims of linguistic,
    cultural, or legal certification. Original fictional names remain all-ages.

Body-name activation is a new scope: prior system-name approval is not approval
to rename body entities. Search/list/get, station anchor labels, and saved-ID
references must resolve the same preferred name without changing identity.

## 4. Scientific generation model

### 4.1 Layered inputs, not replacement catalogs

Build a combined system in this order:

1. Existing curated and observed catalog bodies, using today's reconciliation and
   dispatch precedence.
2. Scientific estimates needed to interpret incomplete records, with field-level
   provenance and uncertainty.
3. Deterministic hypothetical additions that fit available orbital/environmental
   constraints.
4. Explicit gameplay exceptions and reviewed editorial overrides.
5. Names and story/economic annotations, applied after physical generation.

Distinguish body-level provenance (`catalog`, `hypothetical`, `gameplay-exception`)
from field-level derivation (`observed`, `estimated`, `seeded`, `authored`).
A catalog planet can have both measured and estimated fields. Reuse
`approximateFields` where applicable, but do not treat it as a complete provenance
schema for wholly fictional bodies. New persisted/public metadata is proposed,
not already supported.

Use canonical system/body IDs and versioned, purpose-specific deterministic
seeds. A rename, new moon, or corrected planet radius must not shift unrelated
random streams. Separate physical-generation, naming, resource, and station
versions/hashes. Names must not affect physical output.

### 4.2 System profiles and diversity

Condition generation on available stellar mass, luminosity, spectral/evolutionary
state, multiplicity, binary architecture, known planet masses/radii/orbits,
eccentricities, irradiation, and documented debris evidence. Unknown values stay
unknown or explicitly estimated; a default Sun-like star is not scientific proof.

Pilot profiles should include compact multiplanet systems, hot-Jupiter systems,
cool-dwarf systems, outer giant-dominated systems, sparse systems, wide binaries,
circumbinary systems, and the curated hazardous Cygnus case. These are useful
generation families, not fixed templates copied into every system.

Exoplanet surveys are detection-biased: a system with one detected planet is not
proven to contain only one planet, and detection counts are not an unbiased
planet-count distribution. Document calibration sources and uncertainty in Phase
2 before choosing population probabilities. Avoid the current geometric spacing
rule as a claim of physical realism.

### 4.3 Body placement and constraints

| Category            | Placement and validation                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Additional planets  | Add only where allowed by catalog constraints; preserve measured orbits and resonances. Use bounded rejection against encounter/spacing constraints, not a mandatory planet count.                                          |
| Moons               | Check host periapsis Hill sphere, conservative stability fraction, Roche/physical collision bounds, satellite mass budget, and irradiation/tidal conditions. Hot close-in planets may have none.                            |
| Dwarf planets       | Generate only where an outer or debris population is plausible; classification must reflect a documented model, not simply a name or arbitrary size threshold.                                                              |
| Asteroids           | Permit belt, Trojan, scattered, and sparse populations. Provide individually addressable mineable representatives with valid material profiles; do not equate representative count with total population size.              |
| Comets              | Allow absent, depleted, scattered, or rich reservoirs. Represent selected nuclei as bodies; do not assign one common circular orbit to an entire comet population.                                                          |
| Rings               | Preserve existing rings unless a reviewed correction is needed. New rings must fit host radius, Roche/stability bounds, thermal environment, and mass budget; rings are host properties, not millions of individual bodies. |
| Exceptional systems | Use authored/reviewed models for compact remnants and difficult binaries. Add no second black hole without separate identity, source/model review, and owner approval.                                                      |

Use Kepler-consistent periods and clear parent/barycenter semantics; avoid treating
an arbitrary binary hierarchy as a measured orbit. Check mass-radius-density
consistency and use equilibrium temperature as an estimate, not evidence of
habitable surface conditions or a confirmed ocean.

Publish the actual numeric bounds, units, tolerances, and rejection limits in a
versioned policy during Phase 2. Analytic checks are a plausibility screen, not
proof of long-term N-body stability. Selected difficult pilots may need numerical
checks; document the tested duration and model limits.

If bounded placement fails, emit a named validation/exception reason. Optional
categories can remain absent. Required mining/station coverage must be solved by
a documented safe alternative or remain blocked, never by silently inserting a
body in an invalid orbit.

### 4.4 Mining, stations, and gameplay exceptions

- At least one active, mineable representative asteroid per system is the
  measurable minimum, backed by a declared sparse-or-richer population. Record
  hypothetical/gameplay provenance for unobserved populations.
- Validate the complete playable chain: asteroid composition -> existing
  extraction/debris rules -> canonical resource item -> inventory -> market buy/
  sell behavior. Do not invent a material string that cannot become a tradable
  resource.
- Resource abundances reflect local temperature/history and the adopted physical
  model. Market opportunity also depends on demand, travel/access cost, hazards,
  and tech capability; scarcity must not imply uniformly poor or impossible play.
- At least one durable `siteType: station` record per system, usable through the
  existing market/site pipeline. A free-floating market alone does not satisfy
  station coverage.
- Prefer a safe orbit around a suitable planet, moon, or dwarf planet; validate
  periapsis above its physical radius plus a documented clearance and below
  applicable stability limits. Derive periods from the host mass rather than
  copying the current authored Sol market distances/periods into other systems.
- Consider Lagrange regions for a valid two-primary configuration. Record both
  primary IDs and the selected region. L1-L3 require active station-keeping;
  L4/L5 are not automatically stable, especially in eccentric or multiple-star
  systems. Model halo/tadpole or approximate maintained trajectories explicitly.
- Use a safe stellar orbit or maintained deep-space station when no larger-body
  placement is suitable. Do not invent a planet merely to attach the station.
- Cygnus X-1 needs a separately checked station/mining region outside dangerous
  accretion, radiation, jet, and close-binary environments. Existing catalog body
  co-location is an authored placeholder, not usable station-placement evidence.
  Record the gameplay assumptions and any unresolved safety/stability limits.
- Preserve existing station IDs, player inventories, transactions, stock, depleted
  resources, and destruction/discovery state on reruns. Seed-owned structure and
  mutable gameplay state need separate ownership rules.

## 5. Implementation steps and acceptance gates

Dependencies below are actual prerequisites, not merely ordering suggestions.
All implementation steps remain unchecked until their evidence is recorded.

### P0 - Freeze scope, inventory, and progress manifest

- [x] Snapshot the current registry IDs, base bodies, names, rings, station IDs,
      source digests, and mutable-state ownership; explicitly exclude Sol.
- [x] Recompute the inventory above and account for every target exactly once.
- [x] Define and create the machine-readable manifest described in Section 6,
      including schema validation and a read-only progress-summary command.
- [x] Record current backend tech-tree/material/item identifiers, provisional
      Stellar notes, and mining integration points. Forge owns final tree design;
      unresolved references remain explicit later-phase dependencies.

**Gate:** reproducible source baseline, 4,844 current target records, no Sol
target, preserved-name/identity baseline, and explicit unresolved dependencies.
Future catalog growth updates a reviewed scope revision, not this frozen count.

### P1 - Define data ownership and contracts

Depends on P0.

- [x] Specify body/field provenance, stable generated IDs, naming/alias metadata,
      population descriptors, resource annotations, and station-placement records.
- [x] Keep rings as host properties and belts/reservoirs as population descriptors;
      individual asteroid/comet representatives remain normal canonical bodies.
- [x] Trace every added field through normalizers, validators, Mongo schemas,
      context caches, list/get/upsert responses, registry counts, and OpenAPI.
- [x] Define and document station trajectory support for Nova's later consumption.
      Do not silently encode a
      Lagrange trajectory as an ordinary two-body ellipse or assert support for
      unsupported enum values. Existing supported placement kinds can ship first.
- [x] Define seed-owned versus player/economy-owned fields, additive update rules,
      name-only updates, stale generated-body retirement, and rollback safeguards.

**Gate:** backend contract/ownership design accepted at the owner checkpoint;
Nova receives the completed definitions at handoff. Selective loading,
new pagination contracts, and performance budgets remain deferred; existing
limits and classification/appearance pairs stay valid.

### P2 - Calibrate scientific policies and build deterministic augmentation

Depends on P0 and P1.

- [ ] Document source-backed population assumptions, survey selection effects,
      uncertainty, numeric orbital/thermal/density bounds, and versioned policies.
- [ ] Reuse existing RNG/orbital helpers where correct; extract shared logic rather
      than duplicate it. Add per-system/per-parent/per-purpose generation streams.
- [ ] Implement category-aware augmentation after existing catalog resolution,
      including curated non-Sol paths and HYG/exoplanet hybrid paths.
- [ ] Implement plausibility checks and bounded placement with explicit rejection
      reports; generate population descriptors and representative small bodies.
- [ ] Preserve catalog discoveries, existing rings/IDs, and unrelated seeded fields.

**Gate:** deterministic fixed-epoch dry runs pass structural and scientific
checks, optional categories can be zero, diversity is measurable, and invalid
mandatory coverage is reported as blocked.

### P3 - Add mineable resources and station coverage

Depends on P2.

- [ ] Map asteroid materials to the existing mining/item/market vocabulary.
- [ ] Generate sparse-to-rich mineable populations without requiring full belts.
- [ ] Generate/retain stations using the placement hierarchy in Section 4.4.
- [ ] Wire materialized station snapshots, market reads, docking/access surfaces,
      descriptors, and seed state; require real canonical anchors where applicable.
- [ ] Author and verify the Cygnus X-1 exception, including station and mining
      access. Keep the possible second black-hole system a separate optional gate.

**Gate:** every pilot system has at least one playable mineable asteroid and
usable station; all reference IDs resolve, trajectory snapshots are finite, and
market/mining integration works without resetting mutable economy state.

### P4 - Generate body names and cultural/story annotations

Depends on P0, P1, and P2; can run alongside P3.

- [ ] Freeze system profiles using Section 3 weights and explicit assignment
      evidence; preserve protected names and existing profile metadata.
- [ ] Build a body-naming manifest keyed by stable body ID; reuse collision and
      alias helpers without changing the active system-naming manifest's meaning.
- [ ] Apply the >=200 km moon threshold and story-significance overrides;
      systematically named bodies count as fully named.
- [ ] Generate 60/40 inherited/narrative lanes with actual-count reporting and no
      deviation review. Record name motivation, language, gloss status, and source
      or fictional editorial provenance.
- [ ] Add lightweight discovery/artifact-interest/resource/tech-reference hooks
      without committing to a story arc, placing mandatory artifacts everywhere,
      or changing the tech tree.

**Gate:** every eligible body has a preferred name; identities and existing names
remain intact; culture/body reports have correct denominators; names cannot change
physical seeds; system-qualified lookup is unambiguous.

### P5 - Review a representative pilot and authorize expansion

Depends on P3 and P4.

- [ ] Freeze roughly 20-30 pilot systems across the physical families in Section
      4.2 and all 15 profile language buckets where possible. Include Alpha
      Centauri, Barnard's Star, sparse mining, a systematic-only naming example,
      mixed cultural naming, and Cygnus X-1. Specific IDs are selected from P0
      evidence; do not fabricate catalog membership.
- [ ] Produce dry-run comparisons: catalog preservation, generated counts,
      provenance, orbital/thermal failures, mining accessibility, station choices,
      naming lanes, and unresolved exceptions.
- [ ] Let the owner inspect naming tone and destination variety; verify the pilot
      in Nova and an isolated Mongo database.
- [ ] Capture pilot approval, the exact policy/manifest digests, and explicit bulk
      authorization. Bulk freezes reuse the accepted policy, not implicit approval
      inferred from the existence of this plan.

**Gate:** scientific/gameplay acceptance, persistent pilot verification, and
recorded owner authorization. Naming-ratio deviations alone never block this gate.

### P6 - Deploy resumable batches and verify persistence

Depends on P5.

- [ ] Seed approved systems in bounded, resumable batches through the normal
      canonical service paths; do not run broad destructive database replacement.
- [ ] Compose per-system physical/source hashes and separate naming/resource/
      station revisions so only affected seed-owned records change.
- [ ] Write completion only after all required bodies/stations and seed states
      are persisted and read-back verified. A partially successful upsert batch or
      in-memory fallback is not completion.
- [ ] Reconcile expected IDs and hashes, not only a nonzero body count or matching
      seed-version document. Record errors and resume from verified checkpoints.
- [ ] Rebuild derived registry/live counts and relevant caches; verify list/get/
      search plus station labels in Nova.
- [ ] Test reruns, interruptions, catalog refreshes, and rollback without restoring
      mined/destroyed objects or resetting inventory, trades, or character progress.

**Gate:** every approved in-scope system is persistently verified or explicitly
blocked with an exception. Rollback reverses only identified seed-owned changes;
used bodies/stations require reviewed retirement rather than deletion.

### P7 - Close coverage and hand off to story/consumer work

Depends on P6.

- [ ] Confirm full target coverage, preserved Sol baseline, zero unresolved
      release-blocking exceptions, and no unapproved second black hole.
- [ ] Publish the final source/policy/output digests and regenerate the progress
      summary from the manifest.
- [ ] Hand Nova the actual body-name/provenance/trajectory contract and examples.
- [ ] Hand story work stable destination IDs and optional artifact/discovery hooks;
      hand economy work verified resources/accessibility and current tech IDs.
- [ ] Record selective-fetching/performance work as a later dependency, not an
      unimplemented promise of unlimited whole-system responses.

**Gate:** Section 8 acceptance checks pass against persistent data and the
consumer, with reproducible evidence.

## 6. Progress tracking

### 6.1 Human phase tracker

Maintain this table and the checkboxes above during implementation. The manifest
is authoritative for per-system progress; this table summarizes milestones.

| Phase                              | Depends on | Status                                 | Completion evidence                                                              |
| ---------------------------------- | ---------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| Direction and source investigation | None       | Complete                               | User forms and read-only inventory in this document                              |
| P0 scope and manifest              | None       | Accepted by owner                      | Owner: "P0 is green and accepted"; frozen baseline and Section 9                 |
| P1 ownership/contracts             | P0         | Implemented; awaiting owner validation | Optional contracts, ownership/trajectory guards, 84 checkpoint tests; Section 10 |
| P2 scientific generation           | P0, P1     | Not started                            | Pending                                                                          |
| P3 mining/stations                 | P2         | Not started                            | Pending                                                                          |
| P4 body naming/hooks               | P0, P1, P2 | Not started                            | Pending                                                                          |
| P5 pilot/authorization             | P3, P4     | Not started                            | Pending                                                                          |
| P6 persistent rollout              | P5         | Not started                            | Pending                                                                          |
| P7 final handoff                   | P6         | Not started                            | Pending                                                                          |

### 6.2 Machine-readable manifest

P0 creates the [frozen pending manifest](../data/non-sol-celestial-generation-manifest-v1.json)
through the [offline inventory command](../scripts/non-sol-celestial-inventory.js).
Its [schema and semantic validator](../scripts/lib/non-sol-celestial-manifest.js)
enforces P0-only pending status, no runtime activation, no database writes, and
no fabricated deployment/approval evidence. Later phases must deliberately evolve
the schema; P0 does not implement deployment or a run journal. Store frozen
generation/review inputs and initial pending system entries there. Persist mutable deployment
attempts and read-back results in a separate environment-specific run journal,
keyed to its digest; do not mix one machine's database status into universal
checked-in generation facts.

Minimum structure:

| Level         | Required information                                                                                                                                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root          | Schema version, scope revision/date, registry digest, excluded system IDs, expected target count, source digests, physical/naming/resource/station policy versions, frozen naming quotas, manifest digest                                                                                |
| Per system    | Canonical ID, base-source digest, cultural profile/evidence, fixed seeds/epoch, expected base/generated body IDs, output digest, category counts, population abundance classes, naming completeness, expected station IDs/placements, validation results, exception IDs, approval status |
| Per body/name | Stable ID and parent ID, body-level provenance, estimated/seeded field paths, preferred name/aliases, protected flag, naming lane/language/motivation, threshold/story eligibility                                                                                                       |
| Per exception | Stable exception ID, system/body IDs, severity/reason, physical/gameplay assumptions, blocking flag, owner decision, resolution/evidence                                                                                                                                                 |
| Run journal   | Environment identifier without secrets, manifest digest, per-system stage, attempt/start/end times, persisted seed revisions, actual ID/count/digest reconciliation, database read-back evidence, errors, verifier                                                                       |
| Approval      | Scope/policy digests, actual pilot approval, bulk authorization, reviewer role, approval time; no invented approval records                                                                                                                                                              |

Use per-system stages:

`pending -> generated -> validated -> approved -> persisted -> verified`

`blocked` and `failed` record the last successful stage plus an actionable reason.
A rerun resumes only when source/policy digests still match; otherwise explicitly
invalidate affected downstream evidence. Write files atomically and keep failed
attempts in the journal.

The progress command should report:

- Total target systems and count at each stage; verified percentage uses **verified
  systems / frozen target systems**, never generated bodies as a proxy.
- Coverage for named eligible bodies, mineable asteroid representatives, usable
  stations, optional category distributions, and scientifically rejected additions.
- Expected versus actual body IDs/counts, orphan references, stale output hashes,
  pending approvals, and blocking/nonblocking exceptions.
- Profile quota allocation and actual body-language/lane distributions, with
  protected/systematic-only categories separated.
- Systems still missing mining, stations, persistent verification, or consumer
  validation, and the next actionable batch.

Do not mark a system verified because its API response says `success: true`.
Persistent read-back and required playable surfaces are the deciding evidence.

## 7. Validation strategy

Documentation-only creation of this plan does not require a backend test run.
During implementation, use the smallest relevant existing Node test selection,
then add directly related tests for new generation and manifest behavior.

Initial regression selection (existing files; PowerShell command):

```powershell
node --test test\procedural-system-generator.test.js test\exoplanet-system-generator.test.js test\exoplanet-systems.test.js test\solar-system-celestial-seed.test.js test\alpha-centauri-system.test.js test\cygnus-x1-system.test.js test\solar-system-market-seed.test.js test\station-market-snapshot.test.js
```

Add targeted checks for:

- Fixed-input determinism, per-purpose isolation, distinct IDs, cycle/orphan
  rejection, valid classification/appearance, and unchanged catalog/Sol output.
- Orbital, density, thermal, ring, and moon bounds at/around their numeric
  thresholds; placement exhaustion must produce an explicit failure/absence.
- Naming threshold at 199.999, 200, and 200.001 km; unknown diameter requires a
  documented estimate or eligibility decision, not silent exclusion.
- Systematic-only complete names, stable ordinal assignments after inner-planet
  catalog additions, protected names, aliases, collisions, native-script handling,
  and weighted quota tie-breaks. No failure solely for a 60/40 deviation.
- Every target's required mining/station coverage, actual mine -> resource ->
  inventory -> market operations, and valid tech references.
- Safe station clearance, resolvable primary/anchor IDs, Lagrange-region
  station-keeping assumptions, fixed-epoch snapshots, and Cygnus exceptions.
- Partial writes, database outages/in-memory fallbacks, resume/retry, separate
  name/physical reseeds, resource depletion/destruction preservation, and rollback.

Run the relevant existing Mongo integration tests using the repository's isolated
integration setup, not a shared live database. Existing selections include:

```powershell
node --test test\solar-system-celestial-seed.mongo.integration.test.js test\db-celestial-bodies.mongo.integration.test.js test\station-market-snapshot.mongo.integration.test.js
```

For code/schema changes, also run the applicable lint, type check, contract tests,
and drift gates from [package scripts](../package.json). Generate and inspect
contract artifacts in the implementation work, coordinating intentional changes
with Nova. Record exact commands and pass/fail/not-run results in the journal.
Widen test scope only when shared behavior or targeted failures require it.

## 8. Definition of done and first implementation slice

The rollout is complete only when:

1. Every frozen non-Sol target is accounted for and persistently verified; Sol's
   canonical baseline, system identities, and protected existing names are intact.
2. Every target has at least one active mineable representative asteroid and one
   accessible station; the mining/item/market chain works.
3. Every generated body has valid references, canonical shape, numeric plausibility
   evidence, and honest provenance. Unknown measurements are not disguised.
4. Every naming-eligible body has a complete preferred name, including permitted
   systematic-only names; alias lookup and station labels remain consistent.
5. Physical families and resource accessibility are demonstrably varied; optional
   moons/rings/belts/comets can be absent. No uniform Sol clone is required.
6. Cultural profile weights follow the frozen policy; body distributions are
   reported, not forced. Naming-lane deviations require no extra review.
7. Existing Cygnus X-1 is safely curated for the required gameplay; any second
   black hole has separate approval. A third is outside scope.
8. Reruns, interrupted batches, source refreshes, and rollback preserve mutable
   gameplay state; database failures cannot produce false completion.
9. Owner approvals, validation evidence, manifest/journal hashes, and Nova
   verification are recorded. No pending release-blocking exceptions remain.

**Current stop:** P0 was accepted by the owner. P1 is implemented and awaits the
Section 10 owner checkpoint. No new celestial generation, body naming, or
live database seeding has occurred. P2 requires explicit P1 acceptance.

## 9. P0 owner validation checkpoint

Run the following commands in PowerShell from the repository root. None connects
to MongoDB, starts the backend, or changes the live universe.

### A. Verify preservation and reproducibility

```powershell
npm run seed:non-sol:check
```

Expected: `PASS`, **4,844 targets**, and exit code zero. The command regenerates
the fixed-J2000 baseline in memory and compares its manifest digest with the
checked-in snapshot, covering source digests, system/body IDs and names, rings,
markets, and protected Sol output. It fails on drift rather than silently updating
the frozen baseline. Changing source snapshots or runtime catalog definitions will
intentionally require a reviewed new baseline/revision.

### B. Verify scope and truthful progress

```powershell
npm run seed:non-sol:progress
```

Expected:

| Check                                                           |          Expected |
| --------------------------------------------------------------- | ----------------: |
| Targets; Sol excluded                                           |             4,844 |
| Pending systems                                                 |             4,844 |
| Generated / validated / approved / persisted / verified         |             All 0 |
| Verified percentage                                             |                0% |
| Non-Sol stars / planets / black holes                           | 5,331 / 6,456 / 1 |
| Ringed bodies                                                   |               831 |
| Baseline station systems / asteroid systems                     |             2 / 0 |
| Profiles with explicit inherited evidence / unassigned profiles |       4,025 / 819 |
| Open exception groups                                           |                 4 |

Zero new asteroids/stations/names is correct for this phase. Existing stations are
baseline seeds, not assertions of verified safe/usable placement. The 819
unprofiled systems have frozen Hamilton quotas but no newly assigned profiles.

### C. Inspect representative systems and the design gaps

```powershell
npm run seed:non-sol:progress -- --system alpha-centauri
npm run seed:non-sol:progress -- --system cygnus-x1
npm run seed:non-sol:progress -- --system exo-gj-9066

$manifest = Get-Content -Raw .\data\non-sol-celestial-generation-manifest-v1.json | ConvertFrom-Json
$manifest.exceptions | Format-Table id, blockingPhase, reason -Wrap
$manifest.ownership | Format-List
$manifest.resources.unresolvedRequirements | Format-Table
$manifest.resources.unresolvedDependencies | Format-Table
$manifest.resources.techNotes.proposedLevels | Select-Object -First 10 | Format-List
```

Validate:

- Alpha Centauri retains six bodies (three stars, three planets), its station,
  and its existing non-station belt market. The market's `ac-dust-belt` anchor is
  explicitly unresolved; no fake belt body has been inserted.
- Cygnus X-1 retains its black hole and companion, remains pending, and has no
  invented station, planetary host, or observed binary orbital phase.
- `exo-gj-9066` retains `Copper Vale (GJ 9066)` and an explicitly evidenced English
  profile; catalog/body labels are unchanged.
- The initial Drone-Logic hierarchy is useful **provisional** input, not adopted
  research/unlock behavior. Existing catalog recipes/tiers are not overwritten
  by those notes.
- Four exception groups are expected: provisional tech tree, **12** unresolved
  recipe-material references and **11** dependency references, scientific resource
  calibration, and the Alpha Centauri belt-market anchor. These are later-phase
  blockers, not failed P0 inventory work. Do not choose new material aliases or
  finalize recipes merely to make this report empty.
- Ownership safeguards explicitly protect destroyed/mined bodies, player-created
  discoveries, inventory, consumed items, trades, and character progression.

### D. Automated checks and optional unchanged-UI smoke check

```powershell
node --test test\non-sol-celestial-manifest.test.js test\solar-system-celestial-seed.test.js test\canonical-items.test.js
npm run typecheck
```

Expected: tests and type check pass. P0 has no public API/runtime changes and no
database activity, so a Nova check is optional: against your existing development
backend, open Alpha Centauri, Cygnus X-1, and Copper Vale and confirm their existing
names and contents have not changed. There should be no new P0 universe content
visible in Nova. Later checkpoints will supply positive feature-specific UI and
mining/station validation steps.

### Evidence and pause

Implementation checks on 2026-11-07:

| Exact command                                                                                                                                                             | Result                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `node --test test\non-sol-celestial-manifest.test.js test\solar-system-celestial-seed.test.js test\canonical-items.test.js`                                               | Passed: 21 tests, zero failures/skips                      |
| `npm run seed:non-sol:check`                                                                                                                                              | Passed: 4,844 targets; frozen/current baseline matches     |
| `npm run seed:non-sol:inventory`                                                                                                                                          | Passed: existing manifest unchanged on rerun               |
| `npx --no-install eslint scripts\non-sol-celestial-inventory.js scripts\lib\non-sol-celestial-manifest.js test\non-sol-celestial-manifest.test.js`                        | Passed                                                     |
| `npm run typecheck`                                                                                                                                                       | Passed using the existing repository configuration         |
| `npx --no-install prettier --write scripts\non-sol-celestial-inventory.js scripts\lib\non-sol-celestial-manifest.js test\non-sol-celestial-manifest.test.js package.json` | Passed at P0 completion, not in the normal edit/test cycle |

The generated JSON remains owned by the deterministic generator, not a formatting
rewrite. No Mongo integration tests, deployment, contract changes, or Nova
interaction were needed for this offline-only implementation.

Manifest SHA-256:
`a68f9442166c06eefcbdc7543ff19113193b7c009704500d55da83ce0f381944`.

Confirm A-C match your expectations, including provisional tech-tree ownership
and the recorded later-phase gaps, before authorizing P1.

**Owner decision:** "P0 is green and accepted. lets start P1." P0 is closed.
The evidence above remains historical; after P1 source changes, use the
preservation command below rather than rewriting the accepted snapshot.

The inventory command (`npm run seed:non-sol:inventory`) is **not** a database
seeder. It creates the manifest only if absent; an identical existing manifest is
left untouched, and a different existing baseline is rejected. For a reviewed
comparison snapshot, use `--manifest` with a new file path; never overwrite
the frozen baseline to hide drift.

## 10. P1 owner validation checkpoint

P1 scope selected by the owner: additive backend schemas, validation, persistence,
and read/write contracts now; generation in P2. Define full station-placement
metadata but activate only trajectories evaluated by this backend. Preserve stable
IDs/history and retire eligible seed-owned additions separately from destruction.
Large new bodies begin catalog-visible/scanned; small mining bodies may begin
visible/unscanned, without resetting later scan history.

### A. Verify the accepted universe is unchanged

```powershell
npm run seed:non-sol:preservation
npm run seed:non-sol:progress
```

Expected: preservation **PASS**, **4,844 targets**, unchanged catalog IDs/names,
body output, rings, markets, and Sol. Source-file digest changes are reported
separately, not written into the frozen P0 manifest. Progress remains **4,844
pending**, zero generated/persisted/verified additions. The historical
`seed:non-sol:check` intentionally fails when implementation sources change;
that does not authorize replacing the accepted manifest.

### B. Verify new contracts and persisted ownership in isolated tests

```powershell
node --test test\celestial-universe-metadata.test.js test\celestial-universe-metadata.mongo.integration.test.js test\launch-item-message-handler.test.js test\station-market-snapshot.test.js test\station-market-snapshot.mongo.integration.test.js
npm run typecheck
```

Expected: all tests and type check pass, no skipped integration checks.
Mongo tests create and tear down isolated databases; do **not** seed or modify
your existing development database to test the fixture. Confirm the named
assertions demonstrate:

- Optional metadata survives upsert, list, whole-system reads, Mongo, and a fresh
  service/context; legacy bodies remain valid without invented provenance.
- Hypothetical/gameplay additions require identity and rationale; observations
  need references; resource annotations use canonical raw-material IDs.
- Population hosts resolve locally and descriptors are consistent. Rings/belts
  do not introduce incompatible body types.
- A name-only change keeps identity and physical/gameplay values. Systematic
  preferred names need no redundant alias; protected names survive reseeds.
- Scan/depletion/destruction/retirement history survives reseeds. Retirement does
  not erase destruction history or consume equipment on a new mining launch.
- Failed writes/readback cannot report non-Sol completion or clear cached history.
- Station tests cover typed placement readback and reject unsupported active
  trajectories rather than disguising them as a two-body orbit.
  `activation: metadata-only` preserves the authored snapshot; `active` evaluates
  only body/stellar orbital-elements placement with an exact primary anchor.
  `stationKeeping` describes maintenance, not activation. Hosts must resolve in
  the market's system; stellar primaries must be stars. Lagrange secondary IDs
  must differ from the primary. Active Lagrange/deep-space is unsupported.

### C. Review the definitions, not new gameplay

Read [the shared metadata schema](../api/schemas/celestial-universe-metadata.schema.json),
[the canonical contract](./celestial-body-contract.md), and
[the example fixture](../test-support/universe-metadata-test-helpers.js).
For stations, review [the shared placement schema](../api/schemas/station-placement.schema.json)
and the station section of the canonical contract.
Validate the meaning of provenance, naming lanes, canonical resources,
population descriptors, retirement versus destruction, and discovery defaults.
P1 defines helpers/contracts; it does not generate populations, select bodies for
retirement, implement an approved rollback executor, or add an alias-search API.

Nova validation is optional at this phase: against your existing development
backend, open Alpha Centauri, Cygnus X-1, and Copper Vale (`exo-gj-9066`) and verify
existing names, contents, and stations are unchanged. No new P1 bodies or stations
should appear. Later phases provide positive generation/mining/station checks.

### Evidence and pause

Parent celestial/ownership checks:

| Exact command                                                                                                                                                                                                                                                                                                                                                  | Result                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `node --test test\celestial-universe-metadata.test.js test\celestial-universe-metadata.mongo.integration.test.js test\launch-item-message-handler.test.js test\solar-system-get-message-handler.test.js test\solar-system-celestial-seed.test.js test\solar-system-celestial-seed.mongo.integration.test.js test\non-sol-celestial-manifest.test.js`           | Passed: 48 tests, zero failures/skips                                   |
| `node --test test\celestial-body-list-message-handler.test.js test\celestial-body-upsert-message-handler.test.js test\celestial-canonical-parity.test.js test\celestial-body-surface-archetype-contract.test.js test\celestial-operation-examples.test.js test\db-celestial-bodies.mongo.integration.test.js test\celestial-runtime.mongo.integration.test.js` | Passed: 34 tests, zero failures/skips                                   |
| `npm run typecheck`                                                                                                                                                                                                                                                                                                                                            | Passed                                                                  |
| `npm run seed:non-sol:preservation`                                                                                                                                                                                                                                                                                                                            | Passed: 4,844 targets; source changes reported, frozen output preserved |

Final phase checks on 2026-11-08:

| Exact command                                                                                                                                                                                                                                                                                                                                                                                | Result                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `node --test test\celestial-universe-metadata.test.js test\celestial-universe-metadata.mongo.integration.test.js test\launch-item-message-handler.test.js test\station-market-snapshot.test.js test\station-market-snapshot.mongo.integration.test.js test\market-list-message-handler.test.js test\market-list-by-location-message-handler.test.js test\non-sol-celestial-manifest.test.js` | Passed after formatting: 84 tests, zero failures/skips       |
| `npm run typecheck`                                                                                                                                                                                                                                                                                                                                                                          | Passed after formatting                                      |
| `npm run seed:non-sol:preservation`                                                                                                                                                                                                                                                                                                                                                          | Passed after formatting: all 4,844 targets and Sol preserved |
| `node -e "require('@apidevtools/swagger-parser').validate('api\\openapi.yaml').then(()=>console.log('OpenAPI validation PASS')).catch(e=>{console.error(e);process.exitCode=1})"`                                                                                                                                                                                                            | Passed                                                       |

Scoped phase-completion formatting and lint used the exact PowerShell selection
below, excluding the frozen generator-owned JSON and unrelated owner documents:

```powershell
$files = @(git -c core.quotepath=false ls-files --modified --others --exclude-standard | Where-Object { $_ -notin @('docs/Stellar notes.md', 'docs/ai-npc-2026-11-07.md', 'data/non-sol-celestial-generation-manifest-v1.json') } | ForEach-Object { $_.Replace('/', '\') })
npx --no-install prettier --write @files
$js = @($files | Where-Object { $_ -like '*.js' })
npx --no-install eslint @js
```

Both passed. Prettier ran only at P1 phase completion, not during implementation.
Contract artifact/drift outputs were written under this session's `files` directory,
not into tracked generated API artifacts. A pre-P1 source artifact was captured
from `HEAD` using `git archive` and the existing `buildArtifact` helper. Checks:

```powershell
$p1files = 'C:\Users\Peter Girard\.copilot\session-state\b9915c8a-419b-44ac-a67d-821335268ecb\files'
node scripts\sw08\generate-contract-artifact.js --out "$p1files\p1-current-contract.json"
node scripts\sw08\check-contract-drift.js --baseline "$p1files\p1-contract-before\before-contract.json" --current "$p1files\p1-current-contract.json" --report "$p1files\p1-source-drift.json" --mode hard-fail
node scripts\sw08\check-contract-drift.js --baseline api\artifacts\contracts\baseline-contract-artifact.json --current "$p1files\p1-current-contract.json" --report "$p1files\p1-historical-drift.json" --mode report-only
```

All passed: zero reported compatibility issues, no bypass approval. These gates
check schema compatibility; the dereferenced parity tests independently verify the
new optional fields and constraints. No full suite or deployment was run.

P1 is ready for owner validation A-C. No new universe content, live database writes,
or deployment were performed. P2 starts only after explicit acceptance.
