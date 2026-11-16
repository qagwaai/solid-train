---
Owner: Project Maintainers
Last Verified: 2026-11-14
Status: Living
---

# Spatial Model (Canonical)

This is the canonical spatial-model reference for backend schemas and response contracts.

## Scope

- Canonical entity shape for ships, celestial bodies, markets, and deployed items.
- Canonical storage shape in MongoDB schemas.
- Canonical response shape in Socket.IO payloads.
- Legacy field policy and hard-cut behavior.

## Canonical Core Types

### SpatialState (required)

```json
{
  "solarSystemId": "sol",
  "frame": "barycentric",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "epochMs": 1713360000000
}
```

`frame: "barycentric"` and `solarSystemId` are not coordinate-basis identifiers.
They do not alone specify an origin, axis orientation, reference plane, inertial
alignment, or compatibility between producers.

The currently identifiable producer cases are:

- **Catalog-seeded celestial bodies:** records marked
  `isCatalogBody: true`, `sourceScanId: "catalog"`, and
  `createdByCharacterId: "system-catalog"` use a game-system root origin: a
  root body's position is `(0, 0, 0)`, and descendants are formed by adding
  parent-relative orbital positions. This is not a guarantee of a physical
  system barycenter. The seeder uses a mathematical right-handed Cartesian
  transform (`X × Y = Z`); zero-inclination orbits lie in XY, and positive
  inclination tips +Y toward +Z. Sol heliocentric catalog elements use the
  J2000.0 ecliptic as their reference plane; parent-relative moon elements do
  not expose a separate plane identifier. Absolute inertial alignment and
  cross-system axis alignment are not guaranteed. Catalog body positions are
  directly comparable within the same `solarSystemId` only when their producer
  provenance matches and their `spatial.epochMs` values are exactly equal.
- **Active station snapshots:** the backend resolves the exact trajectory
  anchor and computes `host.positionKm + relativeOrbitPositionKm` at the
  host's `spatial.epochMs`. The returned station inherits that host snapshot's
  coordinate basis and epoch, so it is directly comparable to that exact host
  record. It does not add the host's parent or propagate the host. A station
  without `stationPlacement` may still use the legacy orbital trajectory
  evaluator; its missing placement kind remains unknown.
- **Ordinary ships, manual upserts, and legacy/unverified records:** their
  persisted positions have no certified basis identity. They are unsupported
  for navigation comparison. Ordinary spatial reads do not emit a
  `coordinateBasisId`; consumers must not infer compatibility from
  `solarSystemId`, `frame`, equal epochs, or names. The opt-in navigation
  projection below is the separate, fail-closed certification/evaluation path.

`positionKm` is a snapshot at `spatial.epochMs`; this is distinct from an
orbital-elements reference `epoch` and from API request time. Catalog seeding
computes its game-grade position snapshot at the seed timestamp from catalog
elements; subsequent celestial reads preserve that snapshot and do not
propagate it. A ship's stored spatial state is also returned without evaluation
at request time. Active station evaluation is the limited exception described
above. Ordinary reads do not assemble a common-epoch navigation snapshot.
The opt-in projection below evaluates supported sources separately without
changing those stored response fields. Client-side propagation is not assumed
or authorized. Radius-query requests have no basis or epoch field; the server
compares the supplied point directly with stored positions and does not
validate compatibility.

### MotionState (optional)

```json
{
  "velocityKmPerSec": { "x": 0.1, "y": 0, "z": 0.02 },
  "angularVelocityRadPerSec": { "x": 0, "y": 0, "z": 0 }
}
```

Missing/null motion means velocity is unavailable/not asserted, not a zero
velocity. A motion object requires `velocityKmPerSec`; angular velocity may be
absent/null. The contract does not identify the velocity reference frame, its
evaluation epoch, or whether it is co-framed/co-epoch with `spatial.positionKm`.
No independent motion epoch or general propagation rule is carried by the
contract; consumers must not infer zero velocity or use it for propagation.

### Station snapshots and trajectory epochs

Market station responses type `spatial` and `trajectory` explicitly. For an
active body-orbit/stellar-orbit placement with an exact valid anchor, the
backend materializes host position plus the relative orbital vector at the
host's `spatial.epochMs`; the returned station snapshot uses that same epoch.
`trajectory.orbit.epoch` remains the orbital-element reference epoch. The
backend does not propagate the host or add its parent, and clients must not add
the host or reevaluate the station trajectory. Missing/invalid anchors fail
explicitly. `metadata-only` does not activate evaluation. `lagrange-region`
(L1-L5) and `deep-space` are representable placement kinds, but their dynamics
are unsupported; `stationKeeping` is descriptive metadata.

The current orbital transform documents the seeder's mathematical rotation
convention only. Origins and reference planes differ by producer/system as
described above; physical axis alignment is unsupported/unknown. Neither
`barycentric` nor a shared `solarSystemId` is evidence of compatibility.

## Read-only direct baseline estimate

The separate correlated socket operation `navigation-route-estimate-request`
returns `navigation-route-estimate-response`, modeled as virtual OpenAPI POST
`/socket/navigation-route-estimate`. It measures a direct baseline for a later
planner. It does not select candidates, calculate assists, produce a curved
route, execute travel, or require frontend/UI changes.

Request example (scenario speed is optional, never a default):

```json
{
  "playerName": "PilotOne",
  "sessionKey": "session-123",
  "correlationId": "36ea198f-0df8-4fa9-82b3-7bdfe0d9fd66",
  "requestIdentity": {
    "operation": "navigation-route-estimate",
    "entityType": "solar-system",
    "containerId": "sol"
  },
  "solarSystemId": "sol",
  "shipId": "owned-ship-id",
  "destinationMarketId": "sol-pluto-orbit"
}
```

The request schema rejects unknown fields, caller epochs/bases, candidates and
result limits. `requestIdentity.containerId` must exactly equal `solarSystemId`;
correlation is a client-generated UUID v4 echoed without substitution. Optional
`requestId` follows the existing response echo convention.

