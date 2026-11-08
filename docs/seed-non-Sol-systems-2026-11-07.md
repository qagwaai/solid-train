# Non-Sol celestial seeding and naming plan

Date: 2026-11-07

Status: **P0, P1 and P2 accepted; Copper Vale-only P3 offline checkpoint implemented.**
The other four expanded pilots remain blocked. P2 acceptance includes its
explicitly blocked cases, not resolution of missing models or runtime activation.
P4-P7 remain planning-only.
The direction below incorporates the initial user question forms
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

**Reopened gate:** The checked items above describe the restricted v1 slice,
not completion of the expanded requirement. Section 12 tracks the pending
assessment, contract implications, family-specific policy and revised preview
validation. P2 cannot be accepted on the old counts or tests alone.

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

| Phase                              | Depends on | Status                                 | Completion evidence                                                  |
| ---------------------------------- | ---------- | -------------------------------------- | -------------------------------------------------------------------- |
| Direction and source investigation | None       | Complete                               | User forms and read-only inventory in this document                  |
| P0 scope and manifest              | None       | Accepted by owner                      | Owner: "P0 is green and accepted"; frozen baseline and Section 9     |
| P1 ownership/contracts             | P0         | Accepted by owner                      | Owner: "P1 is green and accepted"; Section 10 evidence               |
| P2 scientific generation           | P0, P1     | Accepted by owner, known blockers retained | Owner: "P2 is green and accepted"; [five-system assessment and counts](./seed-non-Sol-systems-2026-11-07-five-system-review.md); Section 13 records transition |
| P3 mining/stations                 | P2         | Copper Vale offline checkpoint implemented; four pilots blocked | Section 13.6; no runtime activation or persistent rollout |
| P4 body naming/hooks               | P0, P1, P2 | Not started                            | Pending                                                              |
| P5 pilot/authorization             | P3, P4     | Not started                            | Pending                                                              |
| P6 persistent rollout              | P5         | Not started                            | Pending                                                              |
| P7 final handoff                   | P6         | Not started                            | Pending                                                              |

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

