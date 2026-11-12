# Non-Sol celestial seeding and naming plan

Date: 2026-11-07

Status: **All 4,844 frozen targets accounted for; body generation and market
density persistently verified and owner Nova-accepted.** Copper Vale is protected
and separately deployed; the remaining 4,843 systems have accepted bulk output.
Section 26 supersedes earlier pilot-only scope/status and scientific blockers
for explicitly hypothetical gameplay additions, without certifying unknown science.
The frozen P0 manifest remains a historical pending baseline, not a live deployment
ledger; durable database journals and independent readbacks establish completion.
Final delivery packaging and cross-environment instructions are in Section 26.6.

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
- Assess all planet subclasses and additional body/population families in
  Section 12, including giant planets, substellar/stellar companions and remnant
  environments. Inclusion must follow source-backed occurrence and system
  eligibility, not equal-probability selection or mandatory category coverage.
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

**Startup decisions:** P1 accepted by the owner. P2 runs only offline previews
and isolated tests; runtime activation waits for pilot approval. Use published
public scientific sources with citations, uncertainty, survey-selection caveats,
and explicit gameplay exceptions. Owner preview systems are Alpha Centauri,
Barnard's Star, Copper Vale (`exo-gj-9066`), and Cygnus X-1.
Do not push the owner's committed changes.

**Historical first-slice budget, superseded for future assessment:** The owner
initially selected "Approve the proposed bounded ranges", then reopened the scope
to include all Section 12 families and reassess budgets by family. Existing v1
previews retain these limits for reproducibility; they are not the revised target.
These are software
sampling limits, not inferred astronomical occurrence rates or total population
counts. Scientific placement constraints may reduce any optional category to zero.

| Category           | Proposed offline limit                                  | Notes                                                                            |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Asteroids          | Sparse 1-4; moderate 5-12; rich 13-24 per system        | Required coverage is at least one valid representative; otherwise report blocked |
| Comets             | 0-6 per system                                          | Distinct sampled nuclei/orbits, not an entire reservoir                          |
| Moons              | 0-4 per suitable planet/dwarf host; 16 total per system | Hill/Roche/thermal/mass-budget checks may exclude all                            |
| Additional planets | 0-2 per system                                          | Optional; no addition when catalog constraints cannot be screened                |
| Dwarf planets      | 0-2 per system                                          | Optional; documented classification and plausible outer population required      |
| New rings          | 0-1 descriptor per suitable host                        | Preserve all pre-existing rings; physical constraints take precedence            |
| Candidate attempts | At most 32 per stable slot                              | Explicit rejection reasons; no unbounded retries or invalid coverage fallback    |

Cygnus X-1 receives an explicit blocked augmentation report unless a separately
reviewed compact-remnant placement model passes; P2 does not invent a safe mining
region or resolve the P3 station exception. Missing binary geometry or stellar
facts similarly produce honest exclusions/blockers, not measured-looking defaults.

- [x] Document source-backed population assumptions, survey selection effects,
      uncertainty, numeric orbital/thermal/density bounds, and versioned policies.
- [x] Reuse existing RNG/orbital helpers where correct; extract shared logic rather
      than duplicate it. Add per-system/per-parent/per-purpose generation streams.
- [x] Implement category-aware augmentation after existing catalog resolution,
      including curated non-Sol paths and HYG/exoplanet hybrid paths.
- [x] Implement plausibility checks and bounded placement with explicit rejection
      reports; generate population descriptors and representative small bodies.
- [x] Preserve catalog discoveries, existing rings/IDs, and unrelated seeded fields.

**Gate:** deterministic fixed-epoch dry runs pass structural and scientific
checks, optional categories can be zero, diversity is measurable, and invalid
mandatory coverage is reported as blocked.

**Scoped acceptance:** The original checked items describe the restricted v1
slice. The expanded five-system review was subsequently accepted, including
Copper Vale generation and explicit blockers for the other four systems.
Section 12 remains the authority for broader family coverage gaps.

- [x] Assess the five reviewed systems and publish expanded Copper Vale counts,
      with the other four explicitly blocked; owner P2 acceptance recorded.
- [ ] Calibrate conditional occurrence and revised budgets across all selected
      families; authored sample envelopes are not measured occurrence rates.
- [ ] Resolve the four physical/source blockers and remaining family
      contract/evaluator gaps before generating those cases.

### P3 - Add mineable resources and station coverage

Depends on P2.

- [x] Map Copper Vale asteroid materials to the existing mining/item/market
      vocabulary; verify the canonical acquisition/mining/inventory/trade loop
      in isolated Mongo (Section 13).
- [ ] Generate sparse-to-rich mineable populations without requiring full belts.
- [x] Generate Copper Vale's approved station using a screened canonical host
      orbit; verify snapshots, market reads, descriptors and seed persistence.
- [ ] Extend station coverage to additional approved systems and placement
      families; do not infer active Lagrange/deep-space evaluator support.
- [ ] Validate Copper Vale mining/access through Nova after an approved travel
      or staging path. Existing trading does not enforce docking.
- [ ] Author and verify the Cygnus X-1 exception, including station and mining
      access. Keep the possible second black-hole system a separate optional gate.

**Gate:** every pilot system has at least one playable mineable asteroid and
usable station; all reference IDs resolve, trajectory snapshots are finite, and
market/mining integration works without resetting mutable economy state.

### P4 - Generate body names and cultural/story annotations

Depends on P0, P1, and P2; can run alongside P3.

- [x] Freeze Copper Vale's explicitly approved naming profile/theme using
      assignment evidence; preserve protected names and existing profile metadata.
- [ ] Freeze profiles for additional systems and implement reviewed cultural
      variation; the naming-only 2% dominance exception remains future work.
- [x] Build Copper Vale's body-naming manifest keyed by stable body ID; reuse collision and
      alias helpers without changing the active system-naming manifest's meaning.
- [x] Apply the >=200 km moon threshold and support explicit story-significance overrides;
      systematically named bodies count as fully named.
- [x] Generate Copper Vale's approved rounded 60/40 inherited/narrative lanes with actual-count reporting and no
      deviation review. Record name motivation, language, gloss status, and source
      or fictional editorial provenance.
- [x] Supply the approved minimal fictional naming motivations as lightweight
      Copper Vale hooks, without a story arc or new annotation contract.
- [ ] Add any separately reviewed discovery/artifact-interest/resource/
      tech-reference annotations beyond naming motivations; no artifact
      placement or tech-tree change has been implemented.

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
- [x] Produce scoped five-system/Copper Vale dry-run comparisons: catalog preservation, generated counts,
      provenance, orbital/thermal failures, mining accessibility, station choices,
      naming lanes, and unresolved exceptions.
- [x] Let the owner inspect Copper Vale naming tone and destination variety; verify the pilot
      in Nova and an isolated Mongo database.
- [x] Capture scoped Copper Vale pilot approval and exact policy/output digests
      (Section 15.6).
- [x] Obtain explicit bulk authorization for a separately frozen expansion
      scope; Section 26 records separate scope, source and target approvals.

**Gate:** scientific/gameplay acceptance, persistent pilot verification, and
recorded owner authorization. Naming-ratio deviations alone never block this gate.

### P6 - Deploy resumable batches and verify persistence

Depends on P5.

- [x] Seed the approved Copper Vale scope in bounded, resumable batches through the normal
      canonical service paths; do not run broad destructive database replacement.
- [x] Compose Copper Vale physical/source hashes and separate naming/resource/
      station revisions so only affected seed-owned records change.
- [x] Write Copper Vale completion only after all required bodies/stations and seed states
      are persisted and read-back verified. A partially successful upsert batch or
      in-memory fallback is not completion.
- [x] Reconcile Copper Vale expected IDs and hashes, not only a nonzero body count or matching
      seed-version document. Record errors and resume from verified checkpoints.
- [x] Reconcile derived live counts; preserve source registry facts; verify list/get/
      search plus station labels in Nova.
- [x] Test Copper Vale reruns, body/station interruptions, source-refresh refusal
      and safe rollback/refusal without restoring destroyed objects or resetting
      stock, trades or gameplay-adjusted prices.
- [ ] Approve any source-refresh migration or used-record retirement policy;
      current behavior refuses these rather than implementing migration/deletion.
- [x] Record overall owner P6 acceptance; Copper Vale and full-cohort persistent
      readbacks and owner Nova confirmations are complete (Sections 16.1 and 26).

**Gate:** every approved in-scope system is persistently verified or explicitly
blocked with an exception. Rollback reverses only identified seed-owned changes;
used bodies/stations require reviewed retirement rather than deletion.

### P7 - Close coverage and hand off to story/consumer work

Depends on P6.

- [x] Confirm full target coverage, preserved Sol baseline, zero unresolved
      release-blocking exceptions, and no unapproved second black hole.
- [x] Publish final source/policy/output digests and reconcile the progress
      summary with durable deployment/readback evidence (Section 26).
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

| Phase                              | Depends on | Status                                                                  | Completion evidence                                                                                                                                            |
| ---------------------------------- | ---------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direction and source investigation | None       | Complete                                                                | User forms and read-only inventory in this document                                                                                                            |
| P0 scope and manifest              | None       | Accepted by owner                                                       | Owner: "P0 is green and accepted"; frozen baseline and Section 9                                                                                               |
| P1 ownership/contracts             | P0         | Accepted by owner                                                       | Owner: "P1 is green and accepted"; Section 10 evidence                                                                                                         |
| P2 scientific generation           | P0, P1     | Accepted by owner, known blockers retained                              | Owner: "P2 is green and accepted"; [five-system assessment and counts](./seed-non-Sol-systems-2026-11-07-five-system-review.md); Section 13 records transition |
| P3 mining/stations                 | P2         | Accepted by owner, Copper Vale scoped checkpoint                        | Owner: "P3 is green and accepted"; Sections 13.6-13.7; no runtime activation                                                                                   |
| P4 body naming/hooks               | P0, P1, P2 | Accepted by owner, Copper Vale scoped checkpoint                        | Owner: "P4 is validated and green"; Section 14.6 evidence and Section 14.7 acceptance                                                                          |
| P5 pilot/authorization             | P3, P4     | Pilot and separate full-cohort approvals complete                       | Sections 15.6 and 26                                                                                                                                           |
| P6 persistent rollout              | P5         | Persistently verified and Nova-accepted                                 | Sections 16.1 and 26; 4,844 targets accounted for                                                                                                              |
| P7 final handoff                   | P6         | Universe delivery cleanup; story/performance follow-ups remain separate | Section 26.6; no gameplay-travel validation claim                                                                                                              |

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

For compatibility with the accepted P0 digest, recorded source and evidence
paths use Windows separators on every platform; filesystem access uses the
host platform's path conventions.

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

**Current stop:** P0 and P1 were accepted by the owner. P2 has been reopened:
Section 12 supersedes the restricted family scope and future sampling budgets.
No live database seeding or runtime augmentation is authorized; P3 is paused.

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

**Owner decision:** "P1 is green and accepted." The owner committed the changes
without pushing and authorized P2 preparation. No new universe content, live
database writes, or deployment were performed during P1.

## 11. P2 scientific policy and offline owner checkpoint

**Historical restricted v1 checkpoint:** Retained for traceability. The owner
did not accept P2 and expanded the assessment in Section 12. The commands and
results below still describe the existing offline implementation, not coverage
of every requested class or acceptance of the expanded P2.

The versioned [numeric policy](../data/non-sol-scientific-policy-v1.json) and
[pure augmentation module](../src/model/non-sol-augmentation.js) are used only by
the [offline preview command](../scripts/non-sol-celestial-preview.js).
The runtime catalog resolver, socket handlers, seed versions, databases, and P0
manifest are not augmented. This phase generates preview evidence, not deployment
or system approval records. No flag enables these previews in the runtime.

### Scientific basis and declared limitations