The endpoint reuses navigation's authenticated ownership, durable placement
lineage, exact source/station verification, epoch and internal source-change
checks. Production legacy/starter ships without lineage remain unsupported.
Test-only synthetic placement proofs are not a production issuance path.
Only supported Sol models qualify. Known-invalid source/destination station
host-profile intersections block estimation; other results retain the mandatory
`CLEARANCE_UNVERIFIED` warning. No safety, docking or transfer feasibility is
certified. Reads never seed, repair, persist positions or refresh presence.

### Measurement and duration semantics

A supported `estimate` contains system and endpoint identities (`departure.shipId`
and `destination.marketId`), `coordinateBasisId`, `referenceEpochMs`,
`positionEvaluationModelId`, `estimationModelId`, `distanceKm`, `classification`,
`assumptions`, `warnings` and `duration`.

`distanceKm` is straight-line Euclidean coordinate distance between frozen evaluated
endpoints in the named basis at the unchanged stored ship epoch. It is not flown
distance, a reachable route, candidate/curve length or a safety/clearance result.
It is not calculated from ordinary stored station
snapshots. `referenceEpochMs` is Unix milliseconds in the existing supported
`[2000,2100)` range, not request time or an orbital-element reference epoch.
The named numeric game basis and position evaluator retain their existing
limitations; neither is a new physical ephemeris/inertial guarantee.

With no `scenarioCruiseSpeedKmPerSec`, duration is exactly
`{ "status": "unavailable", "reason": "SCENARIO_SPEED_NOT_SUPPLIED" }`.
Distance remains available. Supplied speed must be finite and positive; null,
zero, negative, string and nonfinite values are invalid, not equivalent to omission.
No drive-profile lookup, fallback speed or ship-capability inference occurs.

With speed, duration contains `status: estimated`, `estimatedDurationSec`,
the supplied `scenarioCruiseSpeedKmPerSec`, and
`speedProvenance: caller-supplied-scenario`. Duration seconds equal
`distanceKm / scenarioCruiseSpeedKmPerSec`. Zero distance yields zero duration.
Nonfinite distance/duration fails explicitly, never an Infinity/null estimate.
For positive distance, estimated duration must be strictly positive; floating-point
underflow to zero fails with logged `ESTIMATE_NUMERIC_INVALID`, no distance/duration.
The response schema enforces positive duration for positive distance and zero
estimated duration for exactly zero distance.

The model is `frozen-endpoints-constant-speed-v1`, classification
`hypothetical-not-eta`: **a hypothetical frozen-endpoint, constant-speed estimate,
not an ETA**. Both endpoints are frozen; acceleration, braking, assist speed
changes and movement during the trip are omitted. This duration is relative to
the stored reference snapshot, not "arrival from now". It is not proof that the
ship has a functioning engine or can achieve the supplied speed. Docking, fuel,
hazards and travel execution are not evaluated.

### Outcomes and preview isolation

| `success` | `estimate.status` | Meaning |
| --- | --- | --- |
| true | `supported` | Distance available; duration independently `estimated` or `unavailable` |
| false | `invalid` | `NAVIGATION_REQUEST_INVALID`: malformed input or inconsistent request identity |
| false | `unsupported` | Existing ownership/lineage/system/source/epoch/model rejection, or `INVALID_SESSION` |
| false | `ineligible` | `KNOWN_INVALID_SOURCE` or `KNOWN_INVALID_DESTINATION` |
| false | `failed` | `NAVIGATION_READ_FAILED` or `ESTIMATE_NUMERIC_INVALID` |

Rejected estimates have only status, reason and message, no measurement/duration.
The outer response also includes message, player/system identity and correlation.
For malformed requests, supplied correlation/identity values are echoed exactly;
absent values are null. Session rejection uses the existing central
`invalid-session` event plus the correlated unsupported estimate response.
There is exactly one correlated estimate response per server-handled request.
The separate session event carries no estimate/correlation fields and cannot
resolve the estimate request. This is not a transport exactly-once guarantee.
Unexpected/read failures are logged and surfaced explicitly.

The endpoint returns **no position vectors, `navigationState`, candidate array,
curved path, recommendation or public revision tokens**. Existing geometric
preview requests, responses and Viewer meshes are unchanged. This response must
only update separate estimate state, never preview positions, markers or epoch.
Consumers discard obsolete correlation/selection responses and request a fresh
estimate when needed. Correlation proves request matching, not world freshness.
Model IDs identify calculation producers; there is no cache/revision-token
validation protocol. Separate estimates cannot be combined as one common snapshot.

The proposed ten-candidate evaluation cap, independent result cap, partial
candidate failures, ranking/ties, timing iteration budget and prediction horizon
are later search-phase design decisions, not accepted baseline inputs or guarantees.
Encounter prediction, gravity-assist models, A*, multiple assists, fuel
optimization and candidate/curved-route UI remain separately reviewed work.

Schemas: [request](../api/schemas/navigation-route-estimate-request.schema.json)
and [response](../api/schemas/navigation-route-estimate-response.schema.json).

### Opt-in same-response preview association

To measure the exact direct endpoints returned with a preview, use
`solar-system-get-request` with the existing `navigation` selectors and a sibling
`navigationEstimate: {}`. Optional `scenarioCruiseSpeedKmPerSec` goes inside that
options object. No additional selectors, token, epoch or candidate input is allowed.
The opt-in requires `navigation`; invalid/missing selection cannot trigger ordinary
seeding or presence refresh. Invalid estimate options reject only the estimate,
not an otherwise supported geometric preview.

The response contains existing `navigationState` plus:

```json
{
  "navigationEstimate": {
    "success": false,
    "association": "same-response-direct-endpoints",
    "estimate": {
      "status": "invalid",
      "reason": "NAVIGATION_REQUEST_INVALID",
      "message": "Invalid navigation estimate options"
    }
  }
}
```