| Family | Current augmentation status | Assessment and implementation implications |
| --- | --- | --- |
| Rocky/terrestrial planets | Generated | Retain; reassess occurrence, count distribution, mass-radius-density and architecture constraints alongside all other planets. |
| Gas giants / cold Jupiter-like planets | Not generated | Use `bodyType: planet`, `gas-giant` appearance. Assess envelope composition, mass-radius relations, formation/occurrence, irradiation, spacing, and satellite/ring capacity. |
| Ice giants / Uranus-Neptune analogues | Not generated | Planet category with `ice-giant` appearance. Distinguish physical composition regime from a blue texture or arbitrary orbital-distance threshold. |
| Super-Earths | Not generated | Planet category; radius/mass regime does not prove rocky composition or habitability. Assess overlaps with volatile-rich planets. |
| Sub-Neptunes | Not generated | Planet category; model uncertain envelope/rock fractions and irradiated mass-radius regimes, not a uniform scaled-down gas giant. |
| Hot Neptunes | Not generated | Planet category; assess irradiation, atmospheric loss and detection-conditioned occurrence, including suppression/desert regions. |
| Hot Jupiters | Not generated | Planet category; assess rare close-in architecture, tidal/thermal evolution and suppression of stable large moon populations. |
| Super-Jupiters | Not generated | Planet category; assess high-mass giant regime and uncertain planet/brown-dwarf classification. Do not classify solely by size or renderer archetype. |
| Lava planets | Not generated | Existing `lava` planet appearance; assess irradiation/tides and disclose modeled surface state, not confirmed global lava coverage. |
| Ocean/water-rich planets | Not generated | Existing `ocean` appearance; require hypothetical composition/atmosphere interpretation. Equilibrium temperature alone cannot establish an ocean. |
| Dwarf planets | Generated candidates | Reassess rounding/clearing criteria, outer population context and applicability of stellar-lifetime proxies. |
| Trans-Neptunian analogues / outer minor bodies | Not generated | Existing `tno` category; assess outer planetesimal populations, resonant/scattered/detached families. A non-Sol analogue need not literally orbit beyond Neptune. |
| Rocky and icy moons | Generated | Reassess counts/total mass by host family, radius distribution, Hill/Roche/thermal constraints and unresolved tidal evolution. |
| Lava / strongly tidally heated moons | Not generated | Existing moon `lava` appearance; require an explicit tidal/thermal model rather than choosing a hot texture randomly. |
| Captured irregular moons | Not generated | Same moon category, distinct origin/orbit distribution. Assess eccentric/inclined/retrograde capture, survival and host-dependent prevalence. |
| Submoons | Not generated | Nested moon parentage needs stability/tidal/age assessment and correct recursive snapshot/reference handling; ordinary moon support is not proof of submoon survival. |
| Scattered/sparse asteroids | Generated representatives | Retain mandatory mining minimum as a disclosed gameplay requirement; assess reservoir architecture and evidence separately from addressable sample count. |
| Organized asteroid belts | Not generated as distinct populations | Existing population descriptor category; assess debris/belt evidence, radial extent and depletion without introducing a belt `bodyType`. |
| Trojan / co-orbital asteroids | Not generated | Existing population descriptor category is not a co-orbital dynamics evaluator. Assess mass ratios, resonances, libration and required motion representation. |
| Comet nuclei / reservoir representatives | Generated within 100 AU | Reassess orbital and survival distributions, host environments and distinctions between observed comets and hypothetical reservoirs. |
| Distant comet-cloud analogues | Not modeled beyond 100 AU | Assess formation/ejection, stellar encounters, Galactic tides and retention. Revisit coordinate extent, long-period trajectories and representative loading without assuming every star has a Solar Oort cloud. |
| Cold icy rings | Separate proposals generated | Reassess host-family occurrence, particulate survival and ring lifetime. Existing rings must remain unchanged unless separately reviewed. |
| Rocky/dust ring variants | Not generated | Rings remain host properties; assess material/temperature/strength/resonance dependence. Distinguish circumplanetary rings from circumstellar debris disks, belts and transient dust. |
| Rogue / unbound planets | Not generated | No elliptic-orbit fiction: assess hyperbolic/free-motion trajectories, system membership, discovery and reference frames. Do not silently create new registry targets. |
| Brown dwarfs / substellar companions | Not generated | Assess formation/classification and occurrence; current scientific category contract lacks an explicit brown-dwarf type. Do not disguise them as ordinary stars or super-Jupiters. |
| Uncatalogued stellar companions | Not generated | Existing star category does not authorize fabricating an observed companion. Assess source constraints, incompleteness, binary hierarchy, luminosity and barycentric dynamics; retain hypothetical provenance. |
| White dwarfs | Not generated | Assess catalog-backed/explicitly hypothetical stellar-remnant classifications, post-main-sequence mass loss and surviving/reformed populations; contract/appearance review needed. |
| Neutron stars | Not generated | Explicit compact-remnant scientific/appearance representation requires contract assessment; assess source evidence, natal kicks, radiation and planetary survival. Never reuse `black-hole` as a fallback type. |
| Black-hole environments | Existing Cygnus preserved; augmentation blocked | Assess existing hazardous-system architecture and safe alternatives; any additional black-hole identity remains a separately approved exception, not random occurrence sampling. |

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