| Public reference                                                                                                                                                | Use and limitations                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [NASA Exoplanet Archive occurrence-rate bibliography](https://exoplanetarchive.ipac.caltech.edu/docs/occurrence_rate_papers.html)                               | Detection catalogs are not complete population censuses; inferred occurrence requires survey selection/completeness analysis. The preview does not fit occurrence rates from raw catalog counts.                                                                                                                                                 |
| [Hill-sphere formulation](https://en.wikipedia.org/wiki/Hill_sphere)                                                                                            | Periapsis Hill radius `a(1-e) [m/(3(M+m))]^(1/3)` screens satellites and planetary encounter clearance. Restricted, approximate gravitational dominance, not long-term stability.                                                                                                                                                                |
| [Classical Roche limit and exceptions](https://en.wikipedia.org/wiki/Roche_limit) and [NASA solid-body study](https://ntrs.nasa.gov/citations/19740055720)      | Fluid estimate `2.44 R (rhoHost/rhoSatellite)^(1/3)` is deliberately conservative for moon clearance. Strength, elasticity, rotation and ring resonances matter; the estimate is not a universal disruption boundary.                                                                                                                            |
| [Radiative equilibrium formulation](https://en.wikipedia.org/wiki/Planetary_equilibrium_temperature)                                                            | `278.3296 K [Lsolar (1-A)]^(1/4) / sqrt(distanceAU)` estimates periapsis heating and apoapsis cooling. Uniform reradiation, emissivity one, Bond albedo 0.1; no greenhouse, tidal/internal heating, activity, atmospheric or habitability claim. Temperatures are evidence estimates, not measured mean surface temperatures.                    |
| [Holman & Wiegert 1999](https://arxiv.org/abs/astro-ph/9809315), DOI `10.1086/300695`                                                                           | Binary test-particle fits have finite eccentricity/mass-ratio domains and integrations of 10,000 binary periods. P2 does not extrapolate those fits to an arbitrary hierarchy or compact remnant. Multi-star systems remain blocked pending a reviewed model.                                                                                    |
| [Margot 2015](https://arxiv.org/abs/1507.06300), DOI `10.1088/0004-6256/150/6/185`; [formula summary](https://en.wikipedia.org/wiki/Clearing_the_neighbourhood) | Clearing proxy `Pi = 807 mEarth / (Msolar^2.5 aAU^1.125)` uses a main-sequence-lifetime model and circular-orbit approximation. Hypothetical planets require Pi >=10; dwarf candidates require Pi <0.1, with low eccentricity and a modeled cold outer population. This is a disclosed classification model, not an IAU discovery determination. |
| [NASA/ESA Hubble Sirius B evidence](https://esahubble.org/news/heic0516/)                                                                                       | The small HYG fixture has only Sirius A, but Sirius B is a known white-dwarf companion. A source-backed exclusion blocks augmentation without inserting or altering catalog bodies.                                                                                                                                                              |

All probability/count choices, density/size ranges, clearances, thermal cutoffs,
and safety margins are **authored screening policies**, not numerical occurrence
rates derived from those references. Each abundance class is sampled equally as a
diversity choice. Additional planet/dwarf/comet counts are uniformly sampled within
the approved budgets; ring presence is sampled at 25% before checks; moon counts
are independently sampled per host. A missing category is normal.

Numeric rules in v1:

- Single-star preview domain: mass 0.08-3 solar masses and radius 0.05-5 solar
  radii; explicitly evolved/subgiant/white-dwarf spectra are excluded. This is
  a conservative modeling domain, not proof of stellar age/evolutionary state.
  Positive source mass, radius and luminosity are required. Unknown facts never
  become solar values. Circumbinary/unresolved planetary anchors remain blocked.
- Stellar candidate axes span a log-uniform authored region from the maximum of
  0.05 AU, five stellar radii, and `0.3 sqrt(Lsolar)` AU to 100 AU.
  Apoapsis must remain within 100 AU; periapsis must clear five stellar radii.
  Dwarf candidates begin no closer than `5 sqrt(Lsolar)` AU. Optional failed slots
  are not retried indefinitely or substituted with invalid bodies.
- Large neighbors must have non-overlapping periapsis/apoapsis envelopes separated
  by more than eight mutual Hill radii. Asteroid/comet representatives stay more
  than five neighbor apoapsis Hill radii away from those envelopes. Reservoir
  representatives may overlap each other as low-mass samples; they are not
  mutually stable planet systems. Existing catalog configurations are preserved,
  not retroactively rejected or repaired.
- Generated planet/dwarf/moon eccentricities are 0-0.08; asteroids 0-0.15;
  comet nuclei 0.2-0.85. inclinations are 0-15 degrees with seeded phases/nodes.
  No binary phase, observed resonance, Trojan stability, or Oort-cloud census is
  invented. v1 uses scattered-asteroid and comet-reservoir descriptors only.
- Radius ranges in km: asteroid 0.2-80, comet 0.5-30, moon 20-1,500,
  rocky planet 2,000-7,500, dwarf candidate 600-1,000. Densities in kg/m3:
  rock 1,800-5,500, ice 500-1,800. Mass is derived from spherical volume and
  density, not independently randomized. Large icy dwarf candidates are modeled
  as rounded; hydrostatic shape and clearing are assumptions/screens, not
  measured classifications.
- Temperature screens: all stellar representatives 10-1,800 K; icy bodies
  no hotter than 170 K at periapsis. Moons require host-periapsis equilibrium
  temperature <=700 K, or <=170 K for modeled icy moons. Flare erosion,
  tidal survival and long-term evolution still require later review.
- Moon periapsis clears the physical surface plus moon radius, 1.1 times fluid
  Roche distance, and any existing/proposed ring. Apoapsis lies strictly inside
  0.3 of the host's periapsis Hill radius. Sum of modeled moon masses <=0.0001
  host mass. Moon siblings use the same eight-mutual-Hill separation screen.
- A cold icy ring proposal begins at 1.2 host radii and ends within both 0.9
  fluid Roche radii (particle density 1,000 kg/m3) and 0.1 Hill radius.
  Ring mass is bounded at 0.000001 host mass. Proposals are separate host-property
  records; no catalog rings/hosts are overwritten and no belt body type is added.
- Kepler periods use the existing helper with **parent plus generated body mass**.
  Density and period validation use relative tolerance 1e-8; propagated
  parent-relative positions must match snapshots within 0.0001 km.
  Candidate slots receive at most 32 attempts and report rejection counts/reasons.

Independent seeded RNG streams use system, parent and purpose/stable slot.
Names, epochs and policy versions do not alter durable slot IDs. Physical
families/element phases are fixed at J2000; a requested later UTC epoch changes
snapshots, not generated identities. Source and policy SHA-256 values plus an
output digest identify each preview. Changing a policy may change acceptance and
requires new review evidence even when surviving slot identities remain stable.

Every generated body is explicitly hypothetical with field-level
seeded/estimated/authored provenance. Labels are systematic placeholders/complete
preferred labels, not P4 cultural naming. Population total sizes remain unknown
(`estimatedTotalCount: null`). Composition is a placeholder compatible with the
existing canonical shape; P3 calibrates extraction/resources/stations. A
`preview-valid` system means the analytic screen found at least one representative
asteroid, **not** verified mining, safe docking, persistence, or release approval.

### Owner validation commands

Run from the repository root:

```powershell
npm run seed:non-sol:preview
node --test test\non-sol-augmentation.test.js test\non-sol-celestial-manifest.test.js test\solar-system-celestial-seed.test.js
npm run typecheck
npm run seed:non-sol:preservation
npm run seed:non-sol:progress
```

Expected: all tests/type checks/preservation pass; P0 remains 4,844 pending and
no runtime universe changes appear. Previews deliberately report Alpha Centauri
as blocked by multi-star modeling and Cygnus X-1 as blocked by compact-remnant
modeling. Barnard's Star and Copper Vale should have valid offline samples.
Confirm these limitations and the authored budgets, rather than approving the
blocked systems as playable. No Nova validation is required: no new P2 content
should appear in the existing backend.

To save and inspect reproducible evidence:

```powershell
npm run seed:non-sol:preview -- --out "$env:TEMP\non-sol-p2-owner-preview.json"
$preview = Get-Content -Raw "$env:TEMP\non-sol-p2-owner-preview.json" | ConvertFrom-Json
$preview.summary | Format-Table systemId, status, abundance, counts, ringProposals
$preview.details | Where-Object systemId -eq 'exo-gj-9066' | Select-Object -ExpandProperty generatedBodies
npm run seed:non-sol:preview -- --all --out "$env:TEMP\non-sol-p2-owner-all.json"
```

The output is exclusive/atomic; an identical rerun leaves it untouched, and a
different report requires a new filename. `--all` produces compact evidence for
exactly the frozen 4,844 targets, not a replacement P0 manifest or DB rollout.
Review provenance, bound checks, null reservoir totals, optional absences, and
explicit failed candidate slots. Do not treat output generation as pilot approval.

### P2 results and acceptance evidence

Default four-system preview:

| System                      | Result                                                   | Generated offline bodies                  | New ring proposals |
| --------------------------- | -------------------------------------------------------- | ----------------------------------------- | ------------------ |
| Alpha Centauri              | Blocked: reviewed hierarchical multi-star model required | None                                      | 0                  |
| Barnard's Star              | Analytic preview valid                                   | 2 planets, 5 asteroids, 4 comets, 3 moons | 1                  |
| Copper Vale (`exo-gj-9066`) | Analytic preview valid                                   | 2 planets, 2 asteroids, 4 comets, 4 moons | 0                  |
| Cygnus X-1                  | Blocked: reviewed compact-remnant model required         | None                                      | 0                  |

Whole frozen scope: **4,844 accounted for exactly once**, **4,220 analytic previews
valid**, **624 blocked**. Blockers: 433 multi-star models, one compact-remnant model,
one unresolved known Sirius companion, 167 stellar-evolution/domain exclusions,
and 22 bounded asteroid-placement
failures. These are explicit unresolved coverage requirements, not released or
verified systems. An owner acceptance of P2 approves the offline method and its
honest exception queue, not those systems' playable readiness.

Hypothetical preview totals: 4,213 additional planets, 4,103 dwarf candidates,
41,722 asteroid representatives, 12,170 comet representatives, 12,688 moons, and
1,604 ring proposals. All categories show optional absences; samples exercise
all three abundance classes and different sizes/counts/orbits. These are software
outputs, not claims about how many objects astronomers have found.
Use `--system <canonical-id>` to regenerate detailed evidence for any compact
all-scope report row, including per-slot rejection counts.

Implementation checks on 2026-11-08:

| Exact command                                                                                                                                                                                                                            | Result                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `node --test test\non-sol-augmentation.test.js test\non-sol-celestial-manifest.test.js test\solar-system-celestial-seed.test.js`                                                                                                         | Passed after formatting: 25 tests, zero failures/skips; includes all 4,844 targets and the Sirius source-gap regression |
| `npm run typecheck`                                                                                                                                                                                                                      | Passed                                                                                                                  |
| `npx --no-install eslint src\model\non-sol-augmentation.js scripts\non-sol-celestial-preview.js test\non-sol-augmentation.test.js`                                                                                                       | Passed                                                                                                                  |
| `npx --no-install prettier --write data\non-sol-scientific-policy-v1.json src\model\non-sol-augmentation.js scripts\non-sol-celestial-preview.js test\non-sol-augmentation.test.js package.json docs\seed-non-Sol-systems-2026-11-07.md` | Passed at major-phase completion only                                                                                   |
| `npm run seed:non-sol:preservation`                                                                                                                                                                                                      | Passed: all accepted catalog outputs and Sol unchanged                                                                  |
| `npm run seed:non-sol:progress`                                                                                                                                                                                                          | Passed: 4,844 pending; zero rollout generation/persistence/verification                                                 |

Saved session evidence can be reproduced with:

```powershell
$p2files = 'C:\Users\Peter Girard\.copilot\session-state\b9915c8a-419b-44ac-a67d-821335268ecb\files'
npm run seed:non-sol:preview -- --out "$p2files\p2-owner-reviewed-v2.json"
npm run seed:non-sol:preview -- --all --out "$p2files\p2-scope-reviewed-v2.json"
```

Both commands passed; identical reruns preserve the files. Report digests:

- Four owner previews: `271fb97ecfafd29f0df058a25774b556ecb2468510ea22b789b2fa0292929836`.
- All-scope summary: `fbe0385c16eac73ca60d09381b6f5df6757c2ecac1fbd24bdcd883a8d5aaf13a`.

These v2 report files supersede the initial v1 preview evidence following the
Sirius companion source check; the four selected pilot counts did not change.
No accepted P0 catalog or snapshot was rewritten.

The [Nova intro-page attribution prompt](./seed-non-Sol-systems-2026-11-07-Nova-prompt.md)
collects catalog credits, required license/acknowledgment guidance, scientific
references, and fictional-content disclosures for the separate Nova UI.

No full suite, Mongo tests, Nova interaction, deployment, commit, or push was
performed in P2. Public API contracts were not changed, so no contract artifact
regeneration was needed. The unrelated NPC plan was left untouched.

**Pause:** P2 remains unaccepted and requires the expanded Section 12 work.
P3 begins only after the owner accepts the revised P2 checkpoint.

## 12. Reopened P2: complete celestial-family assessment

### 12.1 Owner decision and corrected interpretation

The owner selected **all** planet classes and other body/population options in
the clarification form, with scientific occurrence driving whether they appear.
Assess every selected family, including difficult contract/evaluator cases.
Reassess representative budgets by family; do not impose the old 0-2 additional
planet limit before assessment.

The first P2 implementation generated only rocky additional planets. Existing
catalog gas/ice giants were preserved, but that did not satisfy the intended
assessment of plausible new system diversity. This was an incomplete scope
interpretation, not a missing scientific reason to exclude giants.

Assessment inclusion is not permission to generate every family in every system.
No additional stars, remnants, rogue systems, or black holes are authorized for
publication by this decision. Existing protected facts/IDs, Sol exclusion,
offline-only operation, and pilot/bulk approval gates remain intact. The limit of
one separately approved additional black-hole system still applies.

### 12.2 Family checklist and current gaps

Every row below is **selected for assessment**. Status describes v1 augmentation,
not whether the universe already contains a catalog example.

| Family                                         | Current augmentation status                     | Assessment and implementation implications                                                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rocky/terrestrial planets                      | Generated                                       | Retain; reassess occurrence, count distribution, mass-radius-density and architecture constraints alongside all other planets.                                                                                  |
| Gas giants / cold Jupiter-like planets         | Not generated                                   | Use `bodyType: planet`, `gas-giant` appearance. Assess envelope composition, mass-radius relations, formation/occurrence, irradiation, spacing, and satellite/ring capacity.                                    |
| Ice giants / Uranus-Neptune analogues          | Not generated                                   | Planet category with `ice-giant` appearance. Distinguish physical composition regime from a blue texture or arbitrary orbital-distance threshold.                                                               |
| Super-Earths                                   | Not generated                                   | Planet category; radius/mass regime does not prove rocky composition or habitability. Assess overlaps with volatile-rich planets.                                                                               |
| Sub-Neptunes                                   | Not generated                                   | Planet category; model uncertain envelope/rock fractions and irradiated mass-radius regimes, not a uniform scaled-down gas giant.                                                                               |
| Hot Neptunes                                   | Not generated                                   | Planet category; assess irradiation, atmospheric loss and detection-conditioned occurrence, including suppression/desert regions.                                                                               |
| Hot Jupiters                                   | Not generated                                   | Planet category; assess rare close-in architecture, tidal/thermal evolution and suppression of stable large moon populations.                                                                                   |
| Super-Jupiters                                 | Not generated                                   | Planet category; assess high-mass giant regime and uncertain planet/brown-dwarf classification. Do not classify solely by size or renderer archetype.                                                           |
| Lava planets                                   | Not generated                                   | Existing `lava` planet appearance; assess irradiation/tides and disclose modeled surface state, not confirmed global lava coverage.                                                                             |
| Ocean/water-rich planets                       | Not generated                                   | Existing `ocean` appearance; require hypothetical composition/atmosphere interpretation. Equilibrium temperature alone cannot establish an ocean.                                                               |
| Dwarf planets                                  | Generated candidates                            | Reassess rounding/clearing criteria, outer population context and applicability of stellar-lifetime proxies.                                                                                                    |
| Trans-Neptunian analogues / outer minor bodies | Not generated                                   | Existing `tno` category; assess outer planetesimal populations, resonant/scattered/detached families. A non-Sol analogue need not literally orbit beyond Neptune.                                               |
| Rocky and icy moons                            | Generated                                       | Reassess counts/total mass by host family, radius distribution, Hill/Roche/thermal constraints and unresolved tidal evolution.                                                                                  |
| Lava / strongly tidally heated moons           | Not generated                                   | Existing moon `lava` appearance; require an explicit tidal/thermal model rather than choosing a hot texture randomly.                                                                                           |
| Captured irregular moons                       | Not generated                                   | Same moon category, distinct origin/orbit distribution. Assess eccentric/inclined/retrograde capture, survival and host-dependent prevalence.                                                                   |
| Submoons                                       | Not generated                                   | Nested moon parentage needs stability/tidal/age assessment and correct recursive snapshot/reference handling; ordinary moon support is not proof of submoon survival.                                           |
| Scattered/sparse asteroids                     | Generated representatives                       | Retain mandatory mining minimum as a disclosed gameplay requirement; assess reservoir architecture and evidence separately from addressable sample count.                                                       |
| Organized asteroid belts                       | Not generated as distinct populations           | Existing population descriptor category; assess debris/belt evidence, radial extent and depletion without introducing a belt `bodyType`.                                                                        |
| Trojan / co-orbital asteroids                  | Not generated                                   | Existing population descriptor category is not a co-orbital dynamics evaluator. Assess mass ratios, resonances, libration and required motion representation.                                                   |
| Comet nuclei / reservoir representatives       | Generated within 100 AU                         | Reassess orbital and survival distributions, host environments and distinctions between observed comets and hypothetical reservoirs.                                                                            |
| Distant comet-cloud analogues                  | Not modeled beyond 100 AU                       | Assess formation/ejection, stellar encounters, Galactic tides and retention. Revisit coordinate extent, long-period trajectories and representative loading without assuming every star has a Solar Oort cloud. |
| Cold icy rings                                 | Separate proposals generated                    | Reassess host-family occurrence, particulate survival and ring lifetime. Existing rings must remain unchanged unless separately reviewed.                                                                       |
| Rocky/dust ring variants                       | Not generated                                   | Rings remain host properties; assess material/temperature/strength/resonance dependence. Distinguish circumplanetary rings from circumstellar debris disks, belts and transient dust.                           |
| Rogue / unbound planets                        | Not generated                                   | No elliptic-orbit fiction: assess hyperbolic/free-motion trajectories, system membership, discovery and reference frames. Do not silently create new registry targets.                                          |
| Brown dwarfs / substellar companions           | Not generated                                   | Assess formation/classification and occurrence; current scientific category contract lacks an explicit brown-dwarf type. Do not disguise them as ordinary stars or super-Jupiters.                              |
| Uncatalogued stellar companions                | Not generated                                   | Existing star category does not authorize fabricating an observed companion. Assess source constraints, incompleteness, binary hierarchy, luminosity and barycentric dynamics; retain hypothetical provenance.  |
| White dwarfs                                   | Not generated                                   | Assess catalog-backed/explicitly hypothetical stellar-remnant classifications, post-main-sequence mass loss and surviving/reformed populations; contract/appearance review needed.                              |
| Neutron stars                                  | Not generated                                   | Explicit compact-remnant scientific/appearance representation requires contract assessment; assess source evidence, natal kicks, radiation and planetary survival. Never reuse `black-hole` as a fallback type. |
| Black-hole environments                        | Existing Cygnus preserved; augmentation blocked | Assess existing hazardous-system architecture and safe alternatives; any additional black-hole identity remains a separately approved exception, not random occurrence sampling.                                |

Planet subclass names describe existing appearance/physical-family distinctions,
not nine new top-level body types. Determine physical class independently from
appearance and use existing classification pairs where valid. Belts, reservoirs
and rings are structures, while their individually addressable representatives
retain canonical body types. Unknown remnant/substellar classifications and
unsupported trajectories must receive explicit designs, not enum casts or aliases.

### 12.3 Assessment evidence required before implementation

For each family, produce a reviewable row containing:

1. Public source/paper links, publication/version date, sample definition,
   host-property coverage and the specific inference supported. Update the
   [Nova attribution handoff](./seed-non-Sol-systems-2026-11-07-Nova-prompt.md)
   with sources actually adopted, distinguishing data licenses from paper citations.
2. Occurrence evidence, selection/completeness corrections, uncertainty and
   conditions for zero occurrence. Separate measured frequencies, theoretical
   predictions, Solar-system extrapolations and authored gameplay choices.
3. Eligible system/host conditions: mass, luminosity, metallicity/age if known,
   multiplicity/evolutionary state, known architecture, irradiation and debris.
   Missing required facts imply an explicit estimate with provenance or a blocker.
4. Physical distributions and numeric bounds with units: mass/radius/density,
   composition, orbital elements/spacing, temperature, tidal/retention/survival
   assumptions and limits of analytic versus numerical screening.
5. Formation/history dependencies and correlations. Do not independently roll
   every family in ways that produce implausible combinations or count a planet
   twice because physical classes overlap.
6. Distinct population inference and rendering/gameplay sampling policy. Counts
   of addressable bodies are not reservoir totals or observed discoveries.
7. Canonical category/appearance mapping, provenance, stable identity,
   parent/reference-frame design, supported trajectory, API/persistence/Nova
   changes, and migration compatibility where needed.
8. Assessment outcome: `eligible`, `ineligible`, `insufficient-evidence`,
   `contract-required`, or `evaluator-required`, plus a reason and next action.
   These are assessment states, not P0 rollout stages or claims of release readiness.

Evidence may support only a conservative subset or no reliable frequency. In
that case retain uncertainty, propose a disclosed artistic policy for owner
review, or leave the family blocked. Do not invent precise scientific probabilities.
Rare families remain rare when evidence supports rarity; selection for assessment
does not mean equal weights or guaranteed appearance.

### 12.4 Revised steps and dependencies

| Step                                     | Depends on                             | Status                                         | Required output / gate                                                                                                                                                                                                                            |
| ---------------------------------------- | -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-A family/contract assessment          | Accepted P0/P1 and this scope decision | In progress; first five-system review prepared | [Preliminary review](./seed-non-Sol-systems-2026-11-07-five-system-review.md) covers every selected family, existing contents, proposed sample ranges, sources and blockers. Whole-universe evidence/contract assessment remains incomplete.      |
| P2-B occurrence and physical calibration | P2-A                                   | Pending                                        | Source-backed conditional distributions, correlations, bounds and uncertainty per family; no uniform all-types template.                                                                                                                          |
| P2-C sampling-budget review              | P2-B                                   | Pending                                        | Proposed per-system/per-host counts by family and architecture; owner selection before implementation. Revisit old planet/moon caps and 100 AU domain, without performance optimization by assumption.                                            |
| P2-D contract/evaluator amendments       | P2-A, P2-B                             | Pending                                        | Implement only reviewed required additions through validators, Mongo, normalizers, API, snapshots, IDs and Nova handoff; isolated tests preserve legacy behavior. P1 acceptance remains historical, not a claim these new surfaces already exist. |
| P2-E offline family generation           | P2-B, P2-C, P2-D where applicable      | Partial supported pilot slice implemented      | Owner authorized provisional five-system exploration with blockers; shared physical helpers, expanded planet/moon/outer-body support and deterministic reports. Full conditional occurrence work remains pending; see Section 12.6.               |
| P2-F expanded owner checkpoint           | P2-E                                   | Partial slice prepared for review              | Actual five-system counts, preserved catalog and named family/model blockers in the review document; whole-phase acceptance remains pending.                                                                                                      |

P2-D changes that are not needed for supported families must not block independent
offline work; unsupported families stay visible in the assessment rather than
being silently dropped. Significant new classifications/trajectory designs get a
selectable owner checkpoint before implementation. No phase is complete merely
because its selected family has a texture or appears in a source catalog.

### 12.5 Revised validation and acceptance

- Report **existing catalog**, **generated additions**, and **combined totals**
  separately by scientific category and planet physical/appearance family.
  The UI/report must make preserved gas giants distinguishable from new ones.
- Validate each selected family with a representative eligible case or a named
  evidence/contract/evaluator blocker. Mark unavailable frequencies and estimates
  explicitly; no success-shaped fallback for unimplemented families.
- Demonstrate multiple planetary architectures, variable giant/terrestrial/moon
  populations, optional absences and rare-family treatment. Do not require all
  families in the four original systems or in every system.
- Test actual family-specific numeric thresholds, shape/type parity, nested
  anchors, frame/trajectory correctness, source provenance, source/policy digest
  changes, identity stability, deterministic reruns and bounded rejection.
- Reconcile all 4,844 frozen targets without mutating catalog bodies, known
  companions, protected names, rings, Sol, or accepted P0 evidence.
- Record new exact test commands/results and replacement preview digests.
  Preserve restricted-v1 reports as historical evidence; never overwrite them
  to conceal the scope change.
- Provide an explicit owner validation checklist after the revised major phase.
  Runtime activation, new registry scope, mining/station verification and
  additional black-hole approval remain separate gates.

**At the initial assessment checkpoint:** The [first expanded five-system assessment](./seed-non-Sol-systems-2026-11-07-five-system-review.md)
is prepared for owner review: Alpha Centauri, Barnard's Star, Copper Vale, Cygnus
X-1 and Toivonranta (HR 8799), selected as the known-giant fifth example. It
separates existing contents from hypothetical additions and proposed count
envelopes, covers every selected family, and records evidence/contract blockers.
The envelopes are discussion proposals, not adopted limits or occurrence rates.
No new family generation, numeric policy changes, public contract changes or
runtime activation has been implemented. P2-A remains in progress; P2-B/C
calibration/budget selection and P3-P7 remain pending their actual prerequisites
and owner approval.

### 12.6 Owner-authorized supported offline preview slice

After the first five-system assessment the owner selected expanded supported-family
generation, provisional Section 4 sampling envelopes after calibration, and
preserved contents/explicit blockers rather than inventing missing models.
The [actual preview counts and validation checklist](./seed-non-Sol-systems-2026-11-07-five-system-review.md#8-subsequent-owner-authorized-expanded-offline-preview)
record this slice: 55 hypothetical additions in Copper Vale; 75 combined bodies
across five pilots; Alpha Centauri, Barnard's Star, Cygnus X-1 and HR 8799 blocked.

The [v2 pilot policy](../data/non-sol-scientific-policy-v2.json) is opt-in through
`npm run seed:non-sol:preview -- --expanded`; restricted v1 and prior reports
remain reproducible. No catalogs, contracts, database contents or runtime seeders
are changed. Physical screens/qualitative evidence are calibrated and tested;
sampling frequencies/scatter remain authored and explicitly not a fitted
occurrence model. New reference: [Montet et al. 2014](https://arxiv.org/abs/1307.5849),
with survey-domain and conditional-inference limitations in the review/Nova handoff.

This is a partial P2-E/F offline checkpoint, not completed P2-A/B/C/D or P2
acceptance. Unsupported families remain visible; the full occurrence/contract
assessment and four system model/source gaps remain open. P3-P7 and rollout stay
paused pending their prerequisites and owner approval.

## 13. P2 acceptance and P3 Copper Vale policy checkpoint

### 13.1 Accepted transition and scope

Owner: **"P2 is green and accepted"** on 2026-11-07. Owner committed the work;
observed commit `70ce35c` and clean worktree before P3 investigation. No push was
performed by this session. Earlier P2 reopen/pause statements are historical
checkpoints superseded by this acceptance, not rewritten scientific evidence.

Accepted P2 output remains 55 additions in Copper Vale and four blocked systems.
Acceptance does not supply missing orbital/thermal/source models, fit occurrence
probabilities, certify station/mining access, or deploy bodies. Those limitations
remain explicitly recorded.

The P3 startup form selected and owner-approved:

- **Copper Vale end-to-end first**, other four pilots remain explicitly blocked.
- **Offline preview and isolated database integration tests only**; no runtime
  activation and no writes to owner/development/live databases.
- Use canonical materials, recipes and equipment; the 26-asteroid distribution
  in 13.3 is approved for the Copper Vale preview.
- Retain usable existing stations; add **one usable station where needed**.
- Keep Prettier out of the edit/test cycle until major-phase completion; provide
  explicit owner validation directions at checkpoints.

### 13.2 Existing behavior that constrains the proposal

| Finding                                                                                 | Authoritative backend evidence                                                                                                                                              | Consequence                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copper Vale has 26 generated asteroids, currently `silicate`/Common                     | [Expanded generator](../src/model/non-sol-expanded-augmentation.js), accepted P2 report                                                                                     | All currently map to `silicon` under the existing yield alias. P3 may assign seed-owned resource profiles but must preserve P2 mass/orbits/identity and mutable state on reruns.                      |
| Canonical mineral IDs differ from generic composition labels                            | [Canonical item types](../src/model/canonical-item-type-registry.js), [item definitions](../src/model/canonical-items.js), [market catalog](../src/model/market-catalog.js) | Use `iron`, not `raw-material-iron`; resource profiles reference actual raw-material IDs, not arbitrary ore strings.                                                                                  |
| Active extraction is the expendable dart drone's launch/destruction/debris path         | [Launch handler](../src/handlers/launch-item-message-handler.js)                                                                                                            | Preserve the working tool/quantity/inventory chain. Catalog text about lasers/drills is not proof that tiered extraction tools are enforced by this path. Do not silently introduce tier enforcement. |
| All 26 current asteroid masses yield 100 units under existing extraction                | [Yield formula](../src/handlers/launch-item-message-handler.js), read-only Copper Vale calculation                                                                          | Quantity is mass-derived and capped at 100. Resource diversity will not imply varied extraction quantities. No P2 mass/radius rewrite or mining-balance change is proposed.                           |
| Equipment definitions include an iron requirement for expendable dart drones            | [Canonical definitions](../src/model/canonical-items.js)                                                                                                                    | Retain existing recipe semantics. Do not promise that all recipe definitions already have a complete fabrication route; validate supported chains only.                                               |
| No existing seeded Copper Vale market/station                                           | [Market seed dispatch](../src/model/solar-system-market-seed.js)                                                                                                            | Query durable records as well as seed definitions before adding one; preserve usable existing IDs/economy state if present.                                                                           |
| Active placement supports body/stellar orbital elements                                 | [Placement validator](../src/model/station-placement.js)                                                                                                                    | Use an actual host and Kepler period; no fake Lagrange/deep-space ellipse. Placement activation is separate from runtime pilot activation.                                                            |
| Default market inventory uses 1,200 units for Common materials, 8% restock per interval | [Market service](../src/handlers/context/market-service.js)                                                                                                                 | Reuse market buy/sell flags, pricing, stock and restocking; no new abundance-based pricing or stock policy in this first slice.                                                                       |

Resource abundances below are authored gameplay deposits. Spectroscopy has not
measured Copper Vale asteroid composition, and the game system name does not
justify a scientific claim of copper enrichment.

### 13.3 Owner-approved resource distribution

**Owner-approved for this bounded preview on 2026-11-07.** For the accepted
**26 representative asteroids**, use a stable deterministic
allocation, all **Common**:

| Canonical yielded material | Proposed representatives | Purpose                                                       |
| -------------------------- | ------------------------ | ------------------------------------------------------------- |
| `silicon`                  | 10                       | Retain silicate-rich mining and circuitry vocabulary          |
| `iron`                     | 8                        | Structural materials and the existing dart-drone ingredient   |
| `carbon`                   | 4                        | Common structural material diversity                          |
| `nickel`                   | 2                        | Common metallic material diversity                            |
| `copper`                   | 2                        | Wiring/conduit vocabulary, not inferred system-name abundance |
| **Total**                  | **26**                   | All use existing canonical item and market IDs                |

Proposal rules:

- One primary yielded material per representative, matching the existing
  extraction path; no invented multi-material yield or new item type.
- Stable body IDs, independent resource-policy seed/version, documented
  deterministic allocation. Naming and epoch do not alter assignment.
- Record a canonical `resourceProfile` with hypothetical/authored provenance.
  Keep physical silicate/ice estimates distinguishable from gameplay deposit
  material; do not claim a whole asteroid is pure refined iron/copper.
- Leave uncommon/rare/exotic deposits at zero for the first slice. They require
  explicit equipment/access/balance assessment; catalog tiers alone are not
  enforced extraction rules.
- Do not make the 2 comets, 7 outer analogues, planets/moons or ring proposal into
  extra required mining targets; do not map `ice` to a nonexistent tradable
  water item by fallback.
- Initial resource allocation can populate new preview/test records. Existing
  durable discovery, destruction/debris, inventory and depletion/composition
  history must not be reset by reapplying the resource seed.
- Preserve the current yield rule: successful launches yield 100 units for these
  bodies. Validate unsupported materials fail before consuming the tool, and
  already destroyed/retired targets cannot deliver duplicate resources.

This fixed 26-body proposal is scoped to the accepted Copper Vale preview, not
global abundance percentages or authority to redistribute owner-held bodies.

#### Initial samples versus future regional expansion

Owner clarification: **26 is the initial addressable seed sample**, not Copper
Vale's estimated total physical asteroid population, a universal system count,
or a permanent ceiling. The current Copper Vale sampling envelope is 12-50;
future batches require their own reviewed budgets rather than silently exceeding
the current policy. Real reservoir counts remain unknown.

Keep P3 focused on these initial 26. Preserve future **explicit generation
batches with stable new IDs**, but do not implement automatic exploration spawning
or replenishment after mining at this checkpoint. The ability to extend the
population is a future design requirement, not an already implemented batch API.

Future rules must identify physically eligible generation regions and their
population evidence/models before allocating additional representatives:

- A ship orbiting a planet is not, by itself, a reason to create asteroids nearby.
  Mere ship presence must not be treated as a reservoir or formation mechanism.
- A modeled asteroid belt may justify additional representatives within its
  reviewed extent and orbital/encounter constraints. Copper Vale currently has
  scattered representatives, not an approved organized belt; do not infer a belt
  solely to enable more generation.
- Define regional eligibility, budgets, batch identity, duplicate prevention and
  placement validation in a future selectable checkpoint. Retain existing body
  identities, physical trajectories, resources, depletion/destruction history
  and player inventories; additional batches must not revive mined bodies or
  reroll the initial resource allocation.

No specific regional spawning rule set or implementation is approved here.
This clarification does not approve the material/station proposals below or
expand the current P3 implementation scope.

### 13.4 Owner-approved station/service policy

First inspect existing durable Copper Vale stations. Retain a usable one if
present; otherwise propose exactly one stable station identity with
`siteType: station`, active body-orbit placement metadata, canonical trajectory,
and project-authored provenance. Do not publish it through runtime seed dispatch.

Preferred candidate host:
`exo-gj-9066-generated-planet-d569077cea00ac968d730c15`, the inner generated rocky
planet. Current accepted radius is approximately 6,262.75 km, orbital semimajor
axis 0.123985 AU and periapsis Hill radius approximately 303,906.72 km. It has no
ring proposal; closest sampled moon periapsis is approximately 23,936.48 km.

Propose a circular station orbit at **2 host radii** (approximately 12,525.51 km
from host center), with a minimum **1,000 km surface clearance**, within **0.1
periapsis Hill radius**, and with a **1,000 km radial clearance** from ring/moon
envelopes. Derive period from host mass, resolve the parent's actual barycentric
snapshot and epoch, and reject if any exact constraint fails. This is an analytic
gameplay screen, not a long-term trajectory or environmental safety proof.
Do not choose the outer rocky planet without considering its ring proposal.

Services:

- Existing market buy/sell, quote, inventory and ledger surfaces, existing
  canonical material catalog and stock/restock rules.
- Existing station descriptor, location search and access/docking behavior.
  Trace the actual access surface before claiming docking is implemented.
- Verify dart-drone availability/acquisition through supported existing paths;
  no new equipment, recipe, station service or free provisioning invented merely
  to make an integration test green.
- Preserve station ID, stock, prices where mutable, transactions and player
  inventories on deterministic reruns, including fresh-service reads.

### 13.5 Owner approval and implementation bounds

The owner approved all four review items: the distribution, the 100-unit yield
cap, one screened body-orbit station using existing services, and the offline
Copper Vale-only boundary. This does not authorize runtime seed dispatch,
owner/live database writes, or work on the four blocked systems.

Review:

1. The 26-body material allocation above, Common-only and single-material yields.
2. Keeping the current 100-unit yield cap rather than changing mining balance.
3. One body-orbit station using the stated clearance checks, existing market
   services, no new extraction equipment/tier enforcement.
4. Keeping the other four systems blocked and the whole slice offline.

### 13.6 Copper Vale P3 offline checkpoint

Added `src/model/non-sol-p3-preview.js` and opt-in
`scripts/non-sol-p3-preview.js` / `npm run seed:non-sol:p3-preview`. It layers
versioned, deterministic resource assignments over—not into—the accepted P2
output. The initial 26 asteroids receive one Common canonical material each:
silicon 10, iron 8, carbon 4, nickel 2, copper 2. Physical estimates, IDs,
orbits, other generated bodies and P2 preview digests remain unchanged. The
P3 report digest is `cd60edffe10a2b8c14707e0b0776d16251006d769eb6fc8dbb3315dee4ed004a`.

The sole offline station candidate is `copper-vale-asteroid-exchange`, a
`siteType: station` body-orbit record anchored to
`exo-gj-9066-generated-planet-d569077cea00ac968d730c15`. The circular radius is
12,525.508295 km (2 host radii); surface clearance is 6,262.754148 km; host
periapsis Hill radius is 303,906.724201 km (station radius 0.04121498 Hill); the
closest moon-envelope clearance is 11,410.975157 km; the Kepler period is
16,283.757054 sec. The epoch is `2000-01-01T12:00:00.000Z` (snapshot
`946728000000` ms); the station snapshot resolves against the host's canonical
barycentric snapshot. Placement activation is metadata only, not runtime
activation. Repository seed definitions contain no Copper Vale market. No
owner/live database was read or written; an existing live station, if any,
remains an explicit pre-rollout check.

The existing dart-drone acquisition path is `CharacterAddMessageHandler`,
which persists an intact `expendable-dart-drone` in a new Scavenger Pod's ship
inventory. Its canonical definition lists an Iron ingredient, but there is no
crafting handler in the current backend; P3 adds no recipe or free provisioning.
The isolated Mongo test exercises that existing character-add path, then uses
the existing launch, item-upsert inventory, market quote/trade, station
materialization and location-descriptor surfaces. It verifies a 100-unit
dart-drone yield, debris/destruction persistence, station descriptor/snapshot
and undocked buy/sell behavior, no second yield from a destroyed target, and
rerun retention of composition, observability, destruction/debris, resource
profile, player ship items/credits, market stock, ledger and mutable price
multiplier. An incidental Mongo integration defect was fixed surgically:
`DatabaseService.addCharacter` now maps normalized ship `name` to the required
persisted `shipName`, allowing this acquisition-to-launch path to complete.
The launch guard added here rejects already-destroyed targets before consuming
a tool; existing retired-target and unsupported-material checks continue to
prove failures do not consume tools.

Validation:

- `node --test test/non-sol-p3-preview.test.js test/non-sol-p3.mongo.integration.test.js test/launch-item-message-handler.test.js test/non-sol-expanded-augmentation.test.js test/db-service-extended.test.js` — **34/34 pass**.
- `npm run typecheck` — **pass**.
- Scoped ESLint over the eight changed JS files — **pass**.
- Scoped Prettier over the changed JS/package files — **pass**; no repository-wide formatting or Markdown rewrite.
- `npm run seed:non-sol:p3-preview` — **pass**, 26 asteroids and approved distribution; station and clearance values above.
- `npm run seed:non-sol:preservation` — **pass**, 4,844 targets.
- `npm run seed:non-sol:progress` — **pass**, historical P0 snapshot unchanged.
- `node scripts/non-sol-celestial-preview.js --expanded --system exo-gj-9066` — P2 remains 55 additions (`4 planets, 26 asteroids, 2 comets, 7 TNOs, 16 moons`), digest `7e55a5cb10a0f35886e44f80ac93272cdf94fd0a3513f6d53998fb763dee6da3`.
- `npm test` — contract validation passed; **856/857 tests pass**. The sole failure is the existing `test/exoplanet-catalog-runtime.test.js` assertion that `scripts/non-sol-celestial-inventory.js` must not mention `exoplanet-names`; that unchanged script (same at `HEAD`) contains references at lines 47 and 310. This failure is outside P3 scope.
- Runtime `http://localhost:3000/openapi.yaml` returned 200 and normalized contents match `api/openapi.yaml`; no API schemas/endpoints changed.

Bounded status: Copper Vale's offline P3 implementation and isolated preview
chain are delivered. The four blocked systems remain untouched. This does not
claim live durable-station reconciliation, runtime activation, five-system or
global mining coverage, automatic asteroid batches, or persistent rollout.

### 13.7 Owner validation for the delivered Copper Vale slice

Run from the backend repository in PowerShell:

```powershell
npm run seed:non-sol:p3-preview
node --test test\non-sol-p3-preview.test.js test\non-sol-p3.mongo.integration.test.js test\launch-item-message-handler.test.js test\non-sol-expanded-augmentation.test.js test\db-service-extended.test.js
npm run typecheck
```

Expected: the approved 26-material allocation, exactly one station candidate
`copper-vale-asteroid-exchange`, orbit approximately 12,525.51 km and period
16,283.76 seconds; **34 tests pass**, zero failures, and typecheck passes.
The Mongo suite uses its isolated test harness, not the owner's development or
live database. It checks the existing acquisition/mining/debris/inventory/trade
chain, duplicate-mining rejection before tool consumption, fresh station reads,
descriptors and reruns retaining player/economy/history state.

The station is usable through existing market paths, but **docking is not
enforced by the current buy/sell handlers**: the integration test explicitly
reports `isDocked: false` while trades succeed. P3 does not introduce docking
enforcement or certify a new physical travel/arrival mechanic.

The saved P3 report was read back and compared to a deterministic rerun:
**passed**. The entire five-system P2 report also remains exactly unchanged,
digest `67fa0e7f29cbb545eada7a22ab2ee41670bf0ceccb178928ba0298442de76b8d`.

No server restart is needed for these CLI/test checks. A restart (or existing
watch reload) is needed to load the two coupled runtime fixes into an already
running server: destroyed-target rejection and normalized starter-ship
persistence. Restarting does not seed Copper Vale or enable this offline feature.
Do not use live mining or Nova station visibility as validation for this
unactivated slice.

Request owner acceptance of **Copper Vale's scoped P3 checkpoint**, not global
coverage. The unrelated full-suite names-file assertion above remains reported;
the other four pilot systems retain their explicit blockers.

## 14. P3 acceptance and P4 Copper Vale naming proposal

### 14.1 Startup decisions and recovered profile

Owner accepted P3 on 2026-11-07 and committed it; observed commit `cc05f60`,
clean worktree at P4 startup. No push was performed here.

The P4 form selected Copper Vale **generated bodies only**, cultural name
proposals with approval **before applying**, recovery of explicit approved
profile evidence, minimal fictional motivations/optional interest hooks, and
offline manifest/preview plus isolated tests. The other four previews stay
unchanged. No live renaming, runtime activation, artifacts, story arc or tech-tree
changes are authorized. Prettier stays deferred until major-phase completion.

Profile recovery:

- [Active system manifest](../data/system-naming-manifest.json) records approved
  Copper Vale and candidate `original-english-01`.
- [Weighted review row](../data/system-naming-weighted-batch-v1.json) explicitly
  identifies that exact system/candidate pairing as English. This is lineage
  recovery, not guessing a language from spelling.
- No approved theme is recorded in the active assignment. The older bank's
  landscape style remains unreviewed; it was not promoted automatically.
- After this gap was surfaced, the follow-up form approved **English landscape/
  navigation metaphors, with no claimed settlement history**, authorizing name
  proposal preparation only. Record this authored profile evidence in a future
  separate body manifest; do not modify the active system-naming manifest.

### 14.2 Eligibility, lanes and languages

| Generated category  | Total  | Proposed cultural names | Retain systematic labels |
| ------------------- | ------ | ----------------------- | ------------------------ |
| Planets             | 4      | 4                       | 0                        |
| Dwarf planets       | 0      | 0                       | 0                        |
| Moons               | 16     | 14 (diameter >=200 km)  | 2                        |
| Asteroids           | 26     | 0                       | 26                       |
| Outer/TNO analogues | 7      | 0                       | 7                        |
| Comets              | 2      | 0                       | 2                        |
| **Total**           | **55** | **18**                  | **37**                   |

No story-important smaller-body override was requested. The existing star and
GJ 9066 c remain unchanged and outside the 18 assignments. The station's own
name remains unchanged; its host label must agree with the renamed host in a
future offline naming layer, without changing any station identity/physics.

Proposed lanes: **11 inherited / 7 narrative**, **61.11% / 38.89%**, the nearest
whole-body split to 60/40. Protected and neutral systematic names are excluded
from that denominator; no deviation exception is needed.

Using the existing ordered [weighted palette](../data/system-naming-weight-policy-v2.json)
and Hamilton rounding across the seven frozen narrative assignments gives
English 2, Mandarin 1, Russian 1, Spanish 1, Arabic 1, Hindi 1; other languages
zero in this small sample. Combined cultural-name language counts: English 13,
five other languages 1 each. These are editorial counts, not demographics.
Do not allocate profile languages anew per single-body batch or rebalance existing
system assignments.

### 14.3 Proposed exact pairings: not yet approved

English names are original editorial proposals, not certified unique or legally
cleared. The five non-English names reuse the
[multilingual review bank](../data/system-naming-review-bank-v1.json), retaining
its **unverified sketch** status. Glosses below remain provisional; no linguistic
or cultural certification is claimed. Native script is proposed; unreviewed
transliterations from the bank are not proposed as preferred names or aliases.

Table ordering uses existing slot labels, not orbital distance or NASA discovery
letters. No Roman-numeral renumbering is proposed. Every row must be frozen by
the full body ID, not by slot text alone.

| Stable body ID                                          | Current slot / host          | Proposed preferred name | Lane / language      | Fictional motivation                                                  |
| ------------------------------------------------------- | ---------------------------- | ----------------------- | -------------------- | --------------------------------------------------------------------- |
| `exo-gj-9066-generated-planet-0ec42578e1833c74c9b54d32` | planet slot-01               | Stillglass Reach        | Inherited / English  | Landscape/navigation metaphor, not an observed lake or settlement     |
| `exo-gj-9066-generated-planet-4ec2528f0ada1e4684410f30` | planet slot-02               | Far Compass             | Inherited / English  | Navigation metaphor, not an observed magnetic property                |
| `exo-gj-9066-generated-planet-d569077cea00ac968d730c15` | planet slot-03; station host | Hearthward              | Inherited / English  | Welcome/direction metaphor, not habitation or safety certification    |
| `exo-gj-9066-generated-planet-77b0fe14208b827c13f50157` | planet slot-04               | Long Horizon            | Inherited / English  | Distance/landscape metaphor, not surface evidence                     |
| `exo-gj-9066-generated-moon-0f518a6f67c3ac5f5ca94549`   | GJ 9066 c moon slot-01       | Cairnlight              | Inherited / English  | Wayfinding marker metaphor, not a constructed cairn                   |
| `exo-gj-9066-generated-moon-8af923eda324135ab968a759`   | GJ 9066 c moon slot-02       | Quiet Bearing           | Inherited / English  | Navigation metaphor, not guaranteed dynamical stability               |
| `exo-gj-9066-generated-moon-fef4929e856700bfa496edee`   | GJ 9066 c moon slot-03       | Frostward               | Inherited / English  | Association with modeled ice, not observed surface frost              |
| `exo-gj-9066-generated-moon-ac255a0452d20436c427cdbc`   | GJ 9066 c moon slot-04       | Pale Crossing           | Inherited / English  | Passage metaphor, not a safe route                                    |
| `exo-gj-9066-generated-moon-be58ceaa180146f00e39222f`   | GJ 9066 c moon slot-05       | Lantern Shelf           | Inherited / English  | Landscape/wayfinding metaphor, not mapped topography                  |
| `exo-gj-9066-generated-moon-1a0c12ffd85268685cdda7cd`   | GJ 9066 c moon slot-06       | Northwake               | Inherited / English  | Navigation metaphor, not a new reference frame                        |
| `exo-gj-9066-generated-moon-6c87552a1096a74ebd8321ea`   | GJ 9066 c moon slot-08       | Silver Traverse         | Inherited / English  | Landscape metaphor, not a silver deposit                              |
| `exo-gj-9066-generated-moon-c43c40daff1abf911da3bbb6`   | GJ 9066 c moon slot-09       | Patient Signal          | Narrative / English  | Optional fictional survey naming motif, not actual survey history     |
| `exo-gj-9066-generated-moon-d79aed44b8d45f9dea8c5da4`   | planet slot-04 moon slot-01  | Common Promise          | Narrative / English  | Fictional cooperation/remembrance motif, no population inference      |
| `exo-gj-9066-generated-moon-81376b1ddfdb059355012eda`   | planet slot-04 moon slot-02  | 星港                    | Narrative / Mandarin | Bank's provisional "star harbor" metaphor, not an actual harbor       |
| `exo-gj-9066-generated-moon-a250c3bd19412ec8730af24c`   | planet slot-04 moon slot-03  | Заря                    | Narrative / Russian  | Bank's provisional "dawn" motif, not physical lighting evidence       |
| `exo-gj-9066-generated-moon-7e52693aa9008cb87b13cc01`   | planet slot-03 moon slot-01  | Encuentro               | Narrative / Spanish  | Bank's provisional "meeting / encounter" motif, not an authored event |
| `exo-gj-9066-generated-moon-e080baa131323de51a933b38`   | planet slot-03 moon slot-02  | أمل                     | Narrative / Arabic   | Bank's provisional "hope" motif, no demographic inference             |
| `exo-gj-9066-generated-moon-531101df2ea49c84a4f46b4b`   | planet slot-03 moon slot-03  | आशा                     | Narrative / Hindi    | Bank's provisional "hope" motif, no demographic inference             |

The giant's moon slot-07 and the outer rocky planet's small moon retain their
existing labels: each is below 200 km diameter. Do not close slot-number gaps by
moving names between bodies or changing IDs.

### 14.4 Next implementation gate and owner validation

**Proposal only:** no names applied, body manifest created, runtime consumer
activated, or database accessed.

Review the exact 18 pairings, especially station host **Hearthward** and the five
native-script sketches. Approve, replace or defer those candidates; earlier
system-name approval does not approve these body names or verify their glosses.
The eligibility/11-7 lane counts can be reviewed independently of name taste.

After pairing approval:

- Freeze a separate versioned manifest keyed by full body ID with scope/input
  digests, owner approval, lane/language, theme evidence, fictional motivation
  and gloss/review status.
- Retain each old full label as a meaningful alias. Reuse normalized collision
  checks against existing/catalog/generated preferred names and aliases; do not
  duplicate preferred names or add unreviewed transliterations.
- Layer over P3 without changing physical seeds, resources, station/market IDs,
  trajectories/snapshots or mutable history. Parent/anchor names must agree with
  ID-resolved preferred names; old saved IDs and system-qualified lookup remain
  authoritative.
- Motivations above are sufficient initial lightweight hooks. No artifacts,
  missions, resource finds, settlement/faction history or tech-tree edits.
  Unsupported public/persisted hook fields require contract review.
- Provide exact commands/results for alias collisions, name/anchor parity,
  > =200 km threshold boundaries, epoch-stable identity and P2/P3/history
  > preservation. This proposal does not mark P4 complete.

### 14.6 Approved pairings and implemented offline P4 checkpoint

Owner subsequently selected **"Approve all 18 exact pairings, accepting the five
provisional language sketches for offline use"**. This supersedes the proposal
stop in Sections 14.3-14.4 for these exact pairings only. The five glosses remain
unverified sketches, explicitly accepted for offline editorial use; no cultural,
linguistic or legal certification is claimed.

Implemented:

- [Separate body-name manifest](../data/copper-vale-body-naming-manifest-v1.json):
  exact ID-keyed assignments, owner/profile evidence, accepted P3 input digest,
  profile/candidate-bank source digest, eligibility and lane quotas. The active
  system-naming manifest and source catalog snapshots are unchanged.
- [Offline P4 naming layer](../src/model/non-sol-p4-preview.js):
  18 names, meaningful old-label aliases, authored provenance/motivations,
  system-qualified name/alias/ID lookup, normalized collision checks and
  deterministic replay validation. Minimal naming motivations supply the scoped
  fictional hooks; no new persisted/public annotation contract is invented.
- [Opt-in CLI](../scripts/non-sol-p4-preview.js):
  `npm run seed:non-sol:p4-preview`, with optional `--json` / `--out path`.
  Output publication reuses exclusive immutable-report semantics; reruns cannot
  overwrite different reviewed evidence.
- [Existing alias-deduplication helper](../src/model/system-naming.js) is exported
  for reuse, without changing system-naming behavior.

Actual counts remain **4 named planets and 14 named moons**, **11 inherited /
7 narrative**, **37 systematic-only generated labels**, **2 protected existing
bodies**. Cultural language counts: **English 13**, Mandarin/Russian/Spanish/
Arabic/Hindi **1 each**. All 57 Copper Vale celestial bodies have preserved
identities. Systematic-only labels remain the existing labels, including the
two smaller moons. The station's own name is unchanged; its trajectory
`anchorBodyName` now reads **Hearthward** in the P4 layer. Host ID, trajectory
numbers, snapshot and resources/economy remain unchanged.

The four blocked pilots are reported unchanged, with preserved P2 digests and
named blockers. Neither their bodies nor Copper Vale's default P2/P3 generation
are renamed by runtime dispatch. The P4 manifest is explicitly runtime-disabled.

Validation commands/results:

| Command / check                                                                                                                                                                                                                                                   | Result                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `node --test --test-concurrency=1 test\non-sol-p4-preview.test.js test\non-sol-p4.mongo.integration.test.js test\non-sol-p3-preview.test.js test\system-naming.test.js`                                                                                           | **21 passed, 0 failed**                                                       |
| `npm run typecheck`                                                                                                                                                                                                                                               | **Passed**                                                                    |
| `npx --no-install eslint src\model\non-sol-p4-preview.js src\model\system-naming.js scripts\non-sol-p4-preview.js test\non-sol-p4-preview.test.js test\non-sol-p4.mongo.integration.test.js`                                                                      | **Passed**                                                                    |
| `npx --no-install prettier --check data\copper-vale-body-naming-manifest-v1.json src\model\non-sol-p4-preview.js scripts\non-sol-p4-preview.js test\non-sol-p4-preview.test.js test\non-sol-p4.mongo.integration.test.js src\model\system-naming.js package.json` | **Passed** after scoped phase-completion write; no repository-wide formatting |
| `npm run seed:non-sol:preservation`                                                                                                                                                                                                                               | **Passed**, all 4,844 targets and Sol outputs preserved                       |
| `npm run seed:non-sol:progress`                                                                                                                                                                                                                                   | **Passed**, all 4,844 rollout stages remain pending                           |
| Saved P4 JSON readback/replay and exclusive identical rerun                                                                                                                                                                                                       | **Passed**                                                                    |
| Complete saved P2 and P3 report comparisons                                                                                                                                                                                                                       | **Exactly unchanged**                                                         |
| `git diff --check`                                                                                                                                                                                                                                                | **Passed**                                                                    |

Tests verify exact eligibility including **199.999998 / 200 / 200.000002 km**
diameter boundary examples, no quota double-counting, provisional language
status, collisions/protected-body failures, ID/old-alias lookup, epoch/order
independence, idempotent name application and tamper rejection. The isolated
Mongo test applies P4 to P3 records, verifies fresh canonical body-list/get and
station reads, retains aliases and resource profiles, and preserves destruction,
composition/scan history and station price/stock on reruns. No owner/development/
live database is used.

Saved report digest:
`5e580149a6df92a50495fe1fca0c1de02df714c4194ddb3b44ebaa3d933dda04`.
P3 remains
`cd60edffe10a2b8c14707e0b0776d16251006d769eb6fc8dbb3315dee4ed004a`;
the complete five-system P2 report remains
`67fa0e7f29cbb545eada7a22ab2ee41670bf0ceccb178928ba0298442de76b8d`.

**Owner validation now:**

```powershell
npm run seed:non-sol:p4-preview
node --test --test-concurrency=1 test\non-sol-p4-preview.test.js test\non-sol-p4.mongo.integration.test.js test\non-sol-p3-preview.test.js test\system-naming.test.js
npm run typecheck
```

Expect 18 cultural names, 11/7 lanes, 37 systematic labels, two protected
existing bodies, station host **Hearthward**, 21 passing tests and typecheck
success. Confirm the native-script names display as approved and old labels
remain aliases in the JSON output (`npm run seed:non-sol:p4-preview -- --json`).
No server restart or Nova/live visibility check is needed for this offline
checkpoint. No runtime activation, live rename, commit or push occurred.
P5 authorization/rollout remains a separate future gate after owner P4 acceptance.

### 14.7 P4 acceptance and future cultural variation

Owner: **"P4 is validated and green"** on 2026-11-07. The scoped Copper Vale
checkpoint is accepted; its approved names, aliases and provisional-language
disclosures remain unchanged. This does not activate runtime naming or authorize
persistent rollout.

Additional owner direction: settled fictional systems may contain many cultures,
be predominantly monocultural, or have one culture completely override others.
Future generation must assess system-specific cultural/naming regimes rather
than force the same mixed 60/40 pattern into every system.

The follow-up form clarified **naming dominance only**: all newly assigned
cultural names in a selected system may use one tradition. System-specific
regimes may override 60/40, including 100% one tradition; the owner directed
**"assume 1 in 50 may do this"**. Record **2% as the provisional selection
frequency for this complete naming-dominance exception**, not a measured
demographic frequency or a frequency for every predominantly monocultural case.
Multicultural and predominantly monocultural regime proportions remain unspecified.

Do not infer populations, ethnicity,
ownership or cultural displacement from language/name spelling. Existing
protected names and saved identities remain preserved unless separately reviewed.
No cultural displacement, settlement history or population metadata is authorized
by this naming-only rule.

This is a future design requirement, not an implemented distribution or a
retroactive change to Copper Vale. A future implementation must separately record
the selected naming regime, the 60/40 override and actual naming-language counts.
One-tradition naming does not itself establish inherited/narrative motivation
counts. The exact alternative lane allocation, deterministic selection mechanism,
rounding across a frozen scope, tradition selection and any metadata/contract
requirements still need design review. Do not force one exception into every
small preview batch or treat 2% as an exact per-batch quota.
Normal runtime activation remains unauthorized. P5 has started only for the
isolated Copper Vale slice described below.

## 15. P5 isolated Copper Vale pilot - accepted scoped checkpoint

The owner selected Copper Vale end-to-end first, with the other four assessed
systems still blocked. The provisional 2% naming-dominance rule is deferred.
No owner/development database writes, normal runtime activation, commits, pushes,
or bulk rollout are authorized. This slice does not satisfy the full 20-30-system
representative pilot gate.

### 15.1 Isolation and startup

The owner selected separate backend and Nova frontend ports, keeping normal
Forge on 3000 and Nova on 4200 running unchanged.

- Run `npm run pilot:copper-vale -- --isolated` in Forge. The launcher creates
  its own temporary loopback Mongo process and a backend on an OS-assigned port;
  caller-supplied database URIs and port overrides are rejected.
- The backend worker receives the temporary URI through parent IPC, uses a
  sanitized environment and an empty temporary working directory, and connects
  without a database fallback. Contract startup preflight remains enabled.
- Only the accepted P4 Copper Vale preview is persisted: 57 bodies and
  `copper-vale-asteroid-exchange`, through canonical database/market services.
  Readback checks every supplied physical/resource/naming value, aliases and
  station placement. Canonical schema-added optional null fields are allowed.
- The readback digests remain P3
  `cd60edffe10a2b8c14707e0b0776d16251006d769eb6fc8dbb3315dee4ed004a`
  and P4
  `5e580149a6df92a50495fe1fca0c1de02df714c4194ddb3b44ebaa3d933dda04`.
- In the adjacent Nova checkout, run `npm run start:pilot:copper-vale`.
  Open `http://127.0.0.1:4201/(left:registration)?pilotApiPort=PORT`,
  replacing `PORT` with the launcher's reported backend port.
  This opt-in build rejects port 3000, non-loopback pages and absent/invalid
  endpoints rather than connecting to the normal database. The selected port
  persists only in this frontend tab's session storage for navigation/refresh.
  Production and normal development endpoint configuration are unchanged.
- Register a temporary pilot account through the normal UI; existing account
  credentials/session state are not copied. Closing the browser does not stop
  the services. Stop the launcher with Ctrl+C for graceful backend/Mongo cleanup,
  then stop the separate Nova process. The temporary data is not a deployment.

### 15.2 Verification recorded on 2026-11-07

- **Passed, 11 tests:** `node --test --test-concurrency=1 test\copper-vale-isolated-pilot.test.js test\non-sol-p4-preview.test.js test\non-sol-p4.mongo.integration.test.js`.
  Covers opt-in refusal, isolated persistence/readback, real health/Socket.IO
  readiness, shutdown, P4 naming/physical preservation and Mongo history.
- **Passed:** `npm run typecheck` in Forge.
- **Passed, no warnings:** `npx --no-install eslint scripts\copper-vale-isolated-pilot.js scripts\copper-vale-isolated-worker.js src\model\copper-vale-isolated-pilot.js test\copper-vale-isolated-pilot.test.js`.
- **Passed:** `npm run seed:non-sol:preservation`, all 4,844 accepted P0 targets.
- **Passed, 8 tests:** `npm run test:vitest -- src\environments\pilot-api-url.vitest.ts`
  in Nova; **passed:** `npm run typecheck:app`.
- **Passed:** `npx --no-install ng build --configuration copper-vale-pilot`;
  **passed:** `npx --no-install eslint src\environments\environment.pilot.ts src\environments\pilot-api-url.ts src\environments\pilot-api-url.vitest.ts`.
- **Browser startup verified:** registration UI loads in a separate browser
  context; the real Socket.IO WebSocket connects to the temporary backend.
  Normal Forge/Nova listener PIDs remained unchanged.
- Prettier has not run: P5 is not at major-phase completion.

### 15.3 Remaining owner/UI gates

- [x] Persist and read back the accepted Copper Vale preview in isolated Mongo.
- [x] Start a separately configured Nova and verify its actual backend connection.
- [x] Register/login and create a temporary character through normal UI in the
      isolated context.
- [x] Inspect Copper Vale as a destination, its body table, all 18 approved
      names and its station.
- [x] Resolve destination-list counts; automated checks and owner normal-Nova
      confirmation passed (Section 16.1).
- [ ] Inspect Copper Vale resource/scan views when Nova location access is
      available; owner deferred this unavailable check on 2026-11-08.
- [ ] Verify mining/inventory/trading through real UI and fresh backend reads,
      preserving earlier P3 balance and the known lack of docking enforcement.
      **Unavailable for now:** the owner reports no Nova navigation path to
      these locations. Revisit after travel/location access exists, not as a
      prerequisite for moving to the next assessment. This is not a passed test.
- [x] Record scoped owner P5 acceptance (Section 15.6).
- [ ] Separately select/approve further systems.

Normal character creation currently starts ships in Sol. Do not report Copper
Vale gameplay validation merely because the pilot database and registration page
are ready. Determine the supported destination/ship-location path during UI
validation, and explicitly review any required pilot-only setup.

### 15.4 First real Nova inspection

The owner registered and created a temporary pilot character and completed the
initial screens. Using the operations menu's **Viewer**, searching **Copper Vale**
and selecting the result successfully opened the system detail table and 3D
viewer. The detail table contains **58 rows: 57 bodies plus one station**.
All 18 owner-approved preferred names are present, including the five
provisional non-English spellings. Detail type groups show star 1, planets 5
(rocky 2, super-Earth 1, sub-Neptune 1, gas giant 1), moons 16, asteroids 26,
TNOs 7, comets 2 and station 1. The station's displayed site name is
**Copper Vale Inner Planet Orbital Station**; its market ID remains
`copper-vale-asteroid-exchange`.

Two findings remain explicit:

1. The **destination list** displays catalog planet/moon counts (1/0), while the
   **detail table** correctly displays the augmented 5/16. Live asteroid/market
   counts already display 26/1. `SolarSystemListMessageHandler` currently enriches
   only asteroid/market counts; planets/moons come from the frozen registry.
   Resolve this live-versus-catalog distinction, including `minPlanetCount`
   filtering, before claiming consistent P5 destination counts.
2. The temporary starter ship is in **Sol**, so Copper Vale detail targeting is
   not a Copper Vale mining/trading verification. No ship has been moved and no
   Copper Vale asteroid has been mined by this inspection. Review a pilot-only
   staging setup or a supported travel path before completing the gameplay gate.

A direct deep-link navigation without the existing character navigation state
showed `missing-session`. Returning to the original game history and using the
normal menu resolved the inspection without another login. Owner validation
should use **Viewer -> search Copper Vale -> select result**, not a bare details
URL as evidence of a successful normal navigation flow.

### 15.5 Count correction and market review

The owner selected **fix counts only; defer ship staging**. No temporary ship was
moved, and no market expansion is authorized by this selection.

The count correction is implemented in normal list and get response paths:
live planets/moons now contribute to destination counts alongside asteroids,
without reducing frozen catalog baselines for unseeded/partially materialized
systems. `minPlanetCount` uses enriched counts before paging, so Copper Vale
matches 5 and does not match 6. The get response summary also reports 5 planets,
16 moons and 26 asteroids. The registry's source counts remain unchanged.

- **Passed, 20 tests:** `node --test --test-concurrency=1 test\solar-system-list-message-handler.test.js test\solar-system-get-message-handler.test.js test\solar-system-pilot-counts.mongo.integration.test.js test\copper-vale-isolated-pilot.test.js`.
- **Passed:** `npm run typecheck`, scoped ESLint for the changed handlers/tests,
  `git diff --check`, and `npm run seed:non-sol:preservation`.
- The currently running temporary backend predates this correction. It was left
  running to preserve the owner's current review/account. Restarting the launcher
  loads the corrected code but creates a new temporary database/backend port;
  register/create a fresh pilot character afterward. Reopen Nova with the new
  `pilotApiPort`, then validate through **Viewer -> Copper Vale**: card counts
  must be **5 planets, 16 moons, 26 asteroids, 1 market**, agreeing with detail
  groups. Browser confirmation of the corrected card remains pending restart.

The owner noted Copper Vale feels short on markets. **There is exactly one
seeded market for the entire Copper Vale system in this approved pilot.**
P3 supplied the minimum usable station, not a calibrated settlement/economic
density or a claim that one market is sufficient for a developed system.
Additional stations/markets, their roles, physical placements and system-specific
settlement intensity need a reviewed proposal before altering the accepted
P3/P4 preview. No extra markets have been generated yet.

The separate [market-density feature handoff](seed-market-density-2026-11-07.md)
captures the baseline, open owner decisions, implementation surfaces, progress
tracker and validation gates for continuation in another session.

### 15.6 Owner acceptance

On 2026-11-07 the owner stated: **"P5 is green and accepted"** and reported
committing the changes without pushing them.

Record acceptance for the reviewed Copper Vale slice: isolated Mongo/backend
startup and readback, separate Nova connection, normal registration/character
creation, destination/detail inspection, all 18 preferred names and the
implemented count correction with its automated verification.

This acceptance does not turn deferred checks into completed evidence:
corrected destination-card browser confirmation remains pending restart;
ship staging and Copper Vale mining/trading UI validation remain deferred.
Market-density expansion is a separate planning feature. The four blocked
systems and broader 20-30-system representative pilot requirements remain
unresolved. No owner-database writes, bulk activation, P6 implementation or
push is authorized by this acceptance.

The owner-reported commit is not identifiable from this checkout at acceptance
time: local HEAD still shows `cc05f60` and P4/P5 files remain modified/untracked.
Do not discard these files or assume they are safely committed; reconcile the
checkout/commit location before later publishing.

### 15.7 P6 isolated lifecycle implementation - owner validation pending

The owner approved P6 for **Copper Vale only**, using only the isolated,
internally owned Mongo harness. The other four systems remain explicitly
blocked. No market expansion, ship staging, mining/trading UI work, normal
runtime activation, owner/development database writes, commit or push is part
of this scope. Implementation completion is not owner acceptance.

`src/model/copper-vale-seed-lifecycle.js` now owns the bounded lifecycle:

- `dry-run` checks the current durable scope/checkpoint, reports ready,
  resumable, verified or blocked status, and performs no writes.
- `apply` requires a clean Copper Vale scope, journals its expected IDs and
  hashes before writes, upserts through canonical body/market services, and
  checkpoints each body only after durable readback of its actual expected
  fields.
- `resume` accepts only an existing matching interrupted checkpoint; it
  verifies and adopts an exact body write that landed before its checkpoint.
- `readback` uses fresh database-service reads and verifies exact expected IDs,
  expected hashes/revisions, actual seed-owned fields and station fields.
  Completion is recorded only after the full expected ID set and station pass.
- `rollback` only considers journaled, pristine, unchanged body records from an
  incomplete run. It refuses to delete gameplay-mutated records and does not
  remove a station or a completed seed. No reviewed station/body retirement
  policy exists, so completed/used records are explicitly refused rather than
  silently deleted or reset.

The durable state keeps separate source, physical, resource, naming and station
SHA-256 digests and revision labels. A changed P3/P4 input or catalog produces
a plan mismatch and pauses for owner re-review; it never auto-refreshes an
existing seed. Re-running a completed matching apply performs verified
readback only. Gameplay-mutated body fields and station inventory/ledger are
preserved; an existing station is verified, never re-upserted.

The existing opt-in `npm run pilot:copper-vale -- --isolated` launcher now runs
P6 apply in the private worker against its internally created loopback
`copper-vale-p6` Mongo database. It still rejects arbitrary URI/port overrides,
uses no fallback database, and leaves normal backend defaults untouched. The
returned launcher handle can request the bounded lifecycle operations over
private IPC; no HTTP endpoint or public API contract was added. The isolated
Mongo is intentionally temporary: after launcher shutdown/crash its data is
deleted, so resume applies only while that same isolated database remains
available and is not a cross-launch recovery guarantee.

P6 focused evidence (2026-11-08):

- **Passed, 7 Mongo integration tests:** `node --test --test-concurrency=1 test\copper-vale-seed-lifecycle.mongo.integration.test.js`.
  Covers no-write dry-run; apply/idempotent rerun and fresh-service readback;
  write-before-checkpoint interruption and resume; source/physical/resource/
  naming/station refresh digests and mismatch refusal; missing/tampered bodies
  and durable expected hashes; preservation of destroyed/mined-body state and
  traded station stock/ledger; and rollback of only pristine journaled records.
  Also covers interruption after station persistence but before checkpoint,
  adopting the existing station on resume without resetting stock or a
  gameplay-adjusted price multiplier.
- **Passed, 2 isolated launcher tests:** `node --test --test-concurrency=1 test\copper-vale-isolated-pilot.test.js`.
  Includes loopback-owned startup, private IPC dry-run/readback, real health and
  Socket.IO readiness, explicit opt-in, and cleanup.
- Backend typecheck and scoped ESLint passed; `git diff --check` passed.
- No OpenAPI/runtime HTTP contract changed; `openapi.yaml` remains unchanged.
- No Prettier was run, per phase instructions.

Owner validation remains required before recording P6 acceptance. Review the
separate hashes/revisions and refresh refusal, interrupt/resume evidence,
mutation-preserving readback, rollback refusal for completed/used state, and
the temporary-database recovery limitation. Explicitly decide whether any
retirement policy should be reviewed in a later scope. Continue to defer ship
staging/mining UI, market expansion and all four blocked systems.

Owner validation commands from the Forge root:

```powershell
node --test --test-concurrency=1 test\copper-vale-seed-lifecycle.mongo.integration.test.js test\copper-vale-isolated-pilot.test.js test\solar-system-pilot-counts.mongo.integration.test.js
npm run typecheck
npm run seed:non-sol:preservation
```

The combined test command passed **10 tests** on 2026-11-08. Expect the same:
body and station interruption recovery, exact durable reconciliation,
gameplay-preserving reruns, explicit refresh/rollback refusal, isolated transport,
and list/get counts of 5 planets, 16 moons, 26 asteroids and 1 market.
Typecheck must pass; preservation must report all 4,844 accepted targets intact.

No manual database edits or ship moves are needed for this checkpoint.
Owner acceptance should explicitly acknowledge that this is temporary-database
resume, not recovery across launcher shutdown; completed/used-record retirement
remains unapproved. Corrected Nova card inspection is optional follow-up using
the separate pilot frontend and the new launcher-reported backend port.
Prettier remains deferred until the phase-completion formatting pass.

### 16.1 Authorized persistent Copper Vale apply

On 2026-11-08 the owner explicitly authorized Copper Vale only in
`mongodb://localhost:27017/solid-train` after a clean preflight, personally
confirmed the database reset and target, and stopped Forge for the apply window.
No assistant database drop, ship staging or market expansion was authorized.

Added `npm run seed:copper-vale:persistent` with explicit local target/action
arguments and `--confirm-write=exo-gj-9066` for apply/resume. It refuses writes
while Forge port 3000 is reachable, requires matching clean/resumable lifecycle
preflight, and verifies hashes/counts of protected collections before/after.
No persistent rollback/delete command is exposed.

**Actual apply and independent fresh readback passed:** 57 exact body IDs,
one approved station, complete durable checkpoint, protected non-Copper-Vale
and player data unchanged. Plan digest:
`b8b9a82b42c57b5aa78ba330a6a632f986669bb44e5ab423e78911698304ba7f`.
The existing 5,146 other celestial records, 17 other markets, eight other
game-state records and catalog/NPC/registry data were preserved during apply.

Commands executed successfully:

```powershell
node scripts\copper-vale-persistent-seed.js --target=mongodb://localhost:27017/solid-train --action=dry-run
node scripts\copper-vale-persistent-seed.js --target=mongodb://localhost:27017/solid-train --action=apply --confirm-write=exo-gj-9066
node scripts\copper-vale-persistent-seed.js --target=mongodb://localhost:27017/solid-train --action=readback
```

Persistent CLI argument/protection/end-to-end tests passed (3 tests against
temporary Mongo), plus the existing 7 lifecycle tests. Typecheck and initial
scoped lint passed. These changes introduce no automatic startup rollout.

The owner will run `npm start` personally. Normal Forge startup also performs its
existing Sol/Alpha/Barnard, catalog/registry and NPC initialization; that is
distinct from this Copper-Vale-only apply. In normal Nova on port 4200, use
**Viewer -> search Copper Vale -> select** and confirm 5 planets, 16 moons,
26 asteroids, one market, all 18 approved names and 58 body/station detail rows.
On 2026-11-08 the owner confirmed **"Nova confirmation is green"** for this
persistent Copper Vale validation. The normal-Nova consumer checkpoint is
complete. Overall owner P6 acceptance remains separate; market expansion,
ship staging/mining UI and the four blocked systems remain deferred.

## 17. Next assessment: broader P2 calibration and representative selection

On 2026-11-08 the owner selected **broader P2 scientific calibration and
representative-system selection** after closing the market-density presentation
slice. Gameplay-loop validation is unavailable until Nova supports location
navigation; it is not a prerequisite for this assessment and is not verified.

Start with these bounded steps:

1. Separate observed occurrence evidence from authored addressable sample
   budgets in scientific policy v2. Its log-uniform candidate draws, uniform
   counts and Copper Vale envelope are not fitted population frequencies.
2. Assess presently supported planet regimes first: rocky/super-Earth,
   sub-Neptune, ice giant and cold gas giant. Record host-mass, orbital-period,
   detection-selection and known-system conditioning limits for each source.
   Do not extrapolate one survey's frequency to every registry target.
3. Treat moons, rings and asteroid/comet/TNO representatives as a separate
   uncertainty tier. Distinguish population occurrence from the number of
   addressable gameplay representatives. Do not invent measured frequencies.
4. Inventory eligible representative candidates from the frozen P0 registry,
   spanning host classes, planet architectures and source quality; propose exact
   IDs and explain exclusions before freezing a larger pilot.
5. Retain the four existing blocked systems as explicit challenge cases.
   Their inclusion in review does not authorize generated additions. Unsupported
   families remain visible in the coverage matrix, not silently discarded.
6. Present cited calibration assumptions, proposed budget changes and candidate
   IDs for owner review before changing any policy or generating new previews.

This is assessment authority only: no catalog repair, regeneration of accepted
Copper Vale, new naming-profile assignment, persistent writes or bulk activation.
Settlement-profile distribution and remaining cultural variation are separate
future decisions. The broader 20-30-system pilot is still not frozen.

**Assessment update (2026-11-08):** Section 18 records the initial published
occurrence evidence, uncertainty limits, a 25-system review roster (the current
five plus 20 new one-star catalog candidates), a staged review order and
owner-review-only sample-budget proposals. The owner accepted that roster as
**provisional only** and selected a source/architecture audit of the exact
eight Stage A systems before any new preview proposal; see Section 19. This is
a cited desk assessment, not a completed conditional occurrence model or a
frozen/eligible target list. The four named challenge systems remain blocked,
moons/minor bodies remain an uncertainty gap without numerical calibration,
and no policy or generator values were changed. No preview or generation is
authorized.

**Coupled catalog/P6 consumer caveat (2026-11-08):** subsequent density preflight
revealed normal lazy catalog seeding had advanced two base-body snapshots to
current `asOf` because its ordinary seed marker was absent after independent P6
apply. Normal Nova display success did not prove durable baseline preservation.
The backend now gives the durable P6 journal precedence, verifies exact approved
source/body invariants before adopting the normal marker, and blocks mismatches
and explicit force refresh for owner review without body repair. Isolated normal
get/restart plus six-market-overlay tests cover this interaction. Persistent
readback initially blocked on star epoch and planet epoch/three position
coordinates; valid shared current `updatedAt` values remain mutable.
The owner subsequently authorized the five-leaf-field repair, which passed
exact-old-value guards and unchanged-data verification. Density apply/readback
then verified six markets with all 57 bodies preserved, and the owner confirmed
the expanded destinations in Nova. See the
[density deployment record](seed-market-density-2026-11-07.md#authorized-persistent-expansion-and-nova-validation).
This completed repair does not authorize future catalog refreshes or expansion.

## 18. Broader P2 evidence and representative-system assessment

**Status: provisional roster accepted, assessment only (2026-11-08).** The
owner accepted the 25-entry review roster provisionally and selected the exact
eight Stage A candidates for the next source/architecture audit. This does not
calibrate a complete probability model, approve a new system for generation,
or change the policy. The roster remains a review cohort, not a replacement
for the protected registry, a population sample, or an approved universe-wide
rollout.

### 18.1 Scope and evidence rules

The supported review families are **rocky, super-Earth, sub-Neptune, ice
giant, and cold gas giant**. Those names are implementation-facing appearance
families, not five equivalently measured scientific occurrence classes.
Published studies often use radius bins, minimum mass, period or semimajor axis,
and survey-specific host selections. In particular, radius or mass does not
identify surface composition: an “ice giant” in this plan cannot be treated as
a measured ice composition or assigned an occurrence rate by relabeling a
Neptune-sized bin.

Keep three different quantities separate:

1. **Published population occurrence** is a survey- and domain-specific
   estimate, e.g. average planets per surveyed star or the fraction of surveyed
   stars with at least one planet. Its denominator, completeness model, planet
   definition and uncertainty must accompany it.
2. **Existing catalog entries** are detected/archive-listed planets around
   already-known hosts. The registry deliberately selects systems with known
   planets; their counts are not a random draw from the field-star population.
3. **Authored addressable samples** are bounded, optional gameplay additions.
   The v2 policy's uniform count and log-uniform candidate draws are authored
   exploration envelopes, not a fit to any occurrence paper.

Consequently, a marginal rate such as “giant planets per FGK star” is not the
conditional probability of adding another giant to a particular catalog system
whose known planets have already been selected and modeled. That requires an
architecture/multiplicity model conditioned on detected planets, host
properties, survey selection, and completeness. None is claimed here. Do not
apply any one paper's rate to all 4,844 registry targets, or use catalog row
counts as a substitute for survey completeness.

### 18.2 Verified primary occurrence and classification evidence

The following links were fetched and their abstracts or article text checked
for the stated methods, units and domain. Values below are reported only in the
published domains; where a paper's abstract does not define a category boundary
needed by this project, that limitation is explicit.

| Primary source                                                                                            | Published result and measured domain                                                                                                                                                                                                                                                                                                                                               | Method, selection and uncertainty/transfer limits                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Dressing & Charbonneau (2015), full four-year Kepler M-dwarf analysis](https://arxiv.org/abs/1501.01623) | For M dwarfs, **2.5 ± 0.2 planets per star** with radii **1–4 R⊕** and periods **<200 days**. Their narrower <50-day bins include 0.56 (+0.06/−0.05) Earth-size (1–1.5 R⊕) and 0.46 (+0.07/−0.05) super-Earth (1.5–2 R⊕) planets per M dwarf. These are average planet counts in stated radius/period bins, not probabilities for an individual known system.                      | The authors searched the full Kepler data set, assessed false-positive likelihoods, and injected/recovered **2,000 transit signals per target star** to estimate detection sensitivity. Transit geometry, the paper's M-dwarf target selection, radius boundaries and period cut all limit transfer. The 1.5–2 R⊕ label is the study's radius bin, not a universal interior/composition boundary; it says nothing about cold ice giants or long-period planets.      |
| [Hsu et al. (2019), Kepler DR25 + Gaia DR2 FGK occurrence](https://arxiv.org/abs/1902.01417)              | The modeled grid covers **0.5–16 R⊕** and **0.5–500 days** for FGK stars. For **0.75–1.5 R⊕, 237–500 days**, the paper reports an occurrence upper limit **<0.27 planets per FGK star at the 84.13th percentile**. Its 0.03–0.40 and differential **Γ⊕ = 0.06–0.76 per star per dlnP·dlnR** values in that same bin are recommended planning ranges, not measured point estimates. | Uses the DR25 planet-candidate catalog, Gaia DR2 stellar radii, Kepler pipeline/robovetter efficiencies and a hierarchical Bayesian model. The abstract notes possible false-alarm contamination could lower the true rate by about a factor of two, while the upper limit is robust at about 10%. The full radius-period grid is not one rate for “rocky” or “sub-Neptune”; table/bin extraction and a class mapping would be needed before using a narrower value. |
| [Cumming et al. (2008), Keck Planet Search](https://arxiv.org/abs/0803.3357)                              | A power-law fit reports **10.5% of solar-type stars** with a planet of minimum mass **0.3–10 MJup** and period **2–2,000 days**. Its separately quoted **17–20% within 20 AU** is an extrapolation, not the same measured interval.                                                                                                                                                | Eight years of radial-velocity observations; the authors model each star's detection threshold and correct for completeness. The reported detection statement is conditional on periods <2,000 days, amplitudes >20 m/s and eccentricities <0.6. Mass is RV minimum mass; the period interval includes warmer/shorter-period giants and is not a cold-giant-only occurrence rate. Fit uncertainty and extrapolation assumptions must not be discarded.               |
| [Fulton et al. (2021), California Legacy Survey II](https://arxiv.org/abs/2105.11584)                     | For its giant-planet population, **14.1 (+2.0/−1.8) planets per 100 stars** at **2–8 AU**, and **8.9 (+3.0/−2.4) per 100 stars** at **8–32 AU**. The paper finds occurrence increases near 1 AU and a fall-off at larger separations is favored. These are planets-per-star rates, not host-star probabilities.                                                                    | High-precision RV occurrence analysis spanning 0.03–30 AU and FGKM targets; the paper reports host-mass and metallicity dependencies and also discusses 0.1–1 MJup sub-Jovian planets. The exact paper mass selection and completeness surface must be matched before mapping its “giant” bins to code families. Do not combine these rates with the Cumming or Montet values as if they were the same sample/domain.                                                |
| [Montet et al. (2014), TRENDS M-dwarf giant companions](https://arxiv.org/abs/1307.5849)                  | Reports **6.5% ± 3.0% of M dwarfs** with one or more companions of **1–13 MJup, 0–20 AU** in its analysis.                                                                                                                                                                                                                                                                         | Combines RV trends and high-contrast imaging for **111 M dwarfs selected for RV acceleration**, with a median 29 RV observations over 11.8 years; imaged-companion characterization relies on evolutionary models. The trend-selected sample and imaging sensitivity make this a useful method-specific constraint, not an unconditional rate for all M dwarfs or a conditional rate for a known catalog host.                                                       |
| [Chen & Kipping (2017), probabilistic mass-radius relation](https://arxiv.org/abs/1603.08614)             | A probabilistic mass-radius relation is fit to **316 well-constrained objects** and distinguishes Terran, Neptunian, Jovian and stellar regimes; it reports a transition near **2.0 (+0.7/−0.6) M⊕**.                                                                                                                                                                              | This is a mass/radius forecasting and classification model, not an occurrence survey. It includes observational errors, hyperparameter uncertainty and intrinsic dispersion. It cannot certify surface composition, nor supply the frequency of ice giants, super-Earths, or any family around the selected registry stars.                                                                                                                                          |

**What these papers do not calibrate:** the sources above do not establish a
composition-defined ice-giant frequency, a system-conditioned extra-planet
rate for the 20 proposed hosts, or calibrated moon/ring/asteroid/comet/TNO
counts for this addressable universe. Hsu's broad radius grid includes
Neptune-sized radii, but it does not turn a radius bin into an “ice giant”
composition class. Do not force any of these categories to appear. Moons and
minor bodies remain an uncertainty/gap tier; numerical calibration is deferred.

### 18.3 Proposed 25-system review cohort

The exact stable IDs and current counts below were read from the canonical
solar-system registry and exoplanet catalog builder at
`2000-01-01T12:00:00.000Z` (J2000). The 20 new entries are all single-star in
the current registry (`starCount = 1`, `declaredStarCount = 1`); this only
describes the checked-in grouping and does not prove that no wider or
unresolved companion exists. Their catalog planet counts are existing source
records, **not proposed additions**. The five retained entries are the current
assessment set: Copper Vale plus the four explicitly blocked challenge cases.

The primary-star values are the registry's stored point inputs in
`M☉ / R☉ / K` (mass / radius / effective temperature); `—` means the checked-in
spectral-type field is absent. They are not uncertainty intervals. The
checked-in host and planet records do not carry asymmetric/error-bar fields
for these point values, so this assessment does not manufacture uncertainties
or imply that estimates are measurements.

#### Stage A — narrow first review, eight candidates

Priority means “first source/eligibility audit,” not scientifically eligible
for generation or a request to add a body.

| Exact registry ID | Catalog host | Primary spectral type; M☉ / R☉ / K | Existing planet records | Screening reason and unresolved checks                                                                                                                                                                                                      |
| ----------------- | ------------ | ---------------------------------- | ----------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exo-kepler-186`  | Kepler-186   | M1; 0.478 / 0.472 / 3,788          |                       5 | Single-host, five transit records around an M dwarf; useful small-planet survey comparison. Reconcile this archive snapshot's radius/period values with the selected occurrence bins; no inferred occurrence for this already-known system. |
| `exo-kepler-11`   | Kepler-11    | —; 0.961 / 1.065 / 5,663           |                       6 | Six transit records around a near-solar-mass host provide a compact multi-planet comparison. Recheck measured mass/radius uncertainties and whether any class label relies on an estimate.                                                  |
| `exo-kepler-36`   | Kepler-36    | —; 1.034 / 1.634 / 5,979           |                       2 | Two transit records; useful contrasting small-planet architecture. The host's stored radius is large relative to its stored mass and needs a current-source/stellar-parameter check before physical classifications are used.               |
| `exo-kepler-62`   | Kepler-62    | K2 V; 0.690 / 0.640 / 4,925        |                       5 | Five transit records and a K host bridge the M-dwarf and FGK survey domains. Review the exact host/sample definition and each planet's radius-period bin; no rate transfer to a known multi.                                                |
| `exo-hd-40307`    | HD 40307     | K2.5 V; 0.770 / 0.7167 / 4,956     |                       5 | Five RV records, a nearby K host and catalog metallicity −0.31 dex offer an RV/small-host comparison. Three records lack a source radius; RV minimum masses and class labels must not be mistaken for measured radii or compositions.       |
| `exo-toi-700`     | TOI-700      | M2.5 V; 0.417 / 0.4104 / 3,459     |                       4 | Four transit records around an M host; review the catalog snapshot's discovery/status and radius-period support before comparing against Kepler M-dwarf rates.                                                                              |
| `exo-l-98-59`     | L 98-59      | M3 V; 0.2923 / 0.3155 / 3,415      |                       5 | Five records from transit and RV methods; useful cross-method M-dwarf sample. Separate radius-measured from RV-mass information and reconcile their source epochs before any physical-family mapping.                                       |
| `exo-47-uma`      | 47 UMa       | G0 V; 1.060 / 1.2133 / 5,872       |                       3 | Three RV giant-planet records give the first long-period/giant architecture check. Published cold-giant occurrence is population-level, not a probability of inserting another giant into this known-giant system.                          |

**Owner decision (2026-11-08):** Accept the 25-system roster and Stage A /
Stage B ordering as **provisional only**. This acceptance approves the bounded
source audit in Section 19, not the host/planet inputs as authoritative, any
candidate's eligibility, an addition, or a preview. Stage A's exact eight IDs
are the only targets in that audit.

#### Stage B — conditional source/architecture review, twelve candidates

These are retained in the proposed roster for coverage, but each has a
specific extrapolation, data-quality, or model question that should be resolved
before considering a preview.

| Exact registry ID | Catalog host | Primary spectral type; M☉ / R☉ / K | Existing planet records | Screening reason and unresolved checks                                                                                                                                                                        |
| ----------------- | ------------ | ---------------------------------- | ----------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exo-trappist-1`  | TRAPPIST-1   | M8.0 V; 0.0898 / 0.1192 / 2,566    |                       7 | Seven transit records and very low-mass ultracool host; its temperature/host regime is not a safe stand-in for the Kepler M-dwarf calibration sample. Audit sensitivity, masses and multiplicity selection.   |
| `exo-kepler-42`   | Kepler-42    | M; 0.130 / 0.170 / 3,068           |                       3 | Three transit records around a very low-mass host; explicitly test the lower-host-mass/temperature boundary instead of extrapolating a broader M-dwarf mean.                                                  |
| `exo-kepler-138`  | Kepler-138   | M1 V; 0.535 / 0.535 / 3,841        |                       4 | Four records include transit-timing-variation discovery information. Keep timing-derived masses and transit radii/error covariance together; do not infer ice composition from an “ice-giant” display family. |
| `exo-kepler-32`   | Kepler-32    | M1 V; 0.580 / 0.530 / 3,900        |                       5 | Five transit records around an M host extend multiplicity coverage. Reconcile the current source masses/radii and architecture before assigning any family-specific budget.                                   |
| `exo-kepler-80`   | Kepler-80    | K5; 0.730 / 0.678 / 4,540          |                       6 | Six transit records provide a higher-multiplicity comparison. Verify the source-derived physical classes rather than treating generated game archetypes as measurements.                                      |
| `exo-kepler-289`  | Kepler-289   | —; 1.080 / 1.000 / 5,990           |                       4 | Four transit records; one source eccentricity is absent. Preserve that as unresolved, not as a circular-orbit measurement, and review the host/planet source uncertainties.                                   |
| `exo-hd-10180`    | HD 10180     | G1 V; 1.060 / 1.109 / 5,911        |                       6 | Six RV records give a useful giant/low-mass architecture stress case. Three source records lack radii; check the fitted signal solution and RV minimum-mass semantics.                                        |
| `exo-hd-69830`    | HD 69830     | K0 V; 0.860 / 0.8869 / 5,385       |                       3 | Three RV records make a low-mass/giant-transition comparison. Do not map the RV masses to a radius-based family without an explicit forecast and its uncertainty.                                             |
| `exo-gj-876`      | GJ 876       | M2.5 V; 0.320 / 0.300 / 3,293.74   |                       4 | Four RV records around an M dwarf; audit source orbital correlations and system-level dynamical constraints before considering independent-orbit additions.                                                   |
| `exo-gj-581`      | GJ 581       | M3.0 V; 0.295 / 0.302 / 3,500      |                       3 | Three RV records; reconcile current source solutions, aliases and status before treating the snapshot's “confirmed” labels as independent adjudication.                                                       |
| `exo-hd-20794`    | HD 20794     | G6 V; 0.790 / 0.930 / 5,368        |                       4 | Four RV records; verify current publications, aliases and orbit solutions before treating every archive row as a secure architecture constraint.                                                              |
| `exo-hd-95086`    | HD 95086     | A8 III; 1.600 / 1.4867 / 7,595     |                       1 | One direct-imaging record around a hotter host. Check the young-planet age/luminosity-to-mass model and the missing source eccentricity; this is not RV giant-occurrence evidence.                            |

All 20 proposed entries are catalog-backed, one-star registry systems. The
snapshot records label their 85 planets confirmed, but this is an archive field,
not a fresh literature adjudication. Source-record audit found three missing
planet radii each in HD 40307 and HD 10180, a missing eccentricity in Kepler-289
and HD 95086, and no reported asymmetric uncertainty fields for the host
point-values. Missing quantities remain missing; neither generated physical
fallbacks nor game `planetType` labels repair them. Any newly identified
multiplicity, inconsistent host facts, or orbit/status discrepancy moves the
candidate to **provisional/unresolved** and blocks generation pending review.

#### Retained current five and protected blockers

Retain the assessment baseline IDs `alpha-centauri`, `barnards-star`,
`exo-gj-9066` (Copper Vale), `cygnus-x1`, and `exo-hr-8799`. Copper Vale is
the existing accepted isolated pilot, not authority to regenerate or expand
its protected names/bodies/markets. Keep these four policy blockers exactly as
they stand:

| Exact ID         | Existing blocker                          | Required future evidence; no repair here                                              |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `alpha-centauri` | `MULTIPLE_STAR_MODEL_REQUIRED`            | Reviewed triple hierarchy, binary stability and irradiation model.                    |
| `barnards-star`  | `STELLAR_SOURCE_RECONCILIATION_REQUIRED`  | Reconcile the inconsistent stellar inputs; preserve the catalog record.               |
| `cygnus-x1`      | `COMPACT_REMNANT_MODEL_REQUIRED`          | Binary phase/geometry, radiation and survival model.                                  |
| `exo-hr-8799`    | `CORRELATED_ORBIT_THERMAL_MODEL_REQUIRED` | Correlated orbital solution and young self-luminous-giant temperature interpretation. |

In particular, HR 8799's current four planet records remain the protected
baseline; their stored independent orbital envelopes and game labels do not
authorize another body or justify a repair. Barnard's Star, Alpha Centauri and
Cygnus X-1 likewise remain challenge cases, not “empty” systems. No names,
catalog records, policy blockers, or current body counts were changed.

### 18.4 Candidate-selection result and baseline verification

The 25-entry roster contains the retained five plus 20 new catalog IDs. The
new candidates span stored primary masses from **0.0898 to 1.60 M☉** and
effective temperatures from **2,566 to 7,595 K**, and include transit,
transit-timing, RV and direct-imaging source methods. The current J2000
canonical builder readback is **27 stars, 97 planets, one remnant, 125 total
bodies** across the 25 systems: the retained five contribute 7 stars, 12
planets and one remnant; the 20 candidates contribute 20 stars and 85 existing
planet records. These are existing-catalog baselines only, not a target
population estimate or proposed additions.

Reproducible PowerShell lookup/validation from the repository root (read-only;
checks the exact roster IDs and canonical J2000 body totals):

```powershell
@'
const { getSolarSystemRegistry } = require('./src/model/solar-system-registry');
const { buildSeededCelestialBodiesForSolarSystem } =
  require('./src/model/solar-system-celestial-seed');
const ids = [
  'exo-gj-9066', 'exo-hr-8799', 'alpha-centauri', 'barnards-star', 'cygnus-x1',
  'exo-kepler-186', 'exo-kepler-11', 'exo-kepler-36', 'exo-kepler-62',
  'exo-hd-40307', 'exo-toi-700', 'exo-l-98-59', 'exo-47-uma',
  'exo-trappist-1', 'exo-kepler-42', 'exo-kepler-138', 'exo-kepler-32',
  'exo-kepler-80', 'exo-kepler-289', 'exo-hd-10180', 'exo-hd-69830',
  'exo-gj-876', 'exo-gj-581', 'exo-hd-20794', 'exo-hd-95086',
];
const registry = new Map(getSolarSystemRegistry().map((entry) => [entry.id, entry]));
if (ids.length !== 25 || new Set(ids).size !== 25) throw new Error('roster size/duplicate');
const totals = { systems: 0, stars: 0, planets: 0, other: 0, bodies: 0 };
for (const id of ids) {
  const entry = registry.get(id);
  const bodies = buildSeededCelestialBodiesForSolarSystem(id, '2000-01-01T12:00:00.000Z');
  if (!entry || !bodies) throw new Error(`missing canonical registry/body data: ${id}`);
  if (id.startsWith('exo-') &&
      !['exo-gj-9066', 'exo-hr-8799'].includes(id) && entry.starCount !== 1) {
    throw new Error(`new candidate is not single-star in registry: ${id}`);
  }
  totals.systems += 1;
  totals.stars += bodies.filter((body) => body.bodyType === 'star').length;
  totals.planets += bodies.filter((body) => body.bodyType === 'planet').length;
  totals.other += bodies.filter((body) => !['star', 'planet'].includes(body.bodyType)).length;
  totals.bodies += bodies.length;
}
console.log(JSON.stringify({ snapshot: require('./data/exoplanet-systems.json').snapshotDate,
  ids: ids.length, totals }));
'@ | node -
```

Expected checked-in snapshot: `2026-11-01`; 25 unique IDs; totals
`{"systems":25,"stars":27,"planets":97,"other":1,"bodies":125}`. A separate
read-only audit of all 20 proposed planet rows confirmed the table's counts and
current discovery-method/status fields; it found no source mass, period or
semimajor-axis gaps in those rows, but did find the radius/eccentricity gaps
listed above. Do not treat that check as validation of each reported orbit or
as a scientific endorsement.

### 18.5 Owner-review-only sample-budget proposal

No value below is implemented in `data/non-sol-scientific-policy-v2.json` or
runtime code. It is an optional, explicitly **authored preview envelope** for
review after candidate eligibility is separately approved:

| Review tier             |    Proposed new-planet count envelope |    Proposed cold-gas-giant sub-cap | Interpretation                                                                              |
| ----------------------- | ------------------------------------: | ---------------------------------: | ------------------------------------------------------------------------------------------- |
| Stage A (8 candidates)  | **0–2 additions per eligible system** | **0–1**, included in the 0–2 total | A small first-review ceiling; zero remains valid.                                           |
| Stage B (12 candidates) | **0–4 additions per eligible system** | **0–1**, included in the 0–4 total | Retains the current v2 total ceiling only as an authored sandbox limit; zero remains valid. |

These are proposed workload/sample caps, **not** per-system occurrence
probabilities, survey-derived counts, or permission to add planets to any
cataloged host. Keep every family minimum at zero. Do not force an ice giant,
or convert the cold-giant papers' population rates into an “extra giant”
Bernoulli draw for a known giant-host system. If adopted later, policy should
record occurrence evidence separately from authored counts and only use a
published rate inside its stated host, mass/radius, period/separation and
selection domain. A conditional multiplicity model is a prerequisite for
catalog-host additions.

Owner choice requested: (a) accept these two staged caps for a future, separately
authorized preview; (b) keep the existing v2 `[0,4]` envelope unchanged; or
(c) defer all numeric policy changes until the occurrence-table and
conditional-multiplicity work is complete. **Recommendation:** (c) for any
calibrated or persistent generation; either (a) or (b) may be considered only
as a labeled authored review envelope. No numerical moon, ring, asteroid,
comet, outer-minor-body or dwarf-subset calibration is proposed here.

### 18.6 Accepted roster boundary and evidence limits

Before any candidate preview, the following remain unresolved and require a
separate owner decision:

1. Whether any provisional candidate is eligible for a separately authorized
   analytic physical screen, after resolving the source issues recorded in
   Section 19.
2. Decide whether to retain or merely test the authored caps above, without
   treating them as rates.
3. Approve a separate literature/table audit that extracts radius-period and
   mass/separation occurrence bins, uncertainties and host-selection domains
   needed for any future population model.
4. Require source/uncertainty reconciliation for the flagged candidate rows
   and retain all four challenge blockers without repair.
5. Keep moons/minor bodies at the uncertainty/gap stage pending a distinct
   calibration proposal.

No database, generator, policy JSON, catalog body, accepted Copper Vale name,
57-body snapshot, six-market record or runtime behavior was changed by this
assessment. No systems were generated, no eligibility was granted, and no
commit/push/Prettier or suite run was performed. Section 18 is ready for owner
revision only. Provisional roster acceptance does not waive the new Stage A
source-audit findings or authorize previews/generation.

## 19. Stage A host/planet source and architecture audit

**Status: completed desk audit; owner review next; no preview or generation
authorized (2026-11-08).** This executes only the owner's selected Stage A
audit for `exo-kepler-186`, `exo-kepler-11`, `exo-kepler-36`,
`exo-kepler-62`, `exo-hd-40307`, `exo-toi-700`, `exo-l-98-59`, and
`exo-47-uma`. It does not change sources, reconcile/repair catalog values,
re-score all 25 provisional systems, or run the physical screen.

### 19.1 Method, exact counts, and retrieval boundary

The checked-in host, planet, and reference snapshots identify NASA Exoplanet
Archive `pscomppars`, snapshot date **2026-11-01**. Read-only inspection found
the exact Stage A counts **5 + 6 + 2 + 5 + 5 + 4 + 5 + 3 = 35 existing
planet records**. A live NASA Exoplanet Archive `pscomppars` TAP query was
retrieved on 2026-11-08; it returned the same eight host names and 35 planet
names. The per-system Archive Overview pages were also retrieved on that date.
These are source-table and page comparisons, not independent confirmation that
every literature solution is correct or the newest available.

Public Archive references inspected:
[Kepler-186](https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-186),
[Kepler-11](https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-11),
[Kepler-36](https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-36),
[Kepler-62](https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-62),
[HD 40307](https://exoplanetarchive.ipac.caltech.edu/overview/HD%2040307),
[TOI-700](https://exoplanetarchive.ipac.caltech.edu/overview/TOI-700),
[L 98-59](https://exoplanetarchive.ipac.caltech.edu/overview/L%2098-59),
and [47 UMa](https://exoplanetarchive.ipac.caltech.edu/overview/47%20UMa).
The pages cite the discovery/follow-up references listed below; for example,
the Archive pages cite [Quintana et al. 2014](https://ui.adsabs.harvard.edu/abs/2014Sci...344..277Q/abstract)
and [Rowe et al. 2014](https://ui.adsabs.harvard.edu/abs/2014ApJ...784...45R/abstract)
for Kepler-186, [Lissauer et al. 2011](https://ui.adsabs.harvard.edu/abs/2011Natur.470...53L/abstract)
and [Lissauer et al. 2013](https://ui.adsabs.harvard.edu/abs/2013ApJ...770..131L/abstract)
for Kepler-11, [Carter et al. 2012](https://ui.adsabs.harvard.edu/abs/2012Sci...337..556C/abstract)
for Kepler-36, [Borucki et al. 2013](https://ui.adsabs.harvard.edu/abs/2013Sci...340..587B/abstract)
for Kepler-62, [Mayor et al. 2009](https://ui.adsabs.harvard.edu/abs/2009A&A...493..639M/abstract)
and [Tuomi et al. 2013](https://ui.adsabs.harvard.edu/abs/2013A%26A...549A..48T/abstract)
for HD 40307, [Gilbert et al. 2020](https://ui.adsabs.harvard.edu/abs/2020AJ....160..116G/abstract)
and [Gilbert et al. 2023](https://ui.adsabs.harvard.edu/abs/2023ApJ...944L..35G/abstract)
for TOI-700, [Kostov et al. 2019](https://ui.adsabs.harvard.edu/abs/2019AJ....158...32K/abstract),
[Demangeon et al. 2021](https://ui.adsabs.harvard.edu/abs/2021A&A...653A..41D/abstract),
and [Cadieux et al. 2025](https://ui.adsabs.harvard.edu/abs/2025AJ....170..154C/abstract)
for L 98-59, and [Butler & Marcy 1996](https://ui.adsabs.harvard.edu/abs/1996ApJ...464L.153B/abstract)
plus [Gregory & Fischer 2010](https://ui.adsabs.harvard.edu/abs/2010MNRAS.403..731G/abstract)
for 47 UMa. The links are the Archive's cited references; no claim is made
that these are the most recent authoritative solutions.

The frozen files additionally contain later bibliography identifiers, limited
to what was in the 2026-11-01 snapshot: Kepler-186 (2019), Kepler-11 (2019),
Kepler-36 (2025, Ofir et al.), Kepler-62 (2024), HD 40307 (2021, Kiefer et
al.), TOI-700 (2026, Pass et al.), L 98-59 (2026, Schwarz et al.), and 47 UMa
(2021, Rosenthal et al.). These are recorded-reference years, **not an
independently verified freshest-paper list or a new status adjudication**.
All 35 frozen planet records say `confirmed`; Kepler-186 f and HD 40307 g are
also flagged `controversial` in the frozen records. The Archive Overview pages
also label both “Confirmed Controversial.” No source status was changed.

Reproducible read-only live query (PowerShell, repository root; the current
Archive TAP endpoint may rate-limit repeated requests):

```powershell
$q = "select hostname,pl_name,pl_orbper,pl_orbsmax,pl_orbsmaxerr1,pl_orbsmaxerr2,pl_orbeccen,pl_orbeccenerr1,pl_orbeccenerr2,pl_rade,pl_radeerr1,pl_radeerr2,pl_bmasse,pl_bmasseerr1,pl_bmasseerr2,pl_bmassprov,st_mass,st_masserr1,st_masserr2,st_rad,st_raderr1,st_raderr2,st_teff,st_tefferr1,st_tefferr2,sy_snum from pscomppars where hostname in ('Kepler-186','Kepler-11','Kepler-36','Kepler-62','HD 40307','TOI-700','L 98-59','47 UMa') order by hostname,pl_name"
$u = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=' +
  [uri]::EscapeDataString($q) + '&format=json'
$r = Invoke-RestMethod -Uri $u -TimeoutSec 60
$r | Group-Object hostname | ForEach-Object {
  '{0}: {1} planet rows' -f $_.Name, $_.Count
}
```

Retrieved row counts were Kepler-186 5, Kepler-11 6, Kepler-36 2,
Kepler-62 5, HD 40307 5, TOI-700 4, L 98-59 5, and 47 UMa 3 (35 total).
The table below gives the frozen catalog's point inputs and the uncertainty
fields returned by the live `pscomppars` query. `—` means the queried value or
its uncertainty field is null, not zero. Period errors were retrieved but
omitted here because the relative precision is much smaller than the listed
axis, mass, and eccentricity uncertainties. Errors are the Archive's
asymmetric `err1` / `err2` values, shown as `+ / −`; they are not propagated
into the game's frozen point records.

### 19.2 Host input reconciliation

The current query's host points agree with the frozen `exoplanet-hosts.json`
points at the printed precision. The frozen host records do not store the
asymmetric host-error fields shown here. The Archive Overview pages do not
consistently show the same radius/temperature point as the TAP
`pscomppars` query. Both are NASA Archive surfaces retrieved on the same audit
date; this assessment does not decide which host solution should be preferred.

| Host       | Frozen / live TAP `M☉ / R☉ / K` | Live TAP asymmetric errors `M / R / Teff`                  | Archive Overview summary `R☉ / K`     | Audit caveat                                                                                                                                                |
| ---------- | ------------------------------- | ---------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kepler-186 | 0.478 / 0.472 / 3,788           | ±0.055 / ±0.052 / ±54                                      | 0.52 / 3,881                          | Radius and temperature disagree across Archive surfaces; spectral type M1 in frozen host record.                                                            |
| Kepler-11  | 0.961 / 1.065 / 5,663           | ±0.025 / +0.017/−0.022 / +55/−66                           | 1.00 / 5,675                          | Radius differs; frozen spectral-type field is absent.                                                                                                       |
| Kepler-36  | 1.034 / 1.634 / 5,979           | ±0.022 / +0.042/−0.040 / ±60                               | Not recovered from Overview rendering | Large radius for the stored mass; catalog's evolved/subgiant host domain must not be pooled as an unevolved FGK comparison. Frozen spectral type is absent. |
| Kepler-62  | 0.690 / 0.640 / 4,925           | ±0.020 / ±0.020 / ±70                                      | 0.60 / 4,807                          | Radius and temperature disagree; K2 V in frozen host record.                                                                                                |
| HD 40307   | 0.770 / 0.716684 / 4,956        | ±0.050 / +0.059818/−0.047911 / ±50                         | 0.72 / 4,805                          | Temperature differs; K2.5 V in frozen host record.                                                                                                          |
| TOI-700    | 0.417 / 0.4104 / 3,459          | ±0.020 / +0.0093/−0.0069 / ±65                             | 0.41 / 3,998.78                       | Large temperature disagreement; M2.5 V in frozen host record.                                                                                               |
| L 98-59    | 0.2923 / 0.3155 / 3,415         | ±0.0067 / ±0.0062 / ±60                                    | 0.31 / 3,786                          | Large temperature disagreement; M3 V in frozen host record.                                                                                                 |
| 47 UMa     | 1.060 / 1.21334 / 5,872         | +0.128402/−0.137608 / +0.038883/−0.058353 / +92.94/−113.53 | 1.23 / 5,954                          | Broad host intervals and Archive surface offsets; G0 V in frozen host record.                                                                               |

These are pending source-reconciliation items, not permission to repair either
the frozen catalog or Archive values. In particular, do not use the single
point host inputs as precise physical truth for the next screen. All eight
host records say one star, and live TAP `sy_snum` returned one for each. This
only confirms the selected catalog/archive grouping; it does not rule out a
wide, faint, or unresolved stellar companion. No independent complete
companion search is claimed.

### 19.3 Exact Stage A planet-input audit

`P` is the frozen period in days, `a` is the frozen semimajor axis in AU, and
the displayed `a` interval is the live Archive uncertainty. `e` is the
Archive central value plus asymmetric errors when present; `e=0; error null`
is deliberately **not** called a measured circular orbit. `R` and `M` are the
frozen Earth-unit point values; errors/provenance are from the live query.
`M-R` means the Archive labels the mass as a mass-radius-relation estimate;
`Msini` is an RV minimum mass; `Mass` is the Archive provenance label, not a
claim that the point is error-free or that RV inclination is known.

| System / planet | P (d); a (AU)                     | e (central; + / −)  | R (R⊕; + / −)                       | M (M⊕; + / −; provenance)      |
| --------------- | --------------------------------- | ------------------- | ----------------------------------- | ------------------------------ |
| Kepler-186 b    | 3.8867907; 0.0343 ±0.0046         | 0; error null       | 1.07 ±0.12                          | 1.24; error null; M-R          |
| Kepler-186 c    | 7.267302; 0.0451 ±0.0070          | 0; error null       | 1.25 ±0.14                          | 2.10; error null; M-R          |
| Kepler-186 d    | 13.342996; 0.0781 ±0.0100         | 0; error null       | 1.40 ±0.16                          | 2.54; error null; M-R          |
| Kepler-186 e    | 22.407704; 0.110 ±0.015           | 0; error null       | 1.27 +0.15/−0.14                    | 2.15; error null; M-R          |
| Kepler-186 f    | 129.9441; 0.432 +0.171/−0.053     | 0.040 +0.070/−0.040 | 1.17 ±0.08                          | 1.71; error null; M-R          |
| Kepler-11 b     | 10.3039; 0.091 ±0.001             | 0.045 +0.068/−0.042 | 1.80 +0.03/−0.05                    | 1.90 +1.40/−1.00; Mass         |
| Kepler-11 c     | 13.0241; 0.107 ±0.001             | 0.026 +0.063/−0.013 | 2.87 +0.05/−0.06                    | 2.90 +2.90/−1.60; Mass         |
| Kepler-11 d     | 22.6845; 0.155 ±0.001             | 0.004 +0.007/−0.002 | 3.12 +0.06/−0.07                    | 7.30 +0.80/−1.50; Mass         |
| Kepler-11 e     | 31.9996; 0.195 ±0.002             | 0.012 ±0.006        | 4.19 +0.07/−0.09                    | 8.00 +1.50/−2.10; Mass         |
| Kepler-11 f     | 46.6888; 0.250 ±0.002             | 0.013 +0.011/−0.009 | 2.49 +0.04/−0.07                    | 2.00 +0.80/−0.90; Mass         |
| Kepler-11 g     | 118.3807; 0.466 ±0.004            | 0.150; error null   | 3.33 +0.06/−0.08                    | 25.00; error null; Mass        |
| Kepler-36 b     | 13.86825; 0.11419 ±0.00080        | 0; error null       | 1.498 +0.061/−0.049                 | 3.83 +0.11/−0.10; Mass         |
| Kepler-36 c     | 16.21865; 0.12692 ±0.00092        | 0; error null       | 3.679 +0.096/−0.091                 | 7.13 ±0.18; Mass               |
| Kepler-62 b     | 5.714932; 0.0553 ±0.0005          | 0; error null       | 1.31 ±0.04                          | 9.00; error null; Mass         |
| Kepler-62 c     | 12.4417; 0.0929 ±0.0009           | 0; error null       | 0.54 ±0.03                          | 4.00; error null; Mass         |
| Kepler-62 d     | 18.16406; 0.120 ±0.001            | 0; error null       | 1.95 ±0.07                          | 14.00; error null; Mass        |
| Kepler-62 e     | 122.3874; 0.427 ±0.004            | 0; error null       | 1.61 ±0.05                          | 36.00; error null; Mass        |
| Kepler-62 f     | 267.291; 0.718 ±0.007             | 0; error null       | 1.41 ±0.07                          | 35.00; error null; Mass        |
| HD 40307 b      | 4.3123; 0.0468 +0.0024/−0.0023    | 0.200 +0.140/−0.160 | —                                   | 1,188.996; error null; Mass    |
| HD 40307 c      | 9.6184; 0.0799 ±0.0040            | 0.060 +0.110/−0.060 | —                                   | 1,868.513; error null; Mass    |
| HD 40307 d      | 20.432; 0.1321 ±0.0066            | 0.070 +0.110/−0.070 | —                                   | 1,775.389; error null; Mass    |
| HD 40307 f      | 51.76; 0.247 +0.011/−0.014        | 0.020 +0.200/−0.020 | Frozen 2.13; live query null        | 5.20 +1.50/−1.60; Msini        |
| HD 40307 g      | 197.8; 0.600 +0.034/−0.033        | 0.290 +0.310/−0.290 | Frozen 2.56; live query null        | 7.10 ±2.60; Msini              |
| TOI-700 b       | 9.97722; 0.0678 ±0.0011           | 0.032 +0.050/−0.024 | 0.963 +0.037/−0.034                 | 0.849; error null; M-R         |
| TOI-700 c       | 16.0511039; 0.0931 ±0.0015        | 0.033 +0.063/−0.025 | 2.535 +0.084/−0.073                 | 6.96; error null; M-R          |
| TOI-700 e       | 27.810124; 0.1336 ±0.0020         | 0.059 +0.057/−0.042 | 0.919 +0.028/−0.024                 | 0.718; error null; M-R         |
| TOI-700 d       | 37.423457; 0.1642 +0.0025/−0.0027 | 0.042 +0.045/−0.030 | 1.145 +0.032/−0.026                 | 1.58; error null; M-R          |
| L 98-59 b       | 2.253114; 0.0223 ±0.0007          | 0.031 +0.017/−0.016 | 0.837 ±0.019                        | 0.460 ±0.110; Mass             |
| L 98-59 c       | 3.6906764; 0.0309 ±0.0010         | 0.002 +0.002/−0.001 | 1.329 ±0.029                        | 2.00 ±0.13; Mass               |
| L 98-59 d       | 7.450729; 0.0494 ±0.0016          | 0.006 +0.007/−0.004 | 1.627 ±0.041                        | 1.64 ±0.07; Mass               |
| L 98-59 e       | 12.8278; 0.0712 ±0.0022           | 0.012 +0.009/−0.008 | Frozen 1.49; live radius error null | 2.82 ±0.19; Msini              |
| L 98-59 f       | 23.064; 0.1052 ±0.0033            | 0.044 +0.027/−0.028 | Frozen 1.48; live radius error null | 2.80 ±0.30; Msini              |
| 47 UMa b        | 1,078; 2.10 ±0.02                 | 0.032 ±0.014        | Frozen 13.2; live radius error null | 804.08 +22.25/−19.07; Msini    |
| 47 UMa c        | 2,391; 3.60 ±0.10                 | 0.098 +0.047/−0.096 | Frozen 14.2; live radius error null | 171.621 +20.976/−23.201; Msini |
| 47 UMa d        | 14,002; 11.60 +2.10/−2.90         | 0.160 +0.090/−0.160 | Frozen 13.5; live radius error null | 521.22 +92.17/−152.55; Msini   |

**Discrepancies requiring owner review; no correction made:**

- **HD 40307 b/c/d:** frozen and current TAP `pl_bmasse` points are
  1,189/1,869/1,775 M⊕ and the current query labels provenance `Mass` with
  null mass errors. The same NASA Archive Overview page, citing Mayor et al.
  (2009), reports RV lower bounds of **>4, >6.6, and >9.5 M⊕**. Those values
  are not reconcilable by treating `Mass` as `Msini`; do not use the cached
  masses for physical screening until the Archive/source/unit mapping is
  reviewed. The frozen f/g radius points are also absent from the live
  `pscomppars` query and have no archived errors.
- **Kepler-62:** all five catalog masses have null uncertainty fields despite
  the `Mass` provenance label. Do not treat those values as precision
  dynamical masses. The radii are present with errors, but family/composition
  remains non-unique.
- **TOI-700 b/c/d/e:** point masses are explicitly `M-R` estimates without
  errors, not independent mass measurements.
- **Kepler-186 b/c/d/e/f:** point masses are `M-R` estimates without mass
  errors; f is source-flagged controversial.
- **47 UMa b/c/d:** all three source masses are `Msini`, not true masses;
  inclinations are absent. The frozen radius values have null live-query
  uncertainties and are not transit radius measurements.
- **L 98-59 e/f:** RV minimum masses have `Msini` provenance and uncertainty;
  frozen radii have no live-query errors. Do not infer measured radius or
  composition from those points.

### 19.4 Epoch, eccentricity, and source-status caveats

The frozen records do not define one shared orbital-element epoch per system.
Transit `transitMidpointJd` values span JD 2454966–2455789 (Kepler-186),
2455583–2455618 (Kepler-11), 2454974–2455004 (Kepler-36),
2454967–2455422 (Kepler-62), 2458821–2460772 (TOI-700), and
2458362–2458438 (L 98-59). These are per-planet transit reference epochs, not
a common fitted state vector. HD 40307's RV records have no stored transit or
periastron epoch. 47 UMa's RV periastron-time fields span JD 2451736–2452441;
its catalog `transitMidpointJd` fields are not evidence of observed transits.
Do not combine these independently sourced elements as a simultaneous
architecture without a common-fit/covariance source.

The Archive returns an eccentricity central value of zero with null
eccentricity-error fields for Kepler-186 b/c/d/e, Kepler-36 b/c, and Kepler-62
b/c/d/e/f. These are absent/assumed values in the source
table, not measured `e=0`. For screening, retain `eccentricity unknown` or
explicitly marginalize it; never silently equate missing eccentricity with a
circular measured orbit.

The checked helper path is relevant to that distinction.
`exoplanet-star-facts.js` uses the archived host for stellar mass, radius, and
temperature (HYG/AT-HYG is used for position, distance, and names), so the host
disagreements above feed directly into the physical model.
`exoplanet-system-generator.js` substitutes zero and marks
`orbit.eccentricity` approximate only when the eccentricity value itself is
absent. Here, several NASA rows encode a numeric `e=0` while the eccentricity
error fields are null; because those uncertainty fields are not retained in
the project planet records, the helper treats that zero as supplied and does
not mark it approximate. That helper output must not be used to call these
orbits measured circular cases. Its J2000 phase calculation also uses
individual per-planet epochs, not a correlated architecture fit. It consumes
point inputs and does not propagate the Archive's asymmetric errors. It marks
`Msini` and `M-R relationship` masses approximate, but
`ARCHIVE_ESTIMATED_MASS` does not include provenance `Mass`. Therefore the
HD 40307 b/c/d discrepancy and null-error Kepler-62 masses would flow through
as unqualified point masses unless resolved upstream. This audit leaves those
helpers and records unchanged and does not treat their modeling fallback as
source evidence.

### 19.5 Quantitative existing-architecture diagnostics

The following diagnostics use the frozen point periods and semimajor axes,
sorted by axis. They are descriptive spacing checks, not new fitted
ephemerides, stability certification, or proof that an independent planet can
be inserted. Axis error bars, eccentricity unknowns, mass provenance,
mutual-inclination uncertainty, resonance and correlated orbit solutions
matter.

| System     | Existing order in semimajor axis (AU)          | Closest adjacent period ratio; axis gap | Interpretation for a later screen                                                                                                                                                                                                                             |
| ---------- | ---------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kepler-186 | b .0343, c .0451, d .0781, e .110, f .432      | d/e 1.68; smallest `Δa` b/c .0108 AU    | f's `a` uncertainty is large (+.171/−.053 AU); several inner e values have no error. Preserve f's controversial source status.                                                                                                                                |
| Kepler-11  | b .091, c .107, d .155, e .195, f .250, g .466 | b/c 1.26; smallest `Δa` .016 AU         | Multiple transiting planets and measured masses make this a useful compact-architecture screen; correlated multi-planet fit, not pairwise spacing alone, is required.                                                                                         |
| Kepler-36  | b .11419, c .12692                             | b/c 1.17; `Δa` .01273 AU                | Extremely close known pair. Nominal circular mutual-Hill spacing is about 4.8, but the Archive has no eccentricity errors and the architecture is a known coupled solution. This is not grounds to reject the observed pair or an automatic insertion cutoff. |
| Kepler-62  | b .0553, c .0929, d .120, e .427, f .718       | c/d 1.46; smallest `Δa` .0271 AU        | Inner chain plus separated outer pair; mass errors are missing, so mass-based Hill thresholds are not reliable.                                                                                                                                               |
| HD 40307   | b .0468, c .0799, d .1321, f .247, g .600      | c/d 2.12; smallest `Δa` .0331 AU        | Do not compute a physical Hill verdict from the discrepant b/c/d mass points; g is controversial and the fit/status needs reconciliation.                                                                                                                     |
| TOI-700    | b .0678, c .0931, e .1336, d .1642             | e/d 1.35; smallest `Δa` b/c .0253 AU    | e lies inside d in the source axis order; include all four when screening. Point masses are M-R estimates.                                                                                                                                                    |
| L 98-59    | b .0223, c .0309, d .0494, e .0712, f .1052    | b/c 1.64; smallest `Δa` .0086 AU        | Compact chain; outer e/f are RV minimum masses, with no common fitted epoch in this seed.                                                                                                                                                                     |
| 47 UMa     | b 2.1, c 3.6, d 11.6                           | b/c 2.22; smallest `Δa` 1.5 AU          | d has broad `a` uncertainty (+2.1/−2.9 AU); all masses are `Msini`. Use an RV architecture model and inclination uncertainty, not transit-based mass/radius rules.                                                                                            |

For orientation only, nominal mutual-Hill calculations from the same
point-mass snapshot give adjacent minima of roughly 9.1 for Kepler-11, 4.8
for Kepler-36, 8.6 for Kepler-62, 11.6 for TOI-700, 14.4 for L 98-59, and
5.4 for 47 UMa. They are **not rejection criteria**: some masses are
estimated or minimum masses, some eccentricities are missing, and known
compact/resonant architectures can be correlated. No analogous Hill number
is used for HD 40307 because its cached b/c/d masses are inconsistent with
the Archive's cited source lower bounds. For 47 UMa, using `Msini` as the
planet mass makes 5.4 an upper bound on the actual spacing (larger true masses
increase the Hill radii); the inclination is unknown.

### 19.6 Assessment result and next owner gate

This audit confirms that **all 35 expected planet names are present** in both
the frozen Stage A records and the retrieved live Archive query. It does not
confirm every physical point value. Source inputs reconcile cleanly only as
matching row identities/counts; multiple host solutions and several planet
mass/radius values remain unresolved. There is no inference that the eight
systems are equally suitable or that any additional planet is physically
eligible.

**Recommended first offline physical-screen candidate: Kepler-11 only, as a
conditional architecture case.** It has six existing transit records,
period/axis and radius uncertainties, and several published dynamical masses.
The screen must bracket the live TAP host intervals and the competing
Overview point values, keep the compact multi-planet fit/covariance as a
constraint, and test only uncrowded candidate zones. This is a recommendation
to propose a subsequent offline analytic screen, not permission to run it or
create a preview.

**Conditional follow-up, not part of the first screen:** Kepler-36 can be a
special compact/evolved-host test after its host solution and evolutionary
domain are reviewed. Kepler-186, Kepler-62, TOI-700 and L 98-59 need owner
review of the explicit host-surface/source and/or mass-provenance gaps above
before mass-dependent physical ranking. **Hold from the first screen:**
HD 40307 pending the severe b/c/d mass and f/g radius discrepancies plus g's
controversial status; 47 UMa pending a source-aware RV/minimum-mass,
inclination, and outer-orbit treatment. This deliberately does not force all
eight Stage A systems through.

The next owner gate is to review these exact discrepancy records and decide
whether to authorize a **bounded offline analytic screen for Kepler-11 only**
or revise the candidate choice. No source/catalog edits are proposed. The
four Section 18 challenge cases remain blocked; Copper Vale's accepted
57-body/six-market state is unchanged. No generation, new preview, naming,
repair, policy, runtime activation, database write, NPC/density-document
change, commit, or push was performed. Section 19 is an evidence handoff for
that next owner decision.

**Owner gate update (2026-11-08):** The owner reviewed and accepted Section 19,
then selected **"Authorize Kepler-11 offline screen only"** in the approval
form. Acceptance does not resolve the recorded scientific discrepancies.
Section 20 records that bounded screen; no generation or deployment approval
is implied.

## 20. Kepler-11 bounded offline architecture/physical screen

### 20.1 Scope and evidence qualification

- [x] Owner accepted the Stage A evidence handoff.
- [x] Owner authorized Kepler-11 offline screening only.
- [x] Rechecked all six frozen planet records and the host inputs.
- [x] Checked the primary dynamical study, calculated analytic sensitivity
      diagnostics, and recorded conditional results and blockers.
- [ ] Resolve the common-fit/source mapping before any physical eligibility
      decision or generation proposal.
- [ ] Obtain separate owner approval for any subsequent implementation scope.

This is a documentation-only analytic screen, not a generated-body preview,
new occurrence policy, N-body integration, catalog repair, or database change.
The other seven Stage A systems and four original challenge cases retain their
Section 19 dispositions. Copper Vale remains unchanged.

Primary evidence checked on 2026-11-08:
[Lissauer et al. 2013, All Six Planets Known to Orbit Kepler-11 Have Low Densities](https://arxiv.org/abs/1303.0227),
particularly [Section III, Table 1 and Figure 8](https://arxiv.org/html/1303.0227v2).
This source matches the ApJ 770, 131 reference cited in Section 19. It measures
the inner five planets' masses but gives an **upper bound**, not a measured
point mass, for g. Its inner-planet fits hold g at
`25.3e-6 * stellar mass` (approximately 8 Earth masses) and `e_g = 0`.
Two of its three transit-timing datasets constrain g below approximately
`70e-6 * stellar mass` at 95% confidence under that circular-fit assumption;
the third dataset gives a weaker constraint. At the frozen host mass, the
first bound is about 22.4 Earth masses. This is not an unconditional mass
ceiling for arbitrary eccentricity or a new adjudication of later studies.

**Important refinement of the accepted audit:** The frozen g record has
`massEarth = 25`, provenance `Mass`, and `eccentricity = 0.15`, with no audited
uncertainty for either point. Do not treat 25 as a measured exact mass or
0.15 as the eccentricity of the cited study's common fit. Section 19.4's
inconsistent inclusion of g among numeric-zero records has been removed.
No frozen record was changed. Source reconciliation must identify the
references behind these composite points before using them together.

The study also reports a nominal six-planet integration bounded for 250 Myr,
while independent upward shifts of its tabulated masses/eccentricities can
produce instability. It explicitly warns that those shifts ignore fitted
anticorrelations. That is evidence for preserving a correlated architecture,
not a stability certificate for this catalog snapshot or an added planet.

### 20.2 Host and existing-architecture checks

The audited TAP host intervals are `M = 0.936-0.986 M_sun`,
`R = 1.043-1.082 R_sun`, and `T = 5,597-5,718 K`. They are marginal
intervals, not a joint posterior. The competing Overview point is
`R = 1.00 R_sun`, `T = 5,675 K`; its displayed summary supplies no replacement
mass interval.

Using `L/L_sun = (R/R_sun)^2 * (T/5772 K)^4` gives a rectangular host-only
luminosity sensitivity range of **0.96180-1.12752 L_sun**, and **0.93445**
for the Overview point. The frozen host independently stores
`logLuminositySolar = 0.1202`, equivalent to **1.31886 L_sun**. These are
different input combinations, not mutually consistent precision estimates.
For thermal sensitivity, retain their union **0.93445-1.31886 L_sun** as
illustrative source alternatives, not a confidence interval. Do not infer a
habitable zone, composition, or atmosphere from this screen.

Period-derived axes using the frozen `0.961 M_sun` host and
`a = [M_star * (P/365.25 days)^2]^(1/3)` differ from the stored axes by
approximately -0.49% to +0.18%, within the audited axis errors. This checks
units and rounding only; it does not establish a common orbital epoch.

Nominal adjacent mutual-Hill spacings from the frozen point masses/axes are
**9.45, 16.67, 9.08, 11.32 and 19.84** for b/c through f/g. The final value
uses g's unresolved 25-Earth-mass point and is illustrative only. No existing
observed pair is rejected and no insertion is authorized by these numbers.

For b-f, combining each axis interval with its upper audited eccentricity
produces these rectangular radial envelopes:

| Planet | Minimum periapsis (AU) | Maximum apoapsis (AU) |
| ------ | ---------------------- | --------------------- |
| b      | 0.079830               | 0.102396              |
| c      | 0.096566               | 0.117612              |
| d      | 0.152306               | 0.157716              |
| e      | 0.189526               | 0.200546              |
| f      | 0.242048               | 0.258048              |

b/c envelopes overlap under independently combined extrema. This does not
contradict the observed system: extrema need not occur together, radial
overlap is not a simultaneous close encounter, and covariance matters.
**The compact b-f region is excluded from this first insertion screen**;
unexamined inner-to-b zones are not implicitly approved.

### 20.3 Uncrowded-zone sensitivity, not population draws

Test probes use candidate masses **1, 10, 100 and 318 Earth masses** and
axes **0.6, 1, 2 and 5 AU**. These are engineering sensitivities spanning
small to giant masses, not generated bodies, measured occurrence rates,
composition classifications, or approved sampling budgets.

The exterior calculation deliberately explores `e_candidate <= 0.10`,
`e_g <= 0.30`, `m_g <= 25 Earth masses`, `a_g <= 0.470 AU`, and the lowest
audited host mass `0.936 M_sun`. The eccentricity ceilings are **assumed
sensitivity bounds**, not measurements. In particular, the primary study's
circular mass bound cannot validate the joint `m_g/e_g` box. Results are
conditional on that box; missing g constraints prevent unconditional
clearance. Wider eccentricities/masses can invalidate these results.

For an exterior probe at axis `x`, define:

```text
C = [(25 + candidate_mass) / (3 * 0.936 * 332946.0487)]^(1/3)
R_H = (x + 0.470) * C / 2
radial_gap = x * (1 - 0.10) - 0.470 * (1 + 0.30)
clearance = radial_gap / R_H
```

`332946.0487` converts solar masses to Earth masses. An illustrative
**10 mutual-Hill-radius radial buffer** is a deliberately conservative
engineering comparison, not a stability theorem or adopted policy cutoff.
Solving `clearance > 10` gives:

```text
x > 0.470 * (1.30 + 5*C) / (0.90 - 5*C)
```

| Probe mass (Earth masses) | Conditional exterior axis boundary (AU) | Clearance at 1 AU | Clearance at 2 AU | Clearance at 5 AU |
| ------------------------- | --------------------------------------- | ----------------- | ----------------- | ----------------- |
| 1                         | >0.91140                                | 12.98             | 31.78             | 46.93             |
| 10                        | >0.94115                                | 11.75             | 28.78             | 42.51             |
| 100                       | >1.13477                                | 7.69              | 18.83             | 27.81             |
| 318                       | >1.43754                                | 5.49              | 13.45             | 19.86             |

All four 0.6-AU probes have negative radial gaps under this sensitivity box.
At 1 AU, only the 1/10-Earth-mass probes exceed the illustrative buffer;
at 2 and 5 AU all four do. This supports **exterior-to-g zones as conditional
follow-up candidates**, not planet eligibility or a maximum outer boundary.

A separate f/g gap probe at `0.340 AU`, `e_candidate = 0.10` reaches
`apoapsis = 0.374 AU`. With g at its lower audited axis `0.462 AU` and
assumed `e_g = 0.30`, g reaches `periapsis = 0.3234 AU`; the envelopes
overlap. **Do not advance the f/g gap** without a source-consistent fit.
The possibility that a low-eccentricity correlated solution opens space is
not ruled out; it was not tested here.

Host-only incident flux at the probe axes, using the union of source
luminosity alternatives above and `S/S_Earth = L/x^2`, is:

| Axis (AU) | Incident flux at that radius (Earth units) |
| --------- | ------------------------------------------ |
| 0.6       | 2.596-3.664                                |
| 1         | 0.934-1.319                                |
| 2         | 0.234-0.330                                |
| 5         | 0.0374-0.0528                              |

These are values at the listed radius, not orbital-average/periastron flux,
climate predictions, or radiation/travel safety assessments.

### 20.4 Result, verification, and next gate

**Result: conditional exterior-zone interest; no new planet eligible yet.**
The bounded screen is complete, but generation remains held. Before an
eligibility decision, reconcile g's upper-limit/point-mass and eccentricity
provenance, select a source-consistent host/luminosity treatment, and recover
a common fitted architecture with sufficient correlation information.
Any later perturbation/integration work needs a separately defined scope;
no N-body solver or new runtime model was introduced.

Verification performed with a read-only Python calculation against the
checked-in host/planet snapshot: six identities inspected, period/axis and
luminosity calculations evaluated, five adjacent Hill spacings calculated,
and all **16 exterior probes** checked against both the direct radial
clearance formula and its solved boundary. All boundary equivalence
assertions passed. Formulas, assumptions, inputs and rounded outputs are
recorded above for reproduction. No application suite is needed for this
documentation-only assessment; Prettier remains deferred.

**Owner validation:** Review the scope and disposition, not the astrophysics
independently. Confirm that the screen is accepted as a conditional result,
that no compact-chain/f-g addition should proceed yet, and that the
recommended next slice is source/common-fit reconciliation before any
generated-body preview. Source disagreements remain the implementation
team's research responsibility; accepting this document does not certify
their resolution.

**Owner update (2026-11-08):** Section 20 was reviewed and accepted. The owner
authorized the recommended source/common-fit reconciliation next. Section 21
records that research-only work; implementation and generation remain
separate approval gates.

## 21. Kepler-11 source semantics and common-fit reconciliation

### 21.1 Disposition and exact source mapping

- [x] Owner accepted the conditional Section 20 screen and authorized this
      reconciliation.
- [x] Retrieved six field-specific composite-source rows and compared the
      Lissauer 2013 per-reference `ps` rows.
- [x] Explained g's mass/eccentricity values using Archive limit flags and the
      primary study's Table 4.
- [x] Recovered the published shared dynamical epoch and individual fit tables.
- [x] Identified a source-consistent historical research baseline and remaining
      limitations.
- [x] Authorize and implement additive source-semantics preservation and
      offline assessment guards (subsequent owner-approved Section 22).
- [ ] Establish sufficient joint orbital information and validate a future
      physical model before declaring any added planet eligible.

Retrieved on 2026-11-08: NASA Archive `pscomppars` field-specific reference and
limit columns, and `ps` rows citing Lissauer et al. 2013. The Archive
[table documentation](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
explicitly describes composite parameters as not necessarily self-consistent,
whereas `ps` provides per-reference parameter sets. Neither table replaces
the primary study's dynamical-fit conventions.

The corrected read-only query uses `pl_bmasse_reflink` (not
`pl_bmassreflink`, which is not a column):

```sql
select pl_name, pl_bmasse, pl_bmasselim, pl_bmasse_reflink,
       pl_orbeccen, pl_orbeccenlim, pl_orbeccen_reflink,
       st_mass, st_mass_reflink, st_rad, st_rad_reflink,
       st_teff, st_teff_reflink, st_lum, st_lum_reflink
from pscomppars
where hostname = 'Kepler-11'
order by pl_name
```

| Inputs, across all six planets                                          | Retrieved field-specific reference | Interpretation                                                                                                               |
| ----------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Mass, eccentricity, period, axis, transit midpoint, inclination, radius | Lissauer et al. 2013, ApJ 770, 131 | Historical source values; g's limits must be retained. The composite points do not select one individual transit-timing fit. |
| Argument of periapsis                                                   | Borsato et al. 2014, A&A 571, A38  | A different fit. Do not pair these angles with Lissauer eccentricities/phases as a common fitted architecture.               |
| Stellar mass/radius/temperature                                         | Lissauer et al. 2013               | Same historical stellar solution as the dynamical study.                                                                     |
| Stellar log luminosity 0.1202                                           | Gajdos et al. 2019, RAA 19, 41     | Different source; do not silently merge it into the Lissauer host solution.                                                  |

The frozen reference array indices were decoded against
`data/exoplanet-references.json`: 423 (Lissauer 2011), 561 (Lissauer 2013),
619 (Borsato 2014), 2447 (DR25 KOI table), 1131 (Berger 2018), 1238
(TICv8), 1299 (Gajdos 2019), and 1120 (Fulton & Petigura 2018).
The frozen `refs` list preserves a pooled bibliography, not the mapping from
each field to its source. The live field-specific mapping above supplies that
missing distinction for this review, not a retroactive snapshot refresh.

**g is now reconciled as a source limit, not a bad numeric conversion:**
both composite and Lissauer 2013 `ps` rows return
`pl_bmasse = 25, pl_bmasselim = 1` and
`pl_orbeccen = 0.15, pl_orbeccenlim = 1`.
[Lissauer 2013 Table 4](https://arxiv.org/html/1303.0227v2)
explicitly describes g's mass and eccentricity as **2-sigma upper bounds**;
it prints mass `<25 M_Earth` and eccentricity `<0.15`. Thus Section 19's
description of 0.15 as a central value is superseded for g. The Section 20
`e_g <= 0.30` case remains an intentionally broader engineering stress
assumption, not a source confidence range. The mass bound remains tied to
the study's model assumptions; it is not an independent rectangular joint
mass/eccentricity posterior.

The root repository gap is concrete:
`scripts/import-exoplanet-catalog-data.js` copies `pl_bmasse` and
`pl_orbeccen` through `PLANET_FIELDS` but requests no associated limit/error
columns. `normalizePlanet` retains numeric values, `Mass` provenance and
pooled reference indices, not field-level limit semantics. This explains
why the frozen g record appears to contain exact points. No importer,
catalog or runtime record has been repaired in this research slice.

### 21.2 Historical source-consistent host baseline

For a future **offline historical-fit comparison**, recommend Lissauer 2013
Table 3 as a single coherent source, not a claim that it is the newest or
universally preferred solution:

| Quantity              | Table 3 value and marginal 1-sigma uncertainty |
| --------------------- | ---------------------------------------------- |
| Stellar mass          | 0.961 +/-0.025 solar masses                    |
| Stellar radius        | 1.065 +0.017/-0.022 solar radii                |
| Effective temperature | 5663 +55/-66 K                                 |
| Luminosity            | 1.045 +0.061/-0.078 solar luminosities         |
| Age                   | 8.5 +1.1/-1.4 Gyr                              |

The nominal radius/temperature Stefan-Boltzmann calculation using 5772 K
gives `1.05095 L_sun`, consistent at this precision with the study's
`1.045 L_sun`. Use the paper's luminosity for its historical source solution,
not the mixed-source `10^0.1202 = 1.31886` composite value. The competing
Overview summary is a separate display/source alternative, not an instruction
to overwrite the Table 3 baseline. The Table 3 marginal errors are not
independent draw distributions; no host covariance was recovered.

### 21.3 What common fit is recoverable

Section III specifies a shared dynamical epoch of **680 days relative to
JD 2454900**, hence **JD 2455580**. The phase parameter is each planet's first
transit midpoint after that shared epoch. Different per-planet transit dates
are therefore **not themselves a missing-common-epoch defect in the paper**.
The repository fails to preserve the fitted solution and its conventions,
not the existence of a published common epoch.

The paper reports observed periods in the Solar System barycentric frame;
its Table 1 caption gives a factor of **1.00019** for the periods in the
Kepler-11 rest frame. A future state-vector adapter must preserve the time,
frame and angle conventions rather than relabel these as J2000 elements.
Table 9 defines the sky-referenced periapsis angle. Transit inclinations alone
do not provide a fully measured 3D mutual-node geometry.

Tables 6, 7 and 8 are individual g-fixed fits to three separately measured
transit-timing datasets. Table 1 synthesizes their ranges and is **not a
joint posterior to sample by drawing every marginal independently**.
For an initial historical nominal comparison, Table 7 (J.R. dataset) is a
reasonable candidate because the paper describes its eccentric-fit
chi-squared per degree of freedom as near unity. This is a recommended
research baseline, not owner-approved runtime input or a stability-certified
initial condition.

Recovered Table 7 values (errors are its marginal uncertainties):

| Planet | P (days)           | First transit offset from JD 2454900 | e cos(omega)    | e sin(omega)    | Planet/star mass ratio, in 1e-6 |
| ------ | ------------------ | ------------------------------------ | --------------- | --------------- | ------------------------------- |
| b      | 10.3039 +/-0.0004  | 689.7391 +/-0.0012                   | 0.050 +/-0.019  | 0.014 +/-0.010  | 6.80 +/-2.16                    |
| c      | 13.0240 +/-0.0005  | 683.3497 +/-0.0010                   | 0.033 +/-0.016  | 0.005 +/-0.008  | 9.25 +/-3.34                    |
| d      | 22.6849 +/-0.0005  | 694.0072 +/-0.0007                   | -0.003 +/-0.004 | 0.004 +/-0.003  | 23.61 +/-1.84                   |
| e      | 31.9999 +/-0.0005  | 695.0756 +/-0.0005                   | -0.007 +/-0.003 | -0.007 +/-0.003 | 23.85 +/-2.55                   |
| f      | 46.6877 +/-0.0014  | 718.2697 +/-0.0021                   | 0.014 +/-0.005  | -0.001 +/-0.002 | 5.26 +/-1.21                    |
| g      | 118.3806 +/-0.0005 | 693.8010 +/-0.0010                   | 0, fixed        | 0, fixed        | 25.29, fixed                    |

At the Table 3 host mass, the nominal ratios convert to approximately
**2.17574, 2.95964, 7.55428, 7.63107, 1.68300 and 8.09182 Earth masses**.
The last is the **fit's fixed modeling mass**, not g's measured mass or
upper limit. Nominal eccentricities from the paired components are
**0.051923, 0.033377, 0.005000, 0.009899, 0.014036 and 0 (fixed)**.
These demonstrate why replacing a pooled catalog point with a single
published fit requires an explicit assessment adapter, not field-by-field
catalog mutation.

The article's retrieved tables provide fit parameters and marginal errors;
a joint covariance matrix/posterior sample set and fully specified
implementation-ready state-vector convention were **not recovered in this
bounded review**. This is not proof that no supplementary or author-provided
data exist. Do not synthesize a covariance matrix or certify long-term
stability from these tables. No numerical integration was performed.

### 21.4 Verification and recommended implementation gate

Verification: read-only live queries matched all six names, identified both
g limit flags, checked their Lissauer 2013 per-reference rows, and recovered
the parameter-level source mappings. Primary Tables 3, 4, 6-9 and Section III
were inspected; Table 7 ratio/eccentricity conversions, the shared epoch and
host luminosity consistency were calculated. All six queried field-mapping
rows were present. No catalog files, code or database state were changed.
No application tests or Prettier run were needed for this documentation slice.

**Research slice complete; physical eligibility remains held.** The limit
and mixed-source discrepancies are explained. Recovering nominal common-fit
parameters is not the same as recovering sufficient joint information for
uncertainty-aware stability or an added-planet decision.

**Recommended next implementation slice:** additive preservation of Archive
limit semantics and field-level source references, with tests and explicit
assessment refusal when a limit is used as a measurement or mixed-fit
elements are presented as a correlated architecture. Preserve existing
catalog points/IDs and accepted Copper Vale hashes; do not refresh the whole
catalog, change live orbital positions, or generate bodies as part of that
work. Decide the exact metadata surface and compatibility behavior at its
approval gate before editing contracts or runtime code.

**Owner validation:** Review the explained outcome and boundaries, not the
numerical astrophysics independently: g's values are limits, the catalog
mixes fits, and the historical nominal solution is recoverable but joint
uncertainty information remains incomplete. Accepting this research slice
does not authorize implementation, catalog repair, or generation.

## 22. Additive evidence metadata and offline assessment guards

### 22.1 Owner approval and compatibility boundary

On 2026-11-08 the owner reviewed and accepted Section 21 and authorized the
recommended next step. The follow-up selectable form approved:
**"Recommended: additive import metadata plus offline assessment guards; no
catalog refresh or runtime/API changes"**.

- [x] Future imports request optional limit flags and asymmetric errors.
- [x] Preserve field-specific sources beside existing numeric points.
- [x] Add a separate Kepler-11 assessment-only evidence record.
- [x] Wire an executable offline assessment to explicit refusal guards.
- [x] Validate importer compatibility, source evidence and Copper Vale output.
- [x] Owner validation of the implemented offline report (2026-11-08:
      exact held JSON and exit code 2 confirmed in Git Bash).
- [ ] Separate approval for any correlated-fit adapter, runtime/API enforcement,
      catalog refresh or generation.

Implemented surfaces:

- `scripts/import-exoplanet-catalog-data.js` adds optional `fieldEvidence`
  arrays to future normalized planet/host records. Each entry has `field`,
  `value`, optional `limit` (`none`, `upper`, `lower`), signed `errorUpper`
  / `errorLower`, and a field-specific `[reference key, label]` pair.
  Missing source flags remain unknown, not measured. Invalid limit flags and
  nonfinite/wrong-sign errors throw explicit import errors.
- Existing angle wrapping remains unchanged; evidence for a wrapped angle
  additionally retains the original `sourceValue`. Host consensus selection
  is unchanged; evidence alternatives for the selected point are retained
  and deduplicated, not collapsed into a fictional single solution.
- `data/kepler-11-assessment-evidence.json` freezes the six reviewed mass/
  eccentricity inputs, limit semantics, signed errors and references for
  offline assessment only. It is not loaded as a runtime override and does
  not rewrite the catalog. Live NASA retrieval independently verified all
  six persisted records' numeric values, provenance, limits and errors.
- `scripts/lib/exoplanet-assessment-guards.js` refuses measurement claims
  with missing/mismatched/conflicting evidence, source limits, missing valid
  errors, missing references, or unknown/estimated/minimum-mass provenance.
  It does not treat an Archive `Mass` label alone as enough evidence.
- `scripts/kepler-11-assessment.js` wires the evidence to these guards.
  A common fitted architecture is **never certified by this field-evidence
  path**, even when every source agrees. A separate correlated-fit adapter
  would need its own validation; merely supplying a shared source/epoch
  cannot bypass this refusal.

This is intentionally not a general physical eligibility solver. Even a
successful measurement-evidence check returns
`physicalEligibility: "not-assessed"`. There is no generation, population
draw, independent uncertainty sampling, N-body solver, public schema change,
database write, server restart, or live orbital-position change.
Existing frozen catalogs and accepted Copper Vale hashes remain unchanged.
Future imports add metadata only when available; legacy metadata absence
does not change gameplay, but the new offline assessment refuses to infer
measurement quality from it.

### 22.2 Validation and owner instructions

Automated validation:

- `node --test test\import-exoplanet-catalog-data.test.js test\exoplanet-assessment-guards.test.js test\exoplanet-system-generator.test.js test\exoplanet-star-facts.test.js test\non-sol-p3-preview.test.js test\non-sol-p4-preview.test.js test\copper-vale-catalog-reconciliation.test.js`
  -- **64 tests passed**, including the offline CLI's exact held output/
  exit status, invalid write-argument refusal, importer compatibility,
  procedural golden hashes and accepted Copper Vale P3/P4 preservation.
- Targeted ESLint on the changed importer, offline scripts and their tests
  -- **passed**.
- `npm run typecheck` -- **passed**.
- `npm run seed:non-sol:preservation` -- **passed**, all 4,844 frozen targets
  preserved; existing historical source-file drift was reported, not repaired.
- Read-only Archive schema verification -- **all 119 requested importer
  columns exist**. No refresh command was run.

**Your validation (no Nova check or service shutdown needed):**

From the repository root, run:

```powershell
node 'scripts\kepler-11-assessment.js'
$LASTEXITCODE
```

Expected:

1. JSON has `systemId: "exo-kepler-116"`, `status: "held"` and
   `physicalEligibility: "not-assessed"`.
2. `blockers` explicitly identifies both g values as upper limits, their
   missing measurement uncertainty bounds, and the uncertified common fit.
3. Exit code is **2**, intentionally indicating a held assessment, not a
   failed import or a successful planet-generation approval.

This command uses checked-in evidence and performs no network or database
access. Do **not** run `catalog:exoplanet:refresh` to validate this slice.
Prettier remains deferred to an explicitly agreed major-phase completion.

Owner verification on 2026-11-08 used
`node 'scripts\kepler-11-assessment.js'` and `echo $?` in Git Bash.
The reported system ID, held status, not-assessed physical eligibility,
all five expected blockers and exit code **2** matched the validation gate.
This closes the scoped metadata/offline-guard validation; it does not clear
Kepler-11's physical eligibility or authorize generation.

## 23. Historical-fit parameter adapter and validation contract

### 23.1 Approval, design and implemented boundary

On 2026-11-08, after the Section 22 owner validation, the owner authorized
the recommended next step and selected **"Document design plus implement a
read-only parameter adapter; no integration or generation"**.

- [x] Define a single historical nominal-fit adapter and validation contract.
- [x] Preserve Table 3 host and all six Table 7 planet parameter/error sets.
- [x] Implement a read-only report with fixed modeling parameters distinguished
      from fitted parameters.
- [x] Verify primary-source transcription, numerical thresholds and refusal
      boundaries.
- [x] Owner validation of the parameter-adapter report (reviewed and accepted
      2026-11-08).
- [ ] Separate approval and evidence for time/coordinate conversion,
      state-vector construction or dynamical replay.

This is **parameter replay only**: deterministic transcription and unit/
component diagnostics for one published fit. It is not transit-timing replay,
orbital integration, a catalog override, a new population model, or a source
of generated celestial bodies.

Implementation:

- `data/kepler-11-historical-fit.json` freezes Lissauer 2013 Table 3 and
  Table 7 (J.R. dataset, g-fixed fit), source/table identity and conventions.
  Five named columns each hold `[nominal, symmetric marginal error]` tuples;
  a null error means a **fixed model parameter**, not an unknown measurement
  error or a measured zero uncertainty.
- `scripts/lib/kepler-11-historical-fit.js` exports
  `buildHistoricalFitReport()` with no input overrides. It clones the source,
  retains all published errors, and returns fresh objects on every call.
- `scripts/kepler-11-historical-fit.js` prints the report without network,
  database, catalog or filesystem write operations. All CLI arguments,
  including write, integration and epoch overrides, are rejected explicitly.

The output preserves `fitId: "lissauer-2013-table-7-jr-g-fixed"` and source
provenance. All six IDs remain the existing catalog planet IDs; runtime does
not consume this assessment source. Table 3 luminosity **1.045 L_sun** is
retained rather than the mixed-source composite log-luminosity.

### 23.2 Conversion and refusal contract

The adapter performs only:

```text
dynamicalEpochJd = 2454900 + 680 = 2455580
firstTransitJd = 2454900 + published transit offset
restFramePeriodDays = published observed period * 1.00019
massRatio = published micro mass ratio * 1e-6
massEarth = massRatio * 0.961 * 332946.0487
eccentricity = hypot(published e*cos(omega), published e*sin(omega))
```

The observed period is retained separately from the rest-frame diagnostic.
Adding the published JD offset is arithmetic, **not a conversion of absolute
time standards**. No Doppler transformation of absolute transit timestamps,
J2000 propagation, periastron-time inference, fitted phase-to-mean-anomaly
conversion, or orbital state-vector conversion is attempted.

The paired eccentricity components stay in the paper's sky-angle convention;
the adapter does not mix in Borsato catalog periapsis angles or invent an
ascending node. It derives no semimajor axis or physical Cartesian position.
No diagnostics receive synthetic error bars: propagating marginal errors as
independent draws would ignore unresolved correlations.

For g, the report labels both eccentricity components and mass ratio as
`fixed-model-parameter`: `e = 0`, ratio `25.29e-6`, approximately
**8.09182 M_Earth** at the adopted host mass. This is not the Archive's
`<25 M_Earth` upper limit, and neither value is promoted to an exact measured
mass. The b-f rows are labeled `fitted-parameter`; their marginal errors
do not imply independent sampling or joint uncertainty certification.

Required output boundary:

- `status: "nominal-parameters-adapted"` reports successful **parameter
  adaptation only**.
- `physicalEligibility: "not-assessed"` remains unconditional.
- `capabilities.parameterReplay` is true; `stateVectors`, `integration`,
  `stabilityCertification` and `generation` are all false.
- Four explicit blockers retain missing joint information, unvalidated
  time/coordinate/node conventions, absent dynamical/transit replay, and
  g's fixed modeling assumptions.
- The existing measurement/common-fit guard cannot accept this report as
  measurement evidence. The existing Section 22 CLI still reports held and
  exits 2; this new CLI exits **0** for successful parameter reporting,
  without lifting any eligibility blocker.

Before a separately authorized state-vector or integration implementation,
its design must establish absolute time standards, barycentric/rest-frame
treatment, coordinate/angle/node conventions and fit-phase interpretation,
recover or explicitly delimit correlated uncertainty evidence, and define
nominal published-solution replay tolerances. Reproducing paper parameters
alone is insufficient to validate dynamics. No integration tolerance or
stability certification is invented in this slice.

### 23.3 Verification and owner validation

Automated contract checks:

- All **30 nominal Table 7 parameter values and 27 marginal errors** match
  the retrieved primary table; the other three parameters remain fixed.
- Exact six IDs, Table 3 values/errors, Table 7 values/errors, source identity,
  shared epoch, deterministic JSON and source non-mutation are checked.
- Mass diagnostics match Section 21 rounded values within
  **0.000005 M_Earth**; eccentricities within **0.0000005**.
- JD arithmetic is checked within **1e-9 days**, rest-frame period arithmetic
  within **1e-12 days**. These are arithmetic tolerances, not observational
  precision claims.
- Each first transit is after the shared epoch and within one published
  period of it. No phase propagation or observed transit fit is implied.
- CLI output/exit status, rejected write/integration/epoch overrides and
  inability to bypass the offline measurement guard are tested.

`node --test test\kepler-11-historical-fit.test.js test\exoplanet-assessment-guards.test.js test\import-exoplanet-catalog-data.test.js`
-- **33 tests passed**. Targeted ESLint, `npm run typecheck`, and
`npm run seed:non-sol:preservation` passed (4,844 frozen targets preserved).
The actual CLI report and exit code 0 were independently checked. No catalog refresh,
runtime/API changes, database writes, integration or generation occurred.
Prettier remains deferred.

**Your validation, in Git Bash from the repository root:**

```sh
node 'scripts\kepler-11-historical-fit.js'
echo $?
```

Expected:

1. `status` is **nominal-parameters-adapted**, exit code **0**.
2. `physicalEligibility` is **not-assessed**; six planet entries are present.
3. `conventions.dynamicalEpochJd` is **2455580**.
4. g's mass/eccentricity kinds are **fixed-model-parameter**, with
   approximately **8.09182 Earth masses** and eccentricity **0**.
5. Only `parameterReplay` is true in `capabilities`; all four blockers remain.

There is no Nova check, network access or service shutdown needed. This
validation accepts transcription/reporting, not science certification,
physical eligibility, dynamics or generation.

## 24. State-vector and nominal-replay readiness decision

### 24.1 Approval, evidence boundary and result

After accepting Section 23 on 2026-11-08, the owner selected
**"Recommended: state-vector and nominal-replay readiness review; no solver
or generation"**. This section completes that research/design-only slice.

- [x] Record owner acceptance of the read-only parameter adapter.
- [x] Review primary model/time/angle statements and available benchmark
      statistics.
- [x] Separate nominal-replay requirements from uncertainty/stability
      requirements.
- [x] Define measurable numerical checks and unresolved benchmark gates.
- [x] Make an explicit implement-or-hold decision.
- [x] Owner review of the readiness disposition (accepted 2026-11-08;
      authorized the recommended seven-system source-semantics review).
- [ ] Recover verified replay data/conventions before authorizing a solver.

**Decision: HOLD state-vector conversion and dynamical replay implementation.**
The parameter adapter remains valid for its accepted transcription scope.
Kepler-11 is not eligible for generated additions. This bounded review does
not conclude that the missing evidence is unobtainable; it concludes that a
new solver would currently lack a verified source-to-state mapping and
replay dataset against which to validate its scientific behavior.

Evidence rechecked:
[Lissauer et al. 2013](https://arxiv.org/html/1303.0227v2),
Sections II/III, Table 1 caption, Table 5, Tables 7/9 and Appendix A/B.
The publisher landing page reached a human-verification gate; it was not
bypassed. Candidate CDS/VizieR supplementary-catalog routes could not be
retrieved due to transport failures, so neither existence nor absence of
that candidate catalog/data was established. The article's retrieved HTML
did not supply a verified machine-readable J.R. transit-time dataset or
joint dynamical covariance/posterior attachment. No claim is made that no
such data exist elsewhere. Raw Kepler photometry cited through MAST is not
the same deliverable as the paper's filtered transit-timing measurements.

### 24.2 Readiness matrix and correction of overbroad blockers

| Requirement                     | Evidence and disposition                                                                                                                                                                                                                                 | Gate before implementation                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared nominal source and epoch | Table 7 parameters, Table 3 host and JD 2455580 are recovered.                                                                                                                                                                                           | Keep this one historical source solution; no composite angle substitution.                                                                                                         |
| Time reference                  | Section II calls the observations barycentric Julian dates; Table 1 gives observed periods and the 1.00019 rest-frame factor. TDB/UTC and a complete observation/model timestamp transformation were not established in the retrieved model description. | Verify exact time standard, epoch and any light-time/frame treatment. Do not transform only periods and assume absolute transit times now share that frame.                        |
| Dynamical geometry              | Section III explicitly assumes coplanarity and does not model impact parameters or transit durations. Table 9 defines the sky-referenced periapsis angle.                                                                                                | Reproduce the paper's idealized coplanar model if that scope is later approved; do not combine separate measured transit inclinations into an invented mutually inclined solution. |
| Element/state convention        | Period and first-transit phase are fit parameters; the retrieved text does not establish an implementation-ready astrocentric/Jacobi/osculating state specification.                                                                                     | Resolve mass contributions, coordinate origin, handedness, observer direction and phase-to-state algorithm before emitting Cartesian states.                                       |
| Transit event definition        | Integrations predict transit midpoints compared to measured TTs.                                                                                                                                                                                         | Specify front-of-star condition, projected-separation minimum and timestamp mapping; verify phase recovery against independent source states or ephemerides.                       |
| Nominal fit benchmark           | Table 5 provides J.R. g-fixed per-planet/total chi-squared, but the exact measurement rows, uncertainties, filtering and unrounded reference model were not recovered.                                                                                   | Obtain a checksummed dataset with transit identities, included/excluded rows, errors and reference predictions or adequate unrounded fit parameters.                               |
| Joint uncertainty               | The paper explains fit correlations; Appendix A's covariance discussion concerns individual photometric/transit measurement fits, not a supplied joint six-planet dynamical covariance matrix.                                                           | Joint covariance/posterior information is required for correlated uncertainty propagation, not for deterministic nominal parameter arithmetic.                                     |
| Long-term validation            | The reported 250-Myr bounded case uses the Table 1 nominal model; it does not certify Table 7 replay, the composite catalog, or an added planet.                                                                                                         | Do not reuse that result as an acceptance threshold for a different model. Nominal replay alone cannot establish added-planet stability.                                           |

**Refinement of earlier generic blocker wording:** Missing measured mutual
nodes and joint covariance do not, on their own, prohibit a deterministic
nominal replay of the paper's explicitly idealized coplanar model. A common
node can be a declared coordinate convention for that model, not a claimed
measurement. Joint information remains necessary for uncertainty-aware
assessment. The existing parameter adapter conservatively declines all
state-vector certification; its output remains accurate for that narrower
scope and was not changed.

The first-transit time is not automatically a periastron epoch. In an
interacting system, initializing each planet by independent two-body
back-propagation from its transit is not established as equivalent to the
paper's fitting procedure. A numerical phase-matching operation could be
needed, but neither its algorithm nor its equivalence is assumed here.

### 24.3 Measurable future replay contract

The following is a **proposed validation contract**, not completed tests or
authorization to implement:

1. **Source/data identity:** exact six IDs and Table 7 fit identity; all
   dataset rows have unique planet/transit identifiers, finite timestamps,
   positive uncertainties, a verified time standard and documented selection.
   Record immutable hashes of raw/filtered observations and reference
   parameters. Do not silently replace the paper's filtering with current
   catalog ephemerides or new photometry fits.
2. **State/phase round-trip:** independently specified coordinate/time
   conventions must recover each requested first transit from the common
   epoch. A self-round-trip alone is insufficient; compare to an independent
   reference state/ephemeris before calling the adapter source-faithful.
3. **Numerical convergence:** for every reference transit with uncertainty
   `sigma_i`, require differences between successive tighter integrations/
   event refinements below `min(1 second, 0.01 * sigma_i)`, with at least two
   successive refinement comparisons. This is an engineering numerical
   tolerance, not an observational-fit or stability criterion. Report missing,
   duplicate and unmatched events explicitly; no subset-only success.
4. **Physical invariants:** finite positive masses, explicit unit conversions,
   barycentric momentum/center-of-mass checks and reported energy/angular
   momentum drift over the replay span. Conservation cannot substitute for
   matching observed transit predictions. Exact drift thresholds require
   an approved solver/units/span design and are not invented here.
5. **Published-fit comparison:** Table 5 J.R. g-fixed chi-squared values are
   b **86.61**, c **79.66**, d **45.08**, e **29.24**, f **17.24**, g **6.66**;
   total **264.49**, reduced chi-squared **0.99**. The six printed
   contributions sum to 264.49. These are reference statistics, not a
   sufficient machine-readable oracle.
6. **Fit acceptance tolerance:** cannot be finalized without verified data,
   weights, parameter precision and independent reference predictions.
   Printed Table 7 rounding and printed chi-squared are not grounds to
   demand exact equality or permit an arbitrary broad tolerance. Finalize
   per-event residual and aggregate/per-planet chi-squared tolerances from
   the recovered reference precision before implementing the acceptance gate.
7. **Scope separation:** a solver may eventually pass nominal replay while
   uncertainty sampling, long-term stability and generation remain held.
   No automatic promotion from successful convergence to physical eligibility.

Checks performed in this slice: primary model statements and Table 5
statistics were retrieved directly, the six J.R. g-fixed contributions
were independently summed, and the read-only adapter's existing output
boundary was inspected. No state-vector conversion, integration, model fit,
new application tests or Prettier run was performed. This section is
documentation-only.

### 24.4 Close this branch of work without an open-ended solver detour

**Recommended next:** park Kepler-11 as **nominal parameters accepted;
dynamical replay and generation held**, and perform a bounded source-semantics
review of the **other seven Stage A systems** using the now-established limit/
reference distinction. In particular, determine whether apparently
problematic mass values are limits rather than measurements before ranking
systems or proposing repairs. Keep the four original challenge cases blocked.

That next review should produce a concise disposition matrix and select at
most one better-supported next offline-screen candidate, or explicitly hold
all seven. It should not refresh catalogs, change naming, add runtime/API
enforcement, write databases, repair HD 40307, or start another solver.
This advances the broader P2 cohort rather than spending an unbounded amount
of the universe-seeding phase on one compact-system replay.

**Owner validation:** accept or revise the scope disposition: the historical
parameter adapter is accepted, nominal replay is held for specific missing
evidence, and no stability/generation claim follows. You need not independently
adjudicate astrophysics or run Nova for this documentation-only gate. A future
decision to resume Kepler-11 dynamics must explicitly address the readiness
matrix, not merely approve another nominal arithmetic report.

## 25. Remaining Stage A source-limit review and next candidate

### 25.1 Authorized scope, method and reconciliation

On 2026-11-08 the owner accepted Section 24's scope disposition and
authorized its recommended next step. Kepler-11 stays parked:
**nominal parameters accepted; dynamical replay and generation held**.

- [x] Review mass/radius/eccentricity limits and field references for the
      other seven Stage A systems.
- [x] Verify all 29 frozen/live identities and rounded mass values.
- [x] Reconcile the apparent HD 40307 and Kepler-62 point-mass problems.
- [x] Record a seven-system disposition matrix.
- [x] Recommend at most one subsequent offline-screen candidate.
- [ ] Owner review of this disposition and separate approval of the proposed
      L 98-59 offline-screen scope.

This is a documentation-only source-semantics review, not a physical screen.
No frozen catalog, assessment evidence file, importer, runtime/API, naming,
database, solver or generated-body output was changed.

Live NASA Archive `pscomppars` queries retrieved on 2026-11-08 selected
`pl_bmasse`, `pl_orbeccen`, `pl_rade`, their `lim`, `err1`, `err2` and
field-specific `_reflink` columns, plus mass provenance. A second query
checked stellar and orbital field references. For reproduction, substitute
the following host filter in Section 21's read-only TAP query and include
the listed radius/error columns:

```sql
where hostname in ('Kepler-186', 'Kepler-36', 'Kepler-62',
                   'HD 40307', 'TOI-700', 'L 98-59', '47 UMa')
order by hostname, pl_name
```

**Exact counts:** 5 + 2 + 5 + 5 + 4 + 5 + 3 = **29 planets**.
All names match the frozen records and all retrieved masses match their
stored values within 0.001 Earth masses (rounding tolerance).
The mass categories are **8 upper limits, 9 mass-radius estimates,
7 RV minimum masses and 5 non-limit `Mass` records with uncertainties**.
The last category is not an independent physical-truth certification.

#### HD 40307: upper limits, not a demonstrated unit error

The three large b/c/d values return `pl_bmasselim = 1`, provenance `Mass`,
null mass errors and source **Kiefer et al. 2021, A&A 645, A7**.
[The primary study](https://arxiv.org/abs/2009.14164) and its
[Table 9](https://arxiv.org/html/2009.14164v1) report **3-sigma true-mass
upper bounds** of approximately **3.741, 5.879 and 5.586 Jupiter masses**.
These are the large Earth-mass-scale upper bounds in the composite table,
not measured thousands-of-Earth-mass planets.

Such weak astrometric upper limits can coexist with much smaller RV minimum
masses. Therefore Section 19's characterization of these numbers as an
unreconciled severe mass discrepancy is **superseded**: the source semantics
explain it, and this review does not establish a corrupt source value or
unit mapping needing repair. The repository's omitted limit flags remain
the already-addressed future-import metadata problem.
The upper limits are too broad to substitute as true masses for physical
ranking. f/g retain Tuomi 2013 `Msini` masses with errors; g's source-status
caveat remains. No replacement masses or inclination assumptions are approved.

The new radius query returns f/g **2.13/2.56 Earth radii**, both sourced
**Calculated Value**, with no radius errors. This differs from Section 19's
reported null live radius retrieval. Record this retrieval difference rather
than asserting that the values are presently absent: in either case they
are not measured transit radii. No cause for the earlier response difference
was established.

#### Kepler-62: five upper mass limits

All five masses return `pl_bmasselim = 1`, source **Borucki et al. 2013**:
**<9, <4, <14, <36 and <35 Earth masses** in b-f order. They are not five
precise dynamical mass measurements lacking error bars. Radii are
non-limit points with errors from the same source. Eccentricity zeros have
no errors and refer to **Weiss et al. 2024**, not a common Borucki fit.
The Archive mapping was verified; the primary paper's
[bibliographic record](https://arxiv.org/abs/1304.7387) was resolved, but its
full HTML was unavailable in this review. No confidence level for these mass
limits is inferred here.

#### Kepler-186 f: eccentricity limit semantics

The retrieved `eccentricity = 0.04` returns **`pl_orbeccenlim = -1`**, a
lower-limit flag, with error fields +0.07/-0.04 and source **Torres et al.
2015**. Do not reuse Section 19's central-value description or independently
interpret its error fields as a symmetric/joint eccentricity interval.
This is the Archive's retrieved flag, not an independently adjudicated
primary likelihood. b-e still contain error-free numeric-zero eccentricities
from the DR25 KOI table; all five masses are calculated M-R estimates.
f's existing controversial status remains unchanged.

### 25.2 Seven-system disposition matrix

| System     | Source-semantics result                                                                                                                                                                                                                                          | Disposition for next offline screen                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Kepler-186 | Five calculated M-R masses; mixed Quintana 2014/Torres 2015 host/planet points; b-e eccentricity zeros have no errors; f has a lower-limit flag and controversial status.                                                                                        | Hold mass-dependent ranking pending source/uncertainty treatment.                                                                    |
| Kepler-36  | b/c non-limit masses with errors (3.83 and 7.13 Earth masses), radii/host/periods from Vissapragada 2020. Axes cite Fulton & Petigura 2018; transit epochs cite different works. Eccentricity zeros lack errors. Evolved host and extremely compact pair remain. | Hold this compact/evolved-host special case; no insertion decision from the known pair's spacing.                                    |
| Kepler-62  | Five upper mass limits, measured-radius errors, source-assumed/uncertain eccentricity zeros. Host and principal planet points mostly share Borucki 2013, but not a correlated orbit solution.                                                                    | Conditional future limit-aware screen, not the first recommendation; do not replace bounds with sampled measured masses.             |
| HD 40307   | b/c/d Kiefer astrometric upper bounds explain large values; remaining planets are RV minimum-mass cases. Host radius and mass/temperature use different sources; g's status remains unresolved.                                                                  | Hold first-screen selection. No catalog repair justified by the old mass-discrepancy claim.                                          |
| TOI-700    | All four masses are calculated M-R estimates without errors; radii/periods/axes cite Pass 2026 while host temperature and eccentricities/angles use other sources.                                                                                               | Hold mass-dependent ranking; radius measurements alone do not resolve masses or a common architecture.                               |
| L 98-59    | b/c/d measured mass/radius points with errors; e/f RV minimum masses and calculated radii. Cadieux 2025 supplies all five masses/eccentricities, periods/axes/transit epochs, and the selected host points. Composite periapsis angles still cite other works.   | **Recommend one conditional, source-aware offline analytic screen**, using the primary Cadieux solution, not mixed composite angles. |
| 47 UMa     | Three Gregory & Fischer 2010 RV minimum masses with errors; radii are calculated values without errors. Host points cite TICv8; composite transit epochs cite Rosenthal 2021 and are not proof of transits.                                                      | Hold first-screen selection pending an explicit RV/inclination and outer-orbit treatment.                                            |

These dispositions are a source-readiness assessment, not a numerical
probability of additional planets or a stability ranking. None of the seven
systems is cleared for generation by this review.

### 25.3 Single recommended candidate: L 98-59, conditional only

Primary evidence:
[Cadieux et al. 2025, Detailed Architecture of the L 98-59 System and
Confirmation of a Fifth Planet in the Habitable Zone](https://arxiv.org/abs/2507.09343)
([version 2 full text](https://arxiv.org/html/2507.09343v2),
AJ publication DOI [10.3847/1538-3881/adef59](https://doi.org/10.3847/1538-3881/adef59)).
Its reported radii and masses match the audited points:

- b/c/d radii **0.837 +/-0.019, 1.329 +/-0.029, 1.627 +/-0.041 Earth radii**;
  masses **0.46 +/-0.11, 2.00 +/-0.13, 1.64 +/-0.07 Earth masses**.
- e/f **minimum masses** are **2.82 +/-0.19** and **2.80 +/-0.30 Earth masses**;
  neither non-transiting radius is a measurement.
- Table 1 gives host **0.2923 +/-0.0067 solar masses**,
  **0.3155 +/-0.0062 solar radii**, **3415 +/-60 K** and
  **0.0122 +/-0.0010 solar luminosities**. It cites the underlying host
  sources; adopting this paper's host set would be an explicitly scoped
  source choice, not evidence that the competing Overview summary was repaired.
- The paper describes a shared TTV simulation reference epoch
  **2458345 BJD**, an explicitly chosen zero ascending node, and a joint
  RV/TTV analysis. It compares e/f inclinations fixed to **88.47 degrees**
  with a case allowing **30-90 degrees**. That alternative is a **model/prior
  domain**, not an observationally established inclination bound that can be
  promoted to universal truth.

This source provides a more explicit architecture treatment than the
unqualified composite snapshot. Its near-circular-orbit summary does not
make every eccentricity measured zero or provide a universal ceiling.
The paper's posterior and model restrictions remain relevant; this review
does not retrieve or certify a full joint posterior artifact.

**Proposed next scope, requiring separate approval:**

1. Use the primary Cadieux host/planet solution for a bounded **offline
   analytic screen**, with all five known planets retained.
2. Assess uncrowded exterior zones first; do not insert into the compact
   known chain or turn source minimum masses into true masses.
3. Compare explicitly labeled source/model inclination alternatives for e/f
   and quantify how true-mass sensitivity changes radial/Hill clearance.
   If necessary uncertainty bounds cannot be supported, report a hold
   rather than invent them.
4. Report conditional zones or blockers only; no solver, dynamics replay,
   generated-body preview, occurrence-budget change, naming or DB writes.

The goal is a source-aware screening result, not reproducing another full
dynamical study. A further parameter adapter is not automatically required
or authorized. The original four challenge systems remain blocked.

### 25.4 Verification and owner gate

Read-only verification matched all **29 names** and their rounded frozen/
live mass values, checked the limit/provenance category counts
**8 + 9 + 7 + 5 = 29**, and retrieved field-specific orbital/host references.
Primary Kiefer Table 9 explained the Jupiter-mass upper bounds; the
Cadieux paper corroborated L 98-59's selected mass/radius/host inputs and
inclination-model alternatives. Archive limit flags, not prior
point-value-only classifications, drive the corrected dispositions.
No code tests or Prettier run were required for this documentation-only
change.

**Owner validation:** review this matrix and accept the corrected source
interpretations and scoped L 98-59 recommendation. You do not need to
independently adjudicate the astrophysics. No Nova check or command is
required. Acceptance of this review alone does not approve the next screen;
its exact conditional scope is listed in Section 25.3.

## 26. Owner-directed bulk completion track (2026-11-08)

### 26.1 Accepted decisions and superseded research gates

The owner redirected the phase toward generating as close to all remaining
systems as possible today, rather than further individual scientific reviews.
A six-decision selectable form recorded the following scope:

| Decision             | Accepted direction                                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scientific standard  | Copilot's stated default: preserve source facts, distinguish limits/estimates/unknowns, and label generated additions hypothetical. Stop literature review as a prerequisite for every system; make no observational or long-term-stability claim. |
| Coverage             | Attempt every remaining non-Sol P0 target, preserving Copper Vale. Aim as close to 100% as possible. The owner defines fully blocked as no supported way to guess a possible solution, not merely missing scientific calibration.                  |
| Body density         | Reuse supported deterministic family models and provisional game-design budgets; add basic physical screening. Unsupported families need not prevent supported families from populating a system.                                                  |
| Naming and markets   | Apply accepted naming proportions/eligibility rules and protect names/IDs. Initially provide one usable station/market for newly implemented systems, with a usable resource asteroid; defer expanded market density/mechanics.                    |
| Validation           | Owner: "i will do nova validation after we are done with the full generation. do individual validation by adding unit tests." No per-system human acceptance gates.                                                                                |
| Persistence/recovery | Guard the confirmed local database target, use a server-stop write window and resumable durable batches/protected-data checks; no automatic database drop/reset, commit or push.                                                                   |

The owner further stated:
"we are shooting for as close to 100% as possible. the blocked systems need
to be listed at the end of our document if they are fully blocked. to me,
blocked means that there is no way to guess at possible solutions."

Accordingly, the optional L 98-59 source-screen gate in Section 25 is no
longer the critical path to bulk generation. Scientific limitations recorded
in Sections 18-25 remain true, but incomplete occurrence calibration,
missing fitted covariance, or an unknown eccentricity are not automatically
whole-system blockers to explicitly hypothetical game-world additions.
Earlier pilot-only scientific exclusions must be reconsidered through the
new scope, not silently applied as a permanent universe-wide ban.

This does not authorize fabricating catalog measurements, overwriting
protected source records, pretending an unsupported orbit evaluator exists,
or describing generated arrangements as scientifically certified. Explicit
assumptions and rejected candidate reasons must remain visible. A system
with supported partial output is distinct from one that is fully blocked;
success requires the agreed usable asteroid/station minimum.

### 26.2 Bulk implementation and deployment gates

- [x] Owner accepted bulk-track defaults and automated per-system validation.
- [x] Implement a separate versioned deterministic bulk policy and report;
      do not change accepted pilot policy/output hashes.
- [x] Attempt all frozen targets and report exact eligible, preserved,
      partially populated and fully blocked totals/IDs.
- [x] Generate supported hypothetical families, resources, eligible names and
      one initial screened market where viable.
- [x] Verify naming proportions, deterministic replay, collisions, source
      preservation and measurable physical screens with unit tests.
- [x] Implement durable resumable batch progress and independent readback;
      ensure normal catalog lazy-seeding cannot overwrite applied additions.
- [x] Execute full-cohort dry-run and relevant automated validation.
- [x] Present one exact deployment-scope/preflight approval gate before
      persistent database writes.
- [x] Apply/resume authorized batches against the confirmed local target and
      verify protected records and final readback.
- [x] Owner Nova validation after full generation.
- [x] Record final counts and any fully blocked systems in the final appendix.

The daily completion goal is a target, not evidence that existing
Copper Vale-only lifecycle code can already deploy the remaining universe.
No persistent bulk writes were authorized by the decision form alone;
the stated clean-preflight/deployment approval gate remains in place.
Implementation must provide honest batch progress and explicit failures
instead of reporting a dry-run or unsupported fallback as deployment success.
Prettier remains deferred until a separately agreed major-phase completion.

### 26.3 Full-cohort offline delivery and deployment boundary

The bulk implementation produced a deterministic offline proposal covering
**all 4,844 frozen targets: 4,843 successful new-system proposals and one
protected Copper Vale**. This is **100% proposal coverage**, not evidence
of persistent deployment or completed Nova validation.

| Generated family        | Additions |
| ----------------------- | --------: |
| Planets                 |    19,278 |
| Moons                   |    47,503 |
| Dwarf planets           |     4,543 |
| Resource asteroids      |    19,348 |
| Comets                  |     8,706 |
| TNOs                    |     9,402 |
| Initial station/markets |     4,843 |

Every successful proposal has planet, moon, resource-asteroid and screened
station coverage. Eligible larger-body names total **59,835**, with
**35,901 inherited / 23,934 narrative (exact 60/40)**. Language counts,
family gaps and explicit hypothetical assumptions are recorded in
`artifacts/non-sol-bulk-v1-delivery/dry-run.json`.

The implementation uses authored conservative assumptions, including
screening-only stellar/planet analogs when source constraints are incomplete,
distant-companion assumptions when separation is unavailable, approximate
aggregate circumbinary trajectories, and bounded extended outer reservoirs
when standard candidate zones are exhausted. These are explicitly fictional
game-world representatives, not source measurements or stability certificates.
Catalog records and accepted Copper Vale data/hashes are not overwritten.

Offline command:

```sh
npm run seed:non-sol:bulk -- --action=dry-run --out='artifacts\non-sol-bulk-v1-delivery'
```

The agent's isolated-target full-cohort dry-run verified **4,843 ready,
zero blocked and zero database writes**. That temporary database result is
not approval to write the normal database. A fresh read-only full-cohort
preflight against `mongodb://localhost:27017/solid-train` completed:
**4,843 ready, zero blocked, zero database writes**, exit code 0.
Its exact receipt hash and disposition must be approved before apply.
Target approval receipt:
`fab04032bdc22dcab4c77c670dfe0c67319f9d20755bbe639797081e66b6e740`.
If protected target/source state changes before apply, the CLI refuses the
stale receipt and requires a fresh preflight and approval.

The owner selected **"Approve deployment; Forge is stopped"** in the
deployment form. Persistent apply completed successfully, exit code 0:
**4,843 systems verified**, `protectedDataUnchanged: true`, matching offline
report hash. A separate read-only full-cohort readback also completed,
exit code 0: **4,843 verified**, `protectedDataUnchanged: true`, matching
report hash. The write window is closed; the owner may restart Forge.
Nova validation remains pending.

### 26.4 Market-density continuation before final packaging

The owner completed Nova validation of the body-generation/initial-market
step on 2026-11-08, then clarified that full market-density generation is
still required. The single-market baseline is not completion of that
separate expansion. Final artifact packaging is paused until this work and
its validation finish.

The follow-up form approved:

- All **4,843 newly populated systems**, preserving Copper Vale's six markets.
- Copilot to propose a deterministic mix of the accepted total-market
  profiles: frontier **1-2**, developing **3-5**, established **6-9** and
  major trade center **10-16**. Exact profile proportions and totals must be
  reported before deployment.
- Retain existing inventory behavior and quantify the additional stock,
  restock capacity and ship supply before deployment approval.
- Preserve existing markets, inventories, gameplay data and generation
  journals. Roles remain descriptive, not new gameplay mechanics.
- Automated individual validation and full-cohort dry-run before a separate
  persistent-write approval. No real density writes yet authorized.

Implementation must screen additional station orbits and their pairwise
clearances, explicitly report unsatisfied density targets, and maintain
normal catalog/bulk baseline readback compatibility. Source-guard changes
must be handled explicitly rather than bypassed or silently accepted.

#### Density v2 approval and persistent write window

The owner approved the reconciled density v2 plan and exact source migration:
**15,311 additions**, **20,157 cohort markets**; Alpha preserves three,
Barnard targets eight, Copper Vale's six remain excluded and protected.
Added canonical supply is **182,507,120 stock/capacity units**,
**14,560,761 capacity-capped restock units/hour**, and **15,311 initial
ships**, not hourly ship production.

All 4,843 accepted generation plans reproduced exactly under semantic replay.
The approved source-migration hash is
`b35bffe0e0c1bd28208388d80789f42d3b1b44e684b1a9b19a2557073df8600f`.
The full real-target read-only preflight completed, exit 0, with zero blocks
and zero database writes. Its receipt is
`ec2bb12a306fd2907535961037667b3e06ea52812bdc66e75a5c5caccd239b97`.

The owner then selected **"Approve deployment; Forge is stopped"**.
Persistent density apply completed against the explicit local
`mongodb://localhost:27017/solid-train` target, exit code 0.
Independent density readback verified **4,843 systems** with
`existingDataUnchanged: true`; separate bulk-generation readback verified
**4,843 systems** with `protectedDataUnchanged: true` and the accepted
generation report hash. Both readback commands exited 0.
The write window is closed; the owner may restart Forge.
The owner confirmed successful Nova market validation on 2026-11-08.
Final archive cleanup can follow. Existing legacy geometry defects are preserved, not repaired
or certified by the new-placement screens.

### 26.5 Reproducing the seed on other development environments

The owner requested reproducible development-environment seeding and chose:
**"document this explicit command to seed the database - no need to add an
extra step at startup"**.

Normal server startup currently seeds registry/defaults and baseline
Sol/Alpha Centauri/Barnard bodies/markets. It does **not** automatically
deploy this bulk universe or density expansion. No new startup action,
completion check, automatic bulk write or bootstrap wrapper is authorized
or needed for this decision.

The final handoff must document the existing explicit CLI sequence:
restore verified versioned artifact plans, satisfy Copper Vale's separately
protected seed/density prerequisites where applicable, run the full target
dry-run against the intended explicit local database, apply with that
environment's own approval receipt while Forge is stopped, and independently
read back generation and density in order. Never reuse another database's
approval hash. Include resumable recovery, source/version compatibility
requirements and no-reset safeguards. The completed density CLI and final
archive paths will supply the exact final command sequence.

### 26.6 Final artifact cleanup and archive

- [x] Before session close, investigate and fix the failed unit-test coverage
      action [run 42449789560](https://github.com/qagwaai/solid-train/actions/runs/42449789560),
      then validate the relevant tests/coverage. The names-file guard omitted
      the legitimate read-only inventory script; its allowlist now includes
      `non-sol-celestial-inventory.js`, without relaxing the no-write assertion.
      Targeted tests: 15/15 passed. `npm run test:coverage`: 850/850 passed;
      lines 86.59%, branches 81.97%, functions 88.57%.
      `npx --no-install eslint test\exoplanet-catalog-runtime.test.js`: passed.
      The historical remote run remains failed until the fix is pushed and CI
      reruns; no commit/push is performed by this cleanup.

The owner requested one verified delivery ZIP rather than thousands of loose
files, plus reusable packaging tools for monthly and quarterly updates.
Retained payload: **9,698 files**, comprising 4,850 generation delivery files
and 4,848 final density-v2 files (about **628.01 MiB uncompressed**).
The six earlier candidate/intermediate directories contain **24,179 files**;
they are redundant rather than additional universe content.

- [x] Complete owner Nova validation before final packaging (2026-11-08).
- [x] Archive the final delivery plans, hash-chain journal, summary, target
      preflight receipt and apply/readback receipts into one ZIP.
- [x] Verify archive contents and extracted hashes before removing loose
      delivery artifacts.
- [x] Inspect and remove only the known redundant intermediate bulk artifact
      directories; preserve unrelated artifacts and runtime-required source.
- [x] Record ZIP checksum, extraction/replay instructions and final size;
      check GitHub's file-size limits before calling it repository-ready.
      If oversized, propose Git LFS or a release asset rather than committing
      an oversized binary.

Final delivery: [non-sol-universe-v1.zip](../artifacts/non-sol-universe-v1.zip),
**66,618,580 bytes (63.53 MiB)**, below GitHub's 100 MiB file limit.
SHA256: `73d151bcfa8cce3337dfc3cbd4fe1635024904be0174036f33928f3e79a7d4ff`.
The archive contains **9,698 payload files plus one checksum manifest**.
Every payload was extracted and its SHA256/size matched both the manifest and
the original loose file before cleanup. Payload bytes: **658,510,876**.
The saved reusable tool independently verified the same archive against all
originals before deletion. Cleanup then removed exactly **33,877 loose files**
across the eight approved bulk/density directories: 24,179 intermediate files
and 9,698 archived final files. All were untracked; unrelated `artifacts/contracts`
and runtime source were preserved. The temporary verification extraction was
also removed. Extract the ZIP before any later artifact-based readback/resume.

The reusable packaging tool's six regression tests pass. Major-phase Prettier
was run only on the two delivery documents; source-guard-sensitive JS/JSON/API
formatting was deliberately excluded to preserve the deployed source guard
`7ac8b1dfa0461a7e09257c62ac8960e236d767a9265d9e88a68e4d072444fb4b`.
This is not a claim that all runtime source has been reformatted.
Gameplay travel/mining verification remains deferred where Nova cannot navigate;
story/economy handoff and legacy geometry repairs remain separate follow-up work.

Source code, policies and evidence required by runtime or deterministic
regeneration remain ordinary repository files, not deleted or replaced by
the ZIP. Packaging must preserve recovery/readback inputs; the CLI's `--out`
directory must be restored by extraction before any future artifact-based
readback/resume. No automatic commit or push is authorized.

#### Reusable packaging for monthly and quarterly updates

The [packaging tool](../scripts/package-non-sol-universe.py) uses **Python 3.11+
standard library only**; no pip packages are needed. Python is an operator-tool
prerequisite, not a Node runtime dependency. ZIP support is kept outside the
source-guard-sensitive generator libraries. It never writes to Mongo, changes
plans, deletes input directories or overwrites an existing archive.

Run from the repository root, with artifact writers stopped. Use a new versioned
output name for each accepted monthly/quarterly delivery; explicitly select
that update's reviewed input directories rather than mixing candidate runs:

```powershell
python scripts\package-non-sol-universe.py pack --output artifacts\non-sol-universe-v1.zip

# Later update example: replace paths with that update's accepted delivery.
python scripts\package-non-sol-universe.py pack --directory artifacts/non-sol-bulk-v2-delivery --directory artifacts/non-sol-market-density-v3 --output artifacts\non-sol-universe-v2.zip

# Verify an existing delivery, independently of loose input directories.
python scripts\package-non-sol-universe.py verify --archive artifacts\non-sol-universe-v1.zip

# Before deleting originals, also compare every payload against those originals.
python scripts\package-non-sol-universe.py verify --archive artifacts\non-sol-universe-v1.zip --root .

python -m unittest discover -s test -p test_package_non_sol_universe.py -v
```

`--directory` values are portable, root-relative archive paths, written with `/`
even from PowerShell. Other command paths use Windows backslashes. Defaults
select only `non-sol-bulk-v1-delivery` and `non-sol-market-density-v2`.
Each archive contains both directories beneath `artifacts/`, plus a root
`delivery-manifest.json` mapping every payload path to its byte count and SHA256.
Verification extracts to temporary storage, verifies every payload, rejects
unsafe/duplicate paths and cleans the temporary extraction automatically.
Packing also compares every original file after extraction to detect changes.
The JSON result includes the archive SHA256, counts, size and GitHub size-limit
check. Verification proves integrity, not scientific validity or write approval.
Retain the recorded archive checksum with the release/review record.
Do not delete originals until verification passes and the ZIP is safely retained.
If the ZIP is 100 MiB or larger, use a reviewed Git LFS/release-asset workflow;
the tool does not upload, configure LFS or commit anything.

**Another development environment:** obtain the matching repository revision
and verified ZIP. Before extraction, compare its SHA256 with this delivery's
recorded checksum; then run `verify` as above. Extract into a clean checkout
root, without overwriting existing working receipts:

```powershell
Get-FileHash artifacts\non-sol-universe-v1.zip -Algorithm SHA256
Expand-Archive -LiteralPath artifacts\non-sol-universe-v1.zip -DestinationPath .
```

The archive restores paths, not a Mongo backup. Follow the
[current v2 operator sequence](./seed-market-density-2026-11-07.md#135-reproducible-v2-preparation-and-exact-operator-deployment-sequence)
and its baseline/source-compatibility checks, separate Copper Vale prerequisite,
new target dry-runs/approvals, stopped-writer window, apply/resume and independent
readbacks. Never reuse archived target approvals on a new database. Normal server
startup does not perform this deployment. A different Alpha/Barnard legacy
geometry requires a new reviewed density baseline, not a forced match.
Extracted bulk/density working directories are ignored by Git; the ZIP and
ordinary runtime source/policies/tests/docs remain eligible for version control.

Backend delivery includes source/plan hashes, insert-only persistence,
durable per-system journals, interruption/resume support, protected
gameplay/economy fingerprints and normal lazy-seed precedence. The agent
reported **51 focused tests**, lint, typecheck, OpenAPI validation and
preservation passing. An additional parent run of
`node --test test\non-sol-bulk.test.js test\non-sol-bulk.mongo.integration.test.js`
passed, including isolated persistence tests. At that initial offline-delivery checkpoint, no real-user database writes,
server stop, commit, push or Prettier run had occurred. Subsequent authorized
deployment and owner acceptance are recorded above.

Offline report hash:
`8aa5b6fc33a6c1998a5a843b5159f9743009931dde86c24c35112a67d3f1652c`.
Source guard:
`6e51ce5b2abe35c19e13f5b5979c0182cd7c6d5d0bb74932132ac3a1be5705e0`.

The bulk generator and density planners now use asynchronous Mongoose model
validation. Their exported generation/planning functions must be awaited.
This changes source-guarded files; before a future delivery or deployment,
perform the existing semantic replay and obtain a new source-migration approval
and target-specific preflight. Previously accepted plans and approvals are not
silently replaced.

## Final appendix: fully blocked systems for the bulk track

**None in the accepted bulk deployment (`blocked: []` in the offline report).**
Denominator: **4,844 frozen targets**, including protected Copper Vale;
**4,843 new-system proposals** satisfy the agreed playable minimum.
Independent persistent generation and density readbacks verified all 4,843
new-system targets, with protected/existing data unchanged; Copper Vale remains
separately protected and verified. Owner Nova acceptance is recorded above.
Future environments still require their own preflight: this successful target
does not pre-approve another database's collisions, ownership or legacy geometry.