This is a response fragment illustrating estimate-only rejection, not a full
system response. For a supported estimate, the nested `estimate` uses the baseline
measurement shape above. Nested `navigationEstimate.success` means estimate
success; outer `success` keeps its existing system-lookup meaning. A supported
paired estimate requires supported, eligible navigation positions. Rejected paired
estimates carry only status/reason/message, never distance/duration. Unsupported or
ineligible projections block estimation; `SOURCES_CHANGED` propagates explicitly,
and read failure produces failed `NAVIGATION_READ_FAILED`.

The shared calculation consumes the **exact returned** navigation departure and
destination vectors, using the same basis/epoch and source evaluation. It performs
no second projection or database read. The optional existing candidate does not
contribute to distance: a candidate waypoint polyline or illustrative curve is
not measured, nor is its travel duration estimated.

Consumers retain or replace the projection/estimate pair together. An estimate
cannot describe different-response endpoints merely because IDs, basis, epoch or
correlation match. Changing the displayed response or endpoint geometry invalidates
association; consumers must reject that association and obtain a new paired request.
The standalone estimate endpoint remains separate/unassociated with preview geometry.

The response is an immutable historical pair, not a live world-state promise.
World changes do not retroactively break internal endpoint association, but obtaining
current data requires a new pair. No TTL, token storage or database transaction is
needed for this same-response association guarantee. Existing deep-copy and second
capture/hash checks remain; they are not an atomic cross-collection database snapshot
or protection against all changes after verification.

Omitting `navigationEstimate` preserves old preview response shapes and behavior.
No frontend/marker changes, new candidates, encounter timing, assist modeling,
curves, fuel or travel execution are implemented.

Schemas: [options](../api/schemas/navigation-estimate-options.schema.json) and
[paired result](../api/schemas/navigation-paired-estimate.schema.json).

### Phase 2 single-candidate prediction

The owner approved full Phase 2B implementation on 2026-11-16 after Nova's
contract review. Runtime prediction, contract corrections and focused tests are
implemented for Nova review. The complete specification, decisions, validation
evidence and progress tracker are in
[Ship Navigation Phase 2](ship-navigation-2026-11-16.md).

The opt-in sibling is `navigationPrediction: { scenarioCruiseSpeedKmPerSec }` on
`solar-system-get-request`. For success the handler requires `navigation.candidateBodyId`
and an explicit finite speed within [120, 10000] km/s, with no default. The wire
schema intentionally passes invalid prediction options and a missing candidate
to the handler: only prediction is rejected, retaining a valid navigation preview.
Existing selector/estimate schema rules remain unchanged. It is not a ship
capability. The paired response declares `same-response-navigation-sources` and
the exact source revision of its `navigationState`. Supported results contain
the frozen departure and predicted candidate encounter and destination arrival
positions at exact integer epochs, with independent convergence diagnostics.
Rejections carry only `status`, `reason` and `message`, never partial predictions.

Sequential constant-speed straight-leg fixed points provide timing only, not a
physical trajectory. Positions use `sol-catalog-kepler-position-v1` in
`stellar:sol:catalog-cartesian:v1`; epochs use `stellar:unix-ms-uniform:v1`, without
UTC/TT/TDB or leap-second conversion. ISO-8601 `Z` strings are readable calendar
renderings of game time, not physical UTC. Keep the exact integer epoch.
Each target speed bound sums analytic full-orbit periapsis maxima along its
verified parent chain, plus the station link for arrival. Both ratios must be
at most 0.5 before solving. Missing/unbounded models fail explicitly, without
partial results. No sampled positions are used to prove the bound.
`arrival.positionKm` is the future `hostPositionKm` plus the verified orbital
station offset evaluated and rotated in the same basis at the same epoch.
The host already includes its parent chain. Nova may display clearly illustrative epoch
labels, but not an ETA or duration. Nova owns the drawn geometry. Existing
eligibility gates, the direct preview and both direct-distance operations remain
unchanged. No clearance, assist benefit, ranking, fuel or execution is added.

Schemas: [prediction options](../api/schemas/navigation-prediction-options.schema.json)
and [paired prediction](../api/schemas/navigation-paired-prediction.schema.json).

## Read-only navigation position projection

This implementation is available for Nova review. It adds no route solver,
movement, docking, travel-time UI, fuel/engine simulation, or gravity-assist
assessment. It does not certify existing ships as a side effect of a read.
A real local owned-ship purchase and authenticated restart capture are documented
below. This is local-world evidence, not a claim about an externally deployed
production server.

The existing authenticated `solar-system-get` request can opt into a separate
`navigationState` projection by supplying:

```json
{
  "navigation": {
    "shipId": "owned-ship-id",
    "destinationMarketId": "sol-pluto-orbit",
    "candidateBodyId": "sol-luna"
  }
}
```

This is the optional request fragment, not a complete authenticated request.
`candidateBodyId` is optional and singular: at most one candidate is considered.
The selectors do not assert ownership or a coordinate basis. The server checks
the requesting player's ownership and the departure ship's current system.
There is no caller-selected navigation epoch or client propagation method.
Ordinary requests without this opt-in retain their existing behavior.

The response separates navigation evaluation from ordinary stored `stars` and
`bodies`. The client must not mix evaluated navigation positions with those
stored snapshots. A successful system read is not by itself a successful
navigation projection: inspect the projection's explicit support status.

### Preview-only Viewer representation contract

This specifies consumer presentation requirements, not implemented frontend
behavior or new API fields. Use a separate **projected-marker overlay**, keeping
the ordinary Viewer scene intact. Moving the ordinary meshes would conflate
stored snapshots with evaluated positions and is not supported.

- Build the illustrative route exclusively from one supported `navigationState`:
  `departure.positionKm`, `destination.positionKm`, and, if selected, the single
  `candidates[].positionKm`. All are in its `coordinateBasisId` at its `epochMs`.
  The host position is projection context, not a substitute station endpoint.
  Do not mix responses, use stored positions as route anchors, or propagate or
  convert coordinates on the client.
- Leave ordinary body/station meshes and their stored positions/epochs unchanged.
  They are not synchronized with the projection, even when fetched together.
- Display the destination and optional candidate at their evaluated positions
  using visibly distinct **preview-only** markers (for example dashed-outline
  glyphs plus explicit labels, not color alone). Keep this distinction even if a
  projected marker happens to overlap its ordinary mesh.