| Step | Depends on | Status | Required output / gate |
| --- | --- | --- | --- |
| P2-A family/contract assessment | Accepted P0/P1 and this scope decision | In progress; first five-system review prepared | [Preliminary review](./seed-non-Sol-systems-2026-11-07-five-system-review.md) covers every selected family, existing contents, proposed sample ranges, sources and blockers. Whole-universe evidence/contract assessment remains incomplete. |
| P2-B occurrence and physical calibration | P2-A | Pending | Source-backed conditional distributions, correlations, bounds and uncertainty per family; no uniform all-types template. |
| P2-C sampling-budget review | P2-B | Pending | Proposed per-system/per-host counts by family and architecture; owner selection before implementation. Revisit old planet/moon caps and 100 AU domain, without performance optimization by assumption. |
| P2-D contract/evaluator amendments | P2-A, P2-B | Pending | Implement only reviewed required additions through validators, Mongo, normalizers, API, snapshots, IDs and Nova handoff; isolated tests preserve legacy behavior. P1 acceptance remains historical, not a claim these new surfaces already exist. |
| P2-E offline family generation | P2-B, P2-C, P2-D where applicable | Partial supported pilot slice implemented | Owner authorized provisional five-system exploration with blockers; shared physical helpers, expanded planet/moon/outer-body support and deterministic reports. Full conditional occurrence work remains pending; see Section 12.6. |
| P2-F expanded owner checkpoint | P2-E | Partial slice prepared for review | Actual five-system counts, preserved catalog and named family/model blockers in the review document; whole-phase acceptance remains pending. |

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

| Finding | Authoritative backend evidence | Consequence |
| --- | --- | --- |
| Copper Vale has 26 generated asteroids, currently `silicate`/Common | [Expanded generator](../src/model/non-sol-expanded-augmentation.js), accepted P2 report | All currently map to `silicon` under the existing yield alias. P3 may assign seed-owned resource profiles but must preserve P2 mass/orbits/identity and mutable state on reruns. |
| Canonical mineral IDs differ from generic composition labels | [Canonical item types](../src/model/canonical-item-type-registry.js), [item definitions](../src/model/canonical-items.js), [market catalog](../src/model/market-catalog.js) | Use `iron`, not `raw-material-iron`; resource profiles reference actual raw-material IDs, not arbitrary ore strings. |
| Active extraction is the expendable dart drone's launch/destruction/debris path | [Launch handler](../src/handlers/launch-item-message-handler.js) | Preserve the working tool/quantity/inventory chain. Catalog text about lasers/drills is not proof that tiered extraction tools are enforced by this path. Do not silently introduce tier enforcement. |
| All 26 current asteroid masses yield 100 units under existing extraction | [Yield formula](../src/handlers/launch-item-message-handler.js), read-only Copper Vale calculation | Quantity is mass-derived and capped at 100. Resource diversity will not imply varied extraction quantities. No P2 mass/radius rewrite or mining-balance change is proposed. |
| Equipment definitions include an iron requirement for expendable dart drones | [Canonical definitions](../src/model/canonical-items.js) | Retain existing recipe semantics. Do not promise that all recipe definitions already have a complete fabrication route; validate supported chains only. |
| No existing seeded Copper Vale market/station | [Market seed dispatch](../src/model/solar-system-market-seed.js) | Query durable records as well as seed definitions before adding one; preserve usable existing IDs/economy state if present. |
| Active placement supports body/stellar orbital elements | [Placement validator](../src/model/station-placement.js) | Use an actual host and Kepler period; no fake Lagrange/deep-space ellipse. Placement activation is separate from runtime pilot activation. |
| Default market inventory uses 1,200 units for Common materials, 8% restock per interval | [Market service](../src/handlers/context/market-service.js) | Reuse market buy/sell flags, pricing, stock and restocking; no new abundance-based pricing or stock policy in this first slice. |

Resource abundances below are authored gameplay deposits. Spectroscopy has not
measured Copper Vale asteroid composition, and the game system name does not
justify a scientific claim of copper enrichment.

### 13.3 Owner-approved resource distribution

**Owner-approved for this bounded preview on 2026-11-07.** For the accepted
**26 representative asteroids**, use a stable deterministic
allocation, all **Common**:

| Canonical yielded material | Proposed representatives | Purpose |
| --- | --- | --- |
| `silicon` | 10 | Retain silicate-rich mining and circuitry vocabulary |
| `iron` | 8 | Structural materials and the existing dart-drone ingredient |
| `carbon` | 4 | Common structural material diversity |
| `nickel` | 2 | Common metallic material diversity |
| `copper` | 2 | Wiring/conduit vocabulary, not inferred system-name abundance |
| **Total** | **26** | All use existing canonical item and market IDs |

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