- Associate a station marker by `(solarSystemId, destination.marketId)` and a
  candidate by `(solarSystemId, candidate.bodyId)`. Resolve display names using
  those identities only, never by position/proximity. Label each as
  **"Projected preview"**, identify the corresponding object, and show the
  navigation `epochMs` as exact milliseconds or an unambiguous UTC timestamp.
  Do not label it with `hostSourceEpochMs`, `sourceEpochMs`, the orbital-element
  reference epoch, or request time. If projected host context is shown, it must
  likewise be a distinct preview-only marker at `hostPositionKm`.
- The route must terminate at the **projected destination marker**. Any candidate
  waypoint must coincide with the **projected candidate marker**, not the ordinary
  body mesh. Do not snap, extend, or visually bridge the route to a differently
  positioned ordinary mesh as though it were the same-epoch endpoint.
- If the ship/selection changes or the projection is replaced, remove the old
  overlay/route together; never combine epochs or leave stale markers attached
  to a new route. An unsupported/absent projection supplies no route fallback.
- Check `previewEligibility` before showing a route: `ineligible` blocks it.
  `eligible-with-warnings / CLEARANCE_UNVERIFIED` requires a visible
  clearance-unknown warning. This is illustrative geometry only, not a safe
  route, gravity-assist trajectory, velocity-compatible state, or feasible
  transfer. A candidate marker is not a validated assist.

The tradeoff is that a projected marker can be far from its ordinary mesh, so
the overlay must make identity and epoch explicit. This preserves the ordinary
scene's stored-snapshot meaning without hiding that displacement. The actual
purchase/restart example below demonstrates the intended separation.

### Certified numeric game basis

The navigation envelope identifies this restricted numeric basis:

| Property | Definition |
| --- | --- |
| ID | `stellar:sol:catalog-cartesian:v1` |
| System | `sol` only |
| Origin | Game-system root `sol-sun` at `(0,0,0)`, not a physical barycenter |
| Axes | Existing Sol seeder's numeric Cartesian axes and parent-vector summation; right-handed, X cross Y = Z |
| Orientation | At zero orbital orientation, periapsis is +X, advancing anomaly moves toward +Y, and the zero-inclination plane is XY |
| Source plane | Sol heliocentric source elements reference the J2000.0 ecliptic; parent-relative elements have no separate plane identifier |
| Physical limits | No new external inertial alignment, ephemeris accuracy, physically correct satellite-plane transformation, or cross-system guarantee |

The ID must be versioned if the numeric coordinate convention or origin changes;
an epoch change alone does not change the basis ID. Other systems are
unsupported. Do not construct IDs from a system name.

Catalog source verification is stronger than accepting the three public
provenance labels above. Required records and their dependency chain must
match the supported seed model. Unsupported or changed sources are rejected;
evaluation must not silently overwrite gameplay edits or regenerate a system.

### What ship certification means

Certification is evidence about how the **unchanged position** was placed in
this basis. It is not a switch that makes arbitrary coordinates compatible.
The backend requires trusted placement lineage binding the departure record's
system, position, and position epoch to a verified source placement.
`solarSystemId`, `frame`, ownership, model, proximity, equal timestamps, and
caller-supplied metadata cannot establish that lineage.

This pass adds no public certification endpoint. Starter-ship creation remains
unchanged. Supported future Sol purchases now produce durable lineage through
the actual gameplay purchase path; existing ships without lineage still fail
closed. Runtime fixture tests and database-backed authenticated purchase tests
are distinguished from the real local demonstration below.

**Production issuer:** a new seeded-ship purchase at a verified supported Sol
orbital station. The server evaluates that exact station/host at one captured
purchase epoch and creates the new docked ship there under
`station-docked-zero-offset-v1`. Neither basis nor offsets come from the caller.
An old source snapshot is not copied and retimestamped on this supported path.

The embedded owned-ship schema now has an optional internal `navigationPlacement`
attestation. It binds ship/spatial/ownership revision, basis/model versions,
placement rule, exact source station/host, coordinate-producing source revision,
position epoch, lineage ID, issuance time and purchase transaction ID. Generic
ship/character writes cannot issue or restore it; ship-upsert rejects supplied
attestations with `NAVIGATION_PLACEMENT_READ_ONLY`. Ordinary response normalizers
do not expose this internal field.

A new ship is initially persisted **without** an eligible attestation. The
database-backed purchase reserves its listing atomically, persists the character
debit and market completion, then conditionally writes the committed attestation
against the unchanged owned ship and debit event. It increments the owner document
version so a stale array write cannot silently overwrite completion. This final
write is the placement-completion marker, not a cross-document transaction.
Failures before completion use the existing compensation workflow; incomplete
purchases stay uncertified. Crash recovery of incomplete economic sagas is not
implemented here; such records require operational review, not read-time issuance.

Fresh processes read and validate the persisted attestation; no runtime registry
is needed. Spatial/ownership changes durably remove it. Restoring coordinates
does not restore certification. Generic writes preserve an authoritative existing
attestation only when those bound fields are unchanged, so inventory edits do
not revoke it. Its source revision deliberately excludes prices, ledgers,
inventory, source-position epochs and unrelated timestamps; current sources must
still match and reproduce the supported catalog model on every navigation read.

The older server-only runtime helper remains for synthetic tests. Those proofs
are volatile, conservatively revoked on ship-array writes, and rechecked against
concurrent revocation. They are not the production issuer or restart mechanism.
No helper accepts a retrospective offset as evidence for an existing ship.

### Position epoch policy

The navigation target epoch is the certified departure ship's stored
`spatial.epochMs`. Its position and epoch remain unchanged. Supported catalog
bodies and their required parent chain are evaluated at that target epoch.
The station's relative vector is evaluated at that same epoch and translated
by its evaluated host position exactly once.

These are new derived navigation positions, not replacement stored snapshots.
The source position epoch, orbital-element reference epoch, target navigation
epoch, and request time are distinct. Model/source provenance identifies the
evaluation; no client propagation, ship propagation, static retimestamping,
or physical ephemeris guarantee is introduced.

The model is `sol-catalog-kepler-position-v1`. Both stored source-position epochs
and target ship epochs must be integer Unix milliseconds in
`[2000-01-01T00:00:00.000Z, 2100-01-01T00:00:00.000Z)`. A supplied `asOf` retains
its ordinary-read meaning but is ignored by the navigation branch.

Supported celestial dependencies are bundled Sol stars, planets, moons, dwarf
planets and TNOs using the existing elliptical model and exact catalog elements.
The only no-orbit root is `sol-sun`. Custom position functions, comets, manual
bodies, non-Sol systems, missing parents, changed orbital elements, and inactive
sources are rejected. A stored source position must agree with that model at
its own stored epoch within **0.001 km Euclidean distance**. The same tolerance
is used when binding a trusted source/offset placement to the ship. This is a
numerical consistency threshold, not a one-metre physical-accuracy claim.

The projection deep-copies read inputs and performs a second read/hash comparison
before returning supported positions. Any changed captured input returns
`SOURCES_CHANGED`; no automatic retry merges source revisions. The response
includes the evaluated dependencies' SHA-256 revision. This detects changes
between the reads; it is not a MongoDB transaction or a claim that fetching
multiple collections itself synchronizes physical states.

Fetching records together does not synchronize their epochs. Only a supported
projection carrying the certified common basis/epoch authorizes position
comparison. If the ship's epoch cannot itself be trusted, evaluation does not
repair it.

### Station and optional-candidate boundary

The projection resolves the exact trajectory anchor in the same system.
`parentBodyId`, aliases, names, nearest bodies, and fallback origins are not
substitutes. Unknown host basis or unsupported source evaluation prevents
station certification.

Active body-orbit/stellar-orbit placement is the supported evaluator class.
Where a legacy orbital station lacks placement metadata, its exact anchor
and evaluator must still be verified; missing placement kind remains unknown,
not inferred. Metadata-only placement does not activate evaluation. Lagrange
and deep-space placement dynamics remain unsupported.

Only bundled Sol orbital market trajectories matching their exact stored
anchor/model are supported. The relative orbit must be finite, elliptic with
eccentricity in `[0,0.99]`, and have a positive period of at least one second.
The returned destination identifies the exact host, its evaluated position, its
stored source epoch, and the station orbital-element reference epoch.

An optional candidate must be a supported planet or moon. If it fails validation,
**the whole navigation projection is unsupported**; it is not silently dropped.
It does not make an invalid departure or destination valid. No gravity-assist
assessment is produced merely because its position can be evaluated.

### Consumer behavior and physics boundary

Fail closed if the navigation projection is absent when requested, explicitly
unsupported, or has invalid/mismatched system, basis, epoch, positions, or
station-host association. Do not draw a navigation route using raw stored
positions as a fallback. A consumer that does not recognize the returned basis
or evaluator version must treat it as unsupported.

The authoritative response schema defines these rejection reasons:

| Reason | Consumer behavior |
| --- | --- |
| `BASIS_UNKNOWN` | No valid backend-issued persisted purchase lineage, or the ship changed; disable preview. Runtime-only proofs are test-only |
| `SHIP_NOT_OWNED`, `SYSTEM_UNSUPPORTED`, `SYSTEM_MISMATCH` | Reject the selection/system; do not substitute another ship/system |
| `NAVIGATION_REQUEST_INVALID` | Correct selectors; no basis or epoch assertions are accepted |
| `POSITION_EPOCH_UNSUPPORTED`, `POSITION_INVALID` | Do not retimestamp or replace the supplied position |
| `SOURCE_UNVERIFIED`, `EVALUATION_UNSUPPORTED` | Source lineage/model is unavailable or invalid; no client propagation fallback |
| `STATION_HOST_UNVERIFIED`, `STATION_PLACEMENT_UNSUPPORTED` | No exact supported station association; do not infer one |
| `SOURCES_CHANGED` | Obtain a fresh request; never combine the conflicting results |
| `NAVIGATION_READ_FAILED` | System read failed; surface the error rather than an empty supported projection |

A valid lookup can return `success: true` with an unsupported `navigationState`;
the lookup succeeded, not the position gate. Database/unexpected evaluation
failure returns `success: false` with `NAVIGATION_READ_FAILED`. An unsupported
projection carries no departure/destination positions or basis/epoch envelope.
The live schema is [navigation-state-response.schema.json](../api/schemas/navigation-state-response.schema.json);
the selectors are [navigation-state-request.schema.json](../api/schemas/navigation-state-request.schema.json).

Unavailable velocity does not prevent **position-only** comparison, but it does
prevent an assist assessment. Motion remains unsupported for propagation or
encounter calculations; omission is not zero. Atmospheric/solid-body clearance,
transfer feasibility, travel time, and gravity assists remain unsupported,
including on a supported position projection.

`previewEligibility` is a separate mandatory field on supported projections.
`ineligible` with `KNOWN_INVALID_DESTINATION` or `KNOWN_INVALID_SOURCE` blocks
the route preview. The check compares the verified bundled station's periapsis
with its host's versioned catalog mean-radius profile. This flags known profile
intersections (including the Earth station); it is not a new certified solid-body
or atmospheric envelope. Otherwise the result is `eligible-with-warnings` with
`CLEARANCE_UNVERIFIED`. The UI must label the result as illustrative geometry,
not a safe route, physically valid orbit, or validated gravity assist.

Assessing an assist later requires compatible inertial state vectors with
velocity frame/epoch semantics, time-dependent trajectories and encounter
timing, source-backed gravitational parameters, and a defined solid-body,
atmospheric, and other-hazard exclusion envelope. No travel-time UI is needed
to recognize that an actual encounter calculation still needs timing.

### Stored-world and placement approval boundaries

This pass performs no existing-world certification, position/epoch rewrite,
conversion, relocation, repair, migration, or bulk reseed. Navigation reads
must not initialize missing worlds or persist computed snapshots.

Starter creation changes remain deferred. Current character creation
authors `(0,0,0)` at creation time without basis lineage. Current seeded-ship
purchase now evaluates verified supported Sol stations at one captured epoch
for new certified ships. Unsupported/non-Sol/known-invalid station purchases
retain the ordinary placement behavior, explicitly returning an unsupported
issuance outcome in `transaction.purchasedShip.navigationPlacement`. No old
record gains a certificate merely because its purchase metadata resembles this
new producer.

Whenever `transaction.purchasedShip` is present, `navigationPlacement` is
**required**: either `{ "status": "supported", "lineageId": "..." }` for committed
issuance, or `{ "status": "unsupported", "reason": "...", "message": "..." }`.
Omission is a contract error, not implicit support. This public issuance outcome
is response-only, is not the internal attestation, and is not accepted as writable
ship metadata. Supported issuance still requires a fresh supported navigation
projection and its independent eligibility check before rendering a preview.

Any later certification of existing records needs an independent lineage audit
and explicit approval before persistence. If the original coordinate basis or
position epoch cannot be established, the record stays unsupported. Necessary
coordinate/epoch corrections must be proposed separately, never disguised as
metadata certification.

### Acceptance and next stages

1. **This pass:** verify synthetic trusted placements against mismatched stored
   source epochs; preserve every stored position/epoch; reject caller assertions,
   unsupported epochs/models/hosts, changed snapshots and concurrent revocation.
   Validate supported/unsupported response shapes, no seeding/presence writes,
   and source-position discrepancies below/above the 0.001 km threshold.
2. **Nova review:** inspect the contract, private proof boundary, evaluator limits,
   and ordinary-read separation before consuming the projection.
3. **Implemented producer:** new supported station purchases issue durable
   lineage, with database-backed registry-authenticated issuance, restart,
   rollback, concurrent listing reservation, legacy and revocation tests.
   The real local capture below is separate from isolated integration evidence.
4. **Later physics gate:** agree velocity frame/epoch, encounter-time and hazard
   contracts plus numerical assumptions before claiming any assist feasibility.

### Real local owned-ship evidence (Sol)

On 2026-11-14 a read-only query inspected an existing player-character-owned
ship in the local `solid-train` database, with only spatial/model/motion fields
selected. The following ship excerpt uses that stored record through the
production `normalizeShip` code, not a synthetic test fixture. It is a real
record supported by the ordinary owned-ship read shape, **not** a supported
navigation input. Account/character/ship identifiers are replaced with
consistent placeholders; no credentials or personal names were selected.

The Earth record was read from the same database. The station excerpt was
evaluated from the stored station and exact Earth snapshot using the production
`materializeStationSnapshotAsync` helper, without initialization/seeding or
writes. This is not an authenticated Socket.IO response capture, an atomic
multi-record snapshot, or production-environment evidence. Unrelated payload
fields are omitted. No basis field has been invented for any record.

```json
{
  "ship": {
    "id": "ship-redacted",
    "model": "Scavenger Pod",
    "ownership": {
      "ownerType": "player-character",
      "playerId": "player-redacted",
      "characterId": "character-redacted",
      "npcId": null,
      "factionId": null
    },
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": {
        "x": -322969372.45000005,
        "y": -1019723,
        "z": -222354513.20000002
      },
      "epochMs": 1794673584678
    },
    "motion": {
      "velocityKmPerSec": { "x": 9.3279, "y": 0.0291, "z": -13.5487 }
    }
  },
  "host": {
    "id": "sol-earth",
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": {
        "x": 103217976.9748857,
        "y": 106359814.93002771,
        "z": 108.6179607845734
      },
      "epochMs": 1794150382573
    },
    "orbitalElements": { "epoch": "2000-01-01T12:00:00.000Z" },
    "physical": {
      "estimatedMassKg": 5.97237e24,
      "estimatedDiameterM": 12742000
    },
    "physicalCatalog": {
      "massKg": 5.97237e24,
      "meanRadiusKm": 6371,
      "equatorialRadiusKm": 6378.137
    },
    "sourceScanId": "catalog",
    "createdByCharacterId": "system-catalog",
    "isCatalogBody": true
  },
  "station": {
    "marketId": "sol-earth-orbit",
    "siteType": "station",
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": {
        "x": 103214112.75069177,
        "y": 106361555.70547305,
        "z": 108.6179607845734
      },
      "epochMs": 1794150382573
    },
    "trajectory": {
      "kind": "orbital-elements",
      "orbit": {
        "anchorBodyId": "sol-earth",
        "anchorBodyName": "Earth",
        "orbitType": "elliptical",
        "semiMajorAxisKm": 4200,
        "eccentricity": 0.01,
        "inclinationDeg": 0,
        "longitudeOfAscendingNodeDeg": 0,
        "argumentOfPeriapsisDeg": 0,
        "meanAnomalyAtEpochDeg": 46,
        "orbitalPeriodSec": 108000,
        "epoch": "2026-01-01T00:00:00.000Z"
      }
    }
  }
}
```

The station-host pair is comparable under the existing exact-anchor construction.
The owned ship is rejected: basis is unknown and its position epoch differs
from the stored host/station by `523202105` ms. Certification alone would not
make those stored snapshots comparable. If trusted placement lineage were
separately established, the new projection could evaluate supported bodies and
the station at the ship epoch without changing any stored position/epoch.
That is conditional support, not certification of this record. The nonzero
stored velocity has no certified frame/epoch relationship and must not be
used to propagate the ship into the older snapshot.

The authored station also has a 4200 km centre-relative semimajor axis versus
Earth's 6371 km mean radius. Its elliptical orbit's 4242 km apocentre is still
inside that radius. Reproducing these numeric gameplay coordinates does not
make the destination physically valid or clear of the host. Any station
radius/period correction is a separate stored-world/design proposal for later
approval; this evaluator does not reinterpret the radius as altitude or repair
the placement.

The expected opt-in navigation result for this record is below; it is the
implemented rejection shape, not an additional authenticated response capture:

```json
{
  "navigationState": {
    "status": "unsupported",
    "reason": "BASIS_UNKNOWN",
    "message": "The owned ship has no trusted server placement lineage"
  }
}
```

This original ship remains unsupported. The separate new purchase below
demonstrates a positive case without changing or certifying this record.

For comparison, the following is an **illustrative legacy owned-ship excerpt**,
not another database capture. It deliberately matches the host epoch and still
fails because it lacks certified basis lineage:

```json
{
  "id": "legacy-ship-redacted",
  "model": "Scavenger Pod",
  "ownership": {
    "ownerType": "player-character",
    "playerId": "player-redacted",
    "characterId": "character-redacted"
  },
  "spatial": {
    "solarSystemId": "sol",
    "frame": "barycentric",
    "positionKm": { "x": 101, "y": -202, "z": 303 },
    "epochMs": 1794150382573
  },
  "motion": null
}
```

Reject as `BASIS_UNKNOWN`. An unknown/null or absent basis must not be filled
from the system/frame labels or treated as a supported navigation projection.
Do not infer a clearance envelope or treat null motion as zero.

### Real local committed purchase and restart capture

On 2026-11-14 the explicitly authorized local player acquired a **new** Scavenger
Pod through the normal authenticated Socket.IO `market-buy-request` at
`sol-mars-orbit`. The account had 425 credits; a separately approved, explicitly
recorded 75-credit administrative top-up preceded one normal 500-credit purchase.
The remaining balance was 0. The application does not grant demonstration
credits automatically.

The new ship was evaluated at its captured purchase epoch and issued persisted
lineage after debit/market completion. A **fresh Node process**, with a new
Socket.IO server/context and no runtime placement registry, returned a supported
projection to `sol-pluto-orbit` with Earth as the single position-only candidate.
This is an actual local-world player-owned record, not a manually placed test
ship. It is not evidence of external production deployment or physical validity.

The following is a sanitized **excerpt**, not a complete Socket.IO event.
Owner/ship identities are consistently redacted. Captured revisions are opaque
values, not hashes recomputable from redacted identities.

```json
{
  "ship": {
    "id": "new-owned-ship-redacted",
    "model": "Scavenger Pod",
    "ownership": {
      "ownerType": "player-character",
      "playerId": "player-id-redacted",
      "characterId": "character-redacted"
    },
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": {
        "x": -70281223.78397334,
        "y": 230097401.85297638,
        "z": 6548643.480435717
      },
      "epochMs": 1794694161611
    },
    "motion": null
  },
  "host": {
    "id": "sol-pluto",
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": {
        "x": 2972131290.202085,
        "y": -4398601868.453126,
        "z": -389561546.06215453
      },
      "epochMs": 1794150382573
    },
    "orbitalElements": { "epoch": "2000-01-01T12:00:00.000Z" },
    "physicalCatalog": { "massKg": 1.303e22, "meanRadiusKm": 1188.3 },
    "sourceScanId": "catalog",
    "createdByCharacterId": "system-catalog",
    "isCatalogBody": true
  },
  "station": {
    "marketId": "sol-pluto-orbit",
    "solarSystemId": "sol",
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": {
        "x": 2972133256.2180343,
        "y": -4398602215.595853,
        "z": -389561555.15240675
      },
      "epochMs": 1794150382573
    },
    "trajectory": {
      "kind": "orbital-elements",
      "orbit": {
        "anchorBodyId": "sol-pluto",
        "semiMajorAxisKm": 2100,
        "eccentricity": 0.05,
        "orbitalPeriodSec": 112000,
        "epoch": "2026-01-01T00:00:00.000Z"
      }
    }
  },
  "navigationState": {
    "status": "supported",
    "solarSystemId": "sol",
    "coordinateBasisId": "stellar:sol:catalog-cartesian:v1",
    "epochMs": 1794694161611,
    "departure": {
      "shipId": "new-owned-ship-redacted",
      "positionKm": {
        "x": -70281223.78397334,
        "y": 230097401.85297638,
        "z": 6548643.480435717
      },
      "provenance": {
        "kind": "trusted-persisted-placement",
        "lineageId": "f08d2910-b9d0-4aea-a749-a9f1cd1015d0",
        "sourceMarketId": "sol-mars-orbit",
        "offsetKm": { "x": 0, "y": 0, "z": 0 },
        "shipRevision": "c42da17503b48931ffd063678d07a58e81efc2235e54a04e1d65ca7b2270d4df"
      }
    },
    "destination": {
      "marketId": "sol-pluto-orbit",
      "hostBodyId": "sol-pluto",
      "positionKm": {
        "x": 2974664475.934143,
        "y": -4397608209.056393,
        "z": -390401638.20739496
      },
      "hostPositionKm": {
        "x": 2974663652.6043506,
        "y": -4397606328.389484,
        "z": -390401588.9603988
      },
      "hostSourceEpochMs": 1794150382573,
      "orbitalReferenceEpoch": "2026-01-01T00:00:00.000Z",
      "placementKind": null,
      "association": "verified-exact-anchor"
    },
    "candidates": [
      {
        "bodyId": "sol-earth",
        "positionKm": {
          "x": 90731186.08611056,
          "y": 116916412.89131102,
          "z": 115.525281754421
        },
        "sourceEpochMs": 1794150382573
      }
    ],
    "provenance": {
      "evaluationModelId": "sol-catalog-kepler-position-v1",
      "sourceRevision": "b4c8da118734bb1d409cac397d54491bcef3e66edab304e7e7f2dafef6834d0e",
      "positionToleranceKm": 0.001
    },
    "previewEligibility": {
      "status": "eligible-with-warnings",
      "reason": "CLEARANCE_UNVERIFIED"
    },
    "motion": { "status": "unsupported" },
    "clearance": { "status": "unsupported" },
    "gravityAssist": { "status": "unsupported" }
  }
}
```

The stored host/station epochs above remain `1794150382573`; their derived
navigation vectors are evaluated at `1794694161611`, as is the unchanged new
ship vector. Consumers compare those navigation vectors, not the older stored
host/station vectors. Null motion is unknown, not zero.

#### Projected-marker example from the real capture

The ordinary `sol-pluto-orbit` mesh stays at
`(2972133256.2180343, -4398602215.595853, -389561555.15240675)` km,
epoch `1794150382573`. Its projected destination marker is at
`(2974664475.934143, -4397608209.056393, -390401638.20739496)` km,
epoch `1794694161611`: approximately **2.85 million km** from that stored mesh.
The route ends at the latter marker, not at the ordinary station mesh.
The selected Earth candidate likewise gets a projected marker using its returned
vector, not the ordinary Earth position. Earth as a **body candidate** does not
make the known-invalid Earth **station destination** eligible.

The JSON below illustrates a consumer-owned overlay model, **not an API response
or new backend fields**. Marker keys and styling names are illustrative; identity,
epoch disclosure, visible distinction, and route-anchor semantics are required.
`routePointSources` identifies the only route anchors in this example, not a
solver or a claim that connecting them is physically feasible.

```json
{
  "markers": [
    {
      "key": "preview:sol:sol-pluto-orbit:1794694161611",
      "presentation": "preview-only-dashed-outline",
      "solarSystemId": "sol",
      "marketId": "sol-pluto-orbit",
      "epochMs": 1794694161611,
      "label": "Projected preview: sol-pluto-orbit at epochMs 1794694161611",
      "positionKm": {
        "x": 2974664475.934143,
        "y": -4397608209.056393,
        "z": -390401638.20739496
      }
    },
    {
      "key": "preview:sol:sol-earth:1794694161611",
      "presentation": "preview-only-dashed-outline",
      "solarSystemId": "sol",
      "bodyId": "sol-earth",
      "epochMs": 1794694161611,
      "label": "Projected preview: sol-earth at epochMs 1794694161611",
      "positionKm": {
        "x": 90731186.08611056,
        "y": 116916412.89131102,
        "z": 115.525281754421
      }
    }
  ],
  "routePointSources": [
    "navigationState.departure.positionKm",
    "navigationState.candidates[0].positionKm",
    "navigationState.destination.positionKm"
  ],
  "destinationMarkerKey": "preview:sol:sol-pluto-orbit:1794694161611",
  "candidateMarkerKey": "preview:sol:sol-earth:1794694161611",
  "warning": "Illustrative geometry only; clearance unknown. Not a validated gravity assist or feasible transfer."
}
```

The captured `navigationState` above is complete and schema-valid, while the
surrounding ship/host/station records remain sanitized excerpts. Contract tests
validate its navigation envelope and the overlay's identity/epoch/anchor mapping;
they do not claim a frontend implementation or visual UI test.

Readback verified the original ship's position/epoch and every existing Sol
celestial/station position, epoch and trajectory were unchanged. The original
ship still returned `BASIS_UNKNOWN`. Selecting the Earth station returned numeric
position support but `previewEligibility: ineligible` with
`KNOWN_INVALID_DESTINATION`, without repairing its orbit. The viewer must select
the newly purchased owned ship; this operation did not change the active ship.

### Atmospheric contract boundary

The current atmosphere payload exposes `hasAtmosphere`, optional
`surfacePressurePa`, and optional `primaryComponents`. It carries no atmospheric
exclusion/boundary altitude and no source-provenance field. Null/absent pressure
is unknown, not zero, and must not be used to derive an altitude. Adding an
exclusion altitude, its unknown-value semantics, and provenance requires
backend data/model/serialization changes before it can become a runtime
guarantee.

### PhysicalState (optional, celestial bodies)

```json
{
  "estimatedMassKg": 1e18,
  "estimatedDiameterM": 500
}
```

### ObservabilityState (required, celestial bodies)

```json
{
  "visibility": "visible",
  "scanState": "scanned"
}
```

### TrajectoryDescriptor (optional, markets)

```json
{
  "kind": "orbital-elements",
  "orbit": {
    "anchorBodyId": "ceres",
    "orbitType": "elliptical"
  }
}
```

## Canonical Entity Rules

### Ships

- Required: `spatial`.
- Optional: `motion`, `driveProfile`, `damageProfile`.
- Rejected legacy request fields: `location`, `kinematics`.

### Celestial Bodies

- Required: `spatial`, `observability`.
- Optional: `motion`, `physical`.
- Rejected legacy request fields: `location`, `kinematics`, root `solarSystemId`.

### Markets

- Required: `spatial`, `siteType`, `siteName`.
- Optional: `trajectory` (`kind: static|orbital-elements`).
- Canonical response distance unit: `distanceAu`.

### Items

- Deployed items: canonical `spatial` (+ optional `motion`).
- Contained items: `spatial: null`.
- Rejected legacy request field: `item.kinematics`.

## MongoDB Canonical Notes

- Spatial indexing is performed with `spatial.solarSystemId` + `spatial.positionKm.{x,y,z}`.
- Collections participating in canonical spatial storage include `items`, `cb`, and `markets`.
- Player-owned ships remain embedded under players, but use canonical `spatial` and optional `motion`.

## Response Contract Canonical Notes

- In-world entity responses use canonical `spatial`; `motion` is optional.
- Market responses use `siteType`/`siteName`, `spatial`, optional `trajectory`, and `distanceAu` where distance is returned.
- `trajectory.kind` (when present) is `static` or `orbital-elements`.

## Legacy Policy

- Canonical-only request boundaries are enforced for ship, celestial body, and item spatial payloads.
- Internal compatibility readers were transitional and are removed as part of the hard-cut path.

## Related Living Docs

- [MESSAGE_CONTRACT.md](../MESSAGE_CONTRACT.md)
- [MONGODB_SCHEMA.md](../MONGODB_SCHEMA.md)
- [CODEBASE.md](../CODEBASE.md)

## Historical Snapshots

- [docs/history/2026-05-05_mongodb-schema-spatial-model.md](history/2026-05-05_mongodb-schema-spatial-model.md)
- [docs/history/2026-05-05_spatial-model-response-contracts.md](history/2026-05-05_spatial-model-response-contracts.md)
- [docs/history/2026-05-05_spatial-model-implementation.md](history/2026-05-05_spatial-model-implementation.md)
