# Celestial bodies — pre-release 4.0.0

Contract version remains **4.0.0**; OpenAPI format remains **3.1.0**. The
authoritative workspace root is `api/openapi.yaml`, with Celestial and SolarSystem
operation modules. These requirements clarify the unfinished 4.0.0 contract.

## Canonical writes and reads

An upsert is a complete canonical body, not a partial patch. Required body fields:
`bodyType`, `surfaceArchetype`, `catalogId`, `sourceScanId`,
`createdByCharacterId`, `createdAt`, `updatedAt`, `spatial`, `observability`,
and `state`. Supply a nonempty `id`, or a nonempty `missionId` with scan and creator
identity so the socket handler can derive the durable ID. Direct database upserts
retain the existing ID/composite-query behavior.

`spatial` requires `solarSystemId`, `frame: barycentric`, finite `positionKm.x/y/z`
in **km**, and finite `epochMs` in Unix **milliseconds**. Upsert preserves the
supplied system ID and coordinates. `observability` requires `visibility`
(`visible`, `not-visible`, `cloaked`) and `scanState` (`unscanned`, `scanned`).
Neither observability nor state is inferred from missing fields.

State is explicitly `unscanned`, `active`, or `destroyed`. Valid composition is
required for active/destroyed bodies. Unscanned bodies may omit composition or use
null; if supplied, it must be a complete valid profile: `rarity`
(`Common`, `Uncommon`, `Rare`, `Exotic`), nonblank `material`, nonblank `textureColor`.
This rule is independent of observability.scanState. Catalog composition remains
the existing game-grade material profile, not a newly introduced scientific
chemical analysis.

Canonical reads additionally return durable `id`, mission identity (nullable),
timestamps, state, destruction metadata (nullable), and debris. Invalid/missing
body classification is rejected rather than inferred from texture or old data.

## Body classification and appearance

`bodyType` is a required non-null scientific/gameplay category. `surfaceArchetype`
is a required non-null appearance input. These compatibility pairs preserve
the seeded assignments and the explicit Sol catalog fallback mapping:

| bodyType     | Allowed surfaceArchetype                 |
| ------------ | ---------------------------------------- |
| star         | star                                     |
| planet       | rocky, lava, ocean, gas-giant, ice-giant |
| dwarf-planet | rocky, icy-moon                          |
| moon         | rocky-moon, icy-moon, lava               |
| asteroid     | asteroid                                 |
| tno          | icy-moon                                 |
| comet        | asteroid                                 |
| black-hole   | black-hole                               |

`black-hole` is an additive scientific body type and renderer archetype; it is
not classified as a star and is never inferred from `textureKey`. The ten
archetype values include this explicit black-hole appearance. `icy-moon` is also used by seeded
dwarf planets/TNOs; its label does not change their bodyType. `lava` is used by
seeded moons. Comet compatibility follows the existing explicit catalog mapping,
not a newly invented texture policy. `planetType` remains independent and
optional. `visualization.textureKey` is never a classification field.

## Cygnus X-1 curated bodies

The curated system id is `cygnus-x1`, and it seeds two distinct canonical bodies:

| Entity id | Catalog identity | bodyType | Notes |
| --- | --- | --- | --- |
| `cygnus-x1-black-hole` | `{namespace: cygnus-x1, key: black-hole}` | `black-hole` | Accreting stellar-mass black hole |
| `cygnus-x1-hd226868` | `{namespace: cygnus-x1, key: hd226868}` | `star` | Visible companion and system anchor |

HYG 97987, HIP 98298 and HD 226868 refer to the visible companion/system
anchor. They are not an HYG black-hole catalog entry. The black hole does not
inherit the companion's stellar classification or identifiers. The registry
currently has no verified global HYG `positionPc` in the checked-in fixture; its
position and distance fields are null rather than invented.

The seeded black-hole parameters use the source-backed estimates
`21.2 ± 2.2 M☉`, distance `2220 ± 180 pc`, binary period `5.599829 d`,
relative binary semimajor axis `0.244 AU`, eccentricity `0.0189`, and inclination
`27.51°`. The semimajor axis is for the relative binary separation, not the
black hole's barycentric semimajor axis (approximately `0.160 AU`). The companion
catalog carries `40.6 ± 7.7 M☉`, radius `22.3 R☉` (stored in km), and temperature
`31,138 K`. Values are estimates with the
citations held in `blackHoleProperties.sourceReferences` (Miller-Jones et al.
2021, DOI `10.1126/science.abb3363`; Orosz et al. 2011, DOI
`10.1088/0004-637X/742/2/84`; arXiv `2411.12507` for wind-fed accretion
context), not new measurements. The computed
`schwarzschildReferenceRadiusKm: 62.6` is the nonrotating reference `2GM/c²`.
It is not a direct event-horizon measurement; spin is not supplied, so
`eventHorizonRadiusKm` remains null. `visualAccretionDiskOuterRadiusKm` is also
null: a renderer's disk extent is not the black hole's event horizon or
Schwarzschild radius. Cygnus X-1 is rotating, so a Schwarzschild-based
front-end renderer is an explicitly approximate visualization, not a claim
that the system is nonrotating.

The companion has `parentBodyId: cygnus-x1-black-hole` to express the catalog
hierarchy; this is not a position offset. Neither body has orbital elements.
The reported inclination is preserved as binary source metadata; it does not
establish ascending node, argument of periapsis, phase, or an in-plane orientation,
so the seed does not fabricate any of them.

Both authored seed placements are the system-local origin `{x: 0, y: 0, z: 0}`
in `spatial.positionKm` (km), with `frame: barycentric` and `epochMs` set to
the seed snapshot instant in Unix milliseconds (J2000 only when the seed caller
does not supply a timestamp). Axes follow the backend's documented right-handed
Cartesian convention (`X × Y = Z`), but the zero placement makes no claim about
observed relative coordinates or axis alignment. The HYG/global system
coordinate is a separate parsec-valued field; it is not added to these local
snapshots. These authored positions are deliberate co-location placeholders,
not measured orbital positions. No route or gate data is added.

Whole-system celestial listing retains the existing caller-provided `limit`
semantics. With the Cygnus catalog's two-body result, `limit: 2` returns both
canonical bodies; no global limit is raised. A smaller caller limit continues
to return only that many records.

### Source fields and radius semantics

The optional nullable [`BlackHoleProperties` schema](../api/schemas/black-hole-properties.schema.json)
is referenced by body writes and system/body reads. It is persisted separately
from `physicalCatalog` and the gameplay `physical` estimates:

| Field on `blackHoleProperties` | Cygnus seed value | Meaning |
| --- | --- | --- |
| `massSolar` / `massUncertaintySolar` | `21.2` / `2.2` | Black-hole mass and uncertainty in solar masses |
| `distanceParsec` / `distanceUncertaintyParsec` | `2220` / `180` | Source distance estimate and uncertainty in pc; not a global position |
| `orbitalPeriodDays` | `5.599829` | Binary period in days |
| `relativeBinarySemimajorAxisAU` | `0.244` | Relative orbit semimajor axis in AU, approximately 36.5 million km; not instantaneous separation |
| `eccentricity` | `0.0189` | Dimensionless relative orbit eccentricity |
| `inclinationDeg` | `27.51` | Source inclination in degrees; insufficient to orient or phase the binary |
| `schwarzschildReferenceRadiusKm` | `62.6` | Nonrotating `2GM/c²` reference in km |
| `eventHorizonRadiusKm` | `null` | No canonical spin-dependent horizon radius asserted |
| `visualAccretionDiskOuterRadiusKm` | `null` | No canonical physical disk boundary asserted |
| `sourceReferences` | Citation strings | Literature provenance, including wind-fed accretion context |

The companion's `physicalCatalog` carries `massKg`, `massSolar: 40.6`,
`massUncertaintySolar: 7.7`, `meanRadiusKm: 15514110`, and
`meanTemperatureK: 31138`, with its own `sourceReferences`. Radius conversion
uses `1 R☉ = 695700 km`. Unknown companion luminosity remains null.

No generic black-hole body radius is supplied in `physicalCatalog`. The shared
seed builder's gameplay `physical.estimatedDiameterM` is `0` when no catalog
radius is known; that sentinel is not a measured diameter and must not be
used as a horizon or disk size. Keep a cinematic disk size in the viewer's
visual configuration, not in source physical metadata.

Scientific references:

- [Miller-Jones et al. (2021)](https://arxiv.org/abs/2102.09091):
  revised mass and distance estimates.
- [Orosz et al. (2011)](https://doi.org/10.1088/0004-637X/742/2/84):
  binary parameter context.
- [Wind-fed accretion context](https://arxiv.org/abs/2411.12507).

### Availability, startup, and request sequence

`cygnus-x1` is included in the supported system registry and can be found with
`solar-system-list-request` using `search: "cygnus-x1"`. The registry reports
`starCount: 1` and `isMultiStar: false`: the system contains two bodies, but only
one is a star. `primaryStar`, `positionPc`, and the registry's `distanceParsec`
are null. This does not erase the separate source distance estimate above.
Consumers must tolerate unknown global positions rather than inventing a map
coordinate or interpreting null as zero.

Restarting the server loads the updated registry, schemas, and catalog code.
Cygnus is **not** part of the startup celestial seeding list. A successful
`solar-system-get-request` seeds it on demand, then returns both canonical
bodies in `bodies`; only the companion appears in `stars`. Listing celestial
bodies alone does not seed an unmaterialized system.

For an already registered/authenticated Socket.IO client, use the existing
session values and a fresh correlation UUID for each request:

```js
socket.emit('solar-system-get-request', {
  playerName,
  sessionKey,
  correlationId: crypto.randomUUID(),
  requestIdentity: {
    operation: 'solar-system-get',
    entityType: 'solar-system',
    containerId: 'cygnus-x1',
  },
  solarSystemId: 'cygnus-x1',
});
```

Wait for a successful `solar-system-get-response` before requesting the bounded
whole-system body list:

```js
socket.emit('celestial-body-list-request', {
  playerName,
  sessionKey,
  correlationId: crypto.randomUUID(),
  requestIdentity: {
    operation: 'celestial-body-list',
    entityType: 'celestial-body',
    containerId: 'cygnus-x1',
  },
  solarSystemId: 'cygnus-x1',
  limit: 2,
});
```

The successful `celestial-body-list-response.celestialBodies` contains the two
curated records when no other bodies or filters affect the result. The limit is
not a priority guarantee or an override of state/mission/creator filters. Do not
depend on collection order; resolve each body by its exact `catalogIdentity`.
Omit both `positionKm` and `distanceKm` for this whole-system query.
The Socket.IO event names above are distinct from the `/socket/...` documentation
paths in OpenAPI; those paths are not HTTP endpoints.

For a system never seeded before, the first system GET persists its catalog in
MongoDB. Existing current-version seed records are reused, not automatically
repaired or overwritten on restart. The seed version is unchanged. The existing
full-world recreation policy below applies if a deployment needs to replace
old catalog data; no database reset or migration is performed by this feature.

### Nova integration checklist

- Match `{namespace: "cygnus-x1", key: "black-hole"}` exactly to select the
  Cygnus black-hole profile through the reusable renderer core.
- Match `{namespace: "cygnus-x1", key: "hd226868"}` independently for the
  companion. Entity IDs, names, texture keys, and HYG/HIP/HD aliases are not
  renderer-selection substitutes.
- Include `cygnus-x1` in any frontend curated/limited selector and request both
  canonical bodies. Registry availability does not automatically update a
  frontend allowlist.
- Keep API snapshots separate from an authored viewer layout. Any staged
  separation, orbital animation, orientation, or phase must be labeled as
  visual/authored rather than observed or backend-computed.
- Handle nullable system coordinates and unknown horizon/disk sizes explicitly.
  Do not infer offsets from `parentBodyId` or classify the black hole as a star.
- Do not add routes or gates. Catalog availability is not travel connectivity.

### Validation and handoff evidence

Executable coverage is in
[`cygnus-x1-system.test.js`](../test/cygnus-x1-system.test.js), including the two
identities, required canonical state and spatial fields, classification
compatibility, Mongoose metadata retention, system availability, bounded body
listing, and OpenAPI identity examples.
[`celestial-operation-examples.test.js`](../test/celestial-operation-examples.test.js)
validates the operation examples.

```powershell
node --test test\cygnus-x1-system.test.js test\celestial-operation-examples.test.js
npm test
```

Session-close validation (2026-10-25):

| Command | Result |
| --- | --- |
| `npm test` | Passed OpenAPI validation and all 627 tests before the final persistence regression was added |
| `node --test test\cygnus-x1-system.test.js test\celestial-operation-examples.test.js` | Passed all 9 tests after adding persistence coverage and the three missing Mongoose binary metadata fields |
| `npx eslint src\db\models\celestial-model.js test\cygnus-x1-system.test.js` | Passed |
| `git diff --check` | Passed |

The final persistence correction adds `relativeBinarySemimajorAxisAU`,
`eccentricity`, and `inclinationDeg` to the Mongoose subdocument so these source
fields are retained rather than discarded. Restart the server again after
deploying this correction. Already persisted current-version bodies are not
automatically backfilled; use the existing approved recreation policy if old
records need replacement. The persistence regression validates Mongoose
serialization without connecting to MongoDB.

At handoff, the restarted local server's `GET /openapi.yaml` returned HTTP 200
with the Cygnus namespace and both entity IDs. This confirms contract serving,
not an authenticated system read or MongoDB round trip. Authenticated live
system/body verification and frontend visual validation remain consumer
integration checks; no measured orbit or live rendering is claimed by unit tests.

## Stable astronomical catalog identity

Optional `catalogIdentity: { namespace, key }` is independent of entity `id`,
curated source `catalogId`, game system, hierarchy, classification and appearance.
The complete registry and rules live in authoritative
[`api/openapi.yaml`](../api/openapi.yaml) under `x-catalog-identity`, with the
shared [`CatalogIdentity` schema](../api/schemas/catalog-identity.schema.json).
Omission/null mean no identity; omission on an existing upsert preserves identity
for legacy writers, whereas explicit null clears it. No aliases/case conversion
or name/id-prefix guessing is allowed. Unsupported valid pairs remain procedural.
Texture URLs, asset versions and licensing remain frontend-owned; `textureKey`
stays a legacy appearance hint, not an astronomical lookup key.

Fresh curated seeds carry explicit source assignments. Deployment uses a full
approved database drop/recreation, not a migration/backfill. Stop writers, recreate
the world database including celestial seed state and `catalog_identity_assignments`,
then restart and use normal curated seed creation. No migration scripts or hidden
read-time identity persistence are provided. Old data not recreated stays procedural
when identity is omitted/null; registry support does not create missing bodies.

## Per-body stellar source fields

Every stellar body, including secondary/tertiary companions, can carry top-level
`spectralClass` (string or null) and `luminositySolar` (nonnegative number or null,
in **solar luminosities**). Neither field is required on writes or by the read
schemas. Omitted and explicit null both mean unknown; the current normalizer
serializes unknown values as null on reads. A supplied spectral class must be a
string, and a supplied luminosity must be a nonnegative number. In particular,
`luminositySolar: 0` is a valid supplied value, not the unknown sentinel. The
optional `visualization.colorHex` remains independent. The legacy visualization
spectralClass remains available but is not the canonical field.

Source flow:

- `data/hyg-fixture.csv`: `spect` supplies spectral class and `lum` supplies
  luminositySolar. Empty/unrecognized spectra are null, not fabricated G stars.
- Sol and Alpha Centauri curated catalogs look up existing HYG IDs (Sun `0`,
  Alpha Cen A `71456`, B `71460`, Proxima `70890`) for these fields.
- Procedural generation copies each input star's values, including companions.
  Its fallback luminosity for habitable-zone generation is **not** exported as a
  measurement.
- Seeding, Mongoose `cb` documents, context normalizers, body-list,
  solar-system-get and upsert preserve the top-level values.

The luminosity values are source catalog values, not a guarantee of precision
or new measurements. No luminosity is inferred from a spectral class, mass,
radius, temperature, or magnitude.

## Parent hierarchy, orbit origin, and spatial coordinates

`parentBodyId` records catalog hierarchy; it is not a generic instruction for
clients to add a parent's position to a body's position. The Alpha Centauri
catalog, for example, keeps Alpha Centauri B and Proxima Centauri in the
stellar-parent hierarchy, and Proxima's planets point to Proxima. The celestial
catalog seed materializer uses catalog parents and relative orbital calculations
to produce each stored `spatial.positionKm` as a system-origin snapshot. Reads
return those already-materialized coordinates; consumers should use them
directly rather than add parent positions again.

`orbitalElements.anchorBodyId` is emitted only when the relative orbit is
anchored to a non-star parent (for example, a moon orbiting a planet). It is
absent/null for stellar/system-origin orbits. A companion star can still have a
stellar `parentBodyId`; that hierarchy link intentionally does not become an
`anchorBodyId`. Do not infer an orbital anchor from `parentBodyId`.

## Orbital elements and position snapshots

All affected requests/reads reference `api/schemas/orbital-elements.schema.json`.
The field may be absent/null; when present as an object, all eight elements are
required and non-null:

| Field                       | Units / requirement                                       |
| --------------------------- | --------------------------------------------------------- |
| semiMajorAxisKm             | km, >= 0                                                  |
| eccentricity                | dimensionless, 0 through 0.999; elliptic only             |
| inclinationDeg              | degrees                                                   |
| longitudeOfAscendingNodeDeg | degrees                                                   |
| argumentOfPeriapsisDeg      | degrees                                                   |
| meanAnomalyAtEpochDeg       | degrees                                                   |
| orbitalPeriodSec            | signed seconds; absolute duration >= 1                    |
| epoch                       | ISO 8601 date-time with timezone; reference element epoch |

`anchorBodyId` is optional/string/null. It identifies a non-star parent orbital
origin, such as a moon's planet. Absent/null indicates the stellar/system origin;
`parentBodyId` retains the hierarchy, including companion-star parents.

The existing curated retrograde moons contain negative source periods. Those
values are retained in storage and returned unchanged. Propagation uses
`abs(orbitalPeriodSec)` as the duration; inclination provides the orientation.
The sign is not applied a second time. This fixes the previous negative-period
clamp to one second without rewriting catalog periods.

`spatial.positionKm` is computed/materialized at seed time and stored with
`spatial.epochMs`. Reads return that snapshot; they do not propagate orbital
elements to the current time. `orbitalElements.epoch` is a separate reference
epoch, not the snapshot timestamp. Reseeding can deliberately materialize a new
snapshot. The seed revision is `2026-10-canonical-star-orbit-v3`; it performs
upserts, not collection deletion.

## Coordinate basis and producer audit

The reusable `spatial` shape is defined by
`api/schemas/spatial-state.schema.json`: `positionKm` is a Cartesian x/y/z
triple in km, `solarSystemId` scopes it to a system, `frame` currently has the
single value `barycentric`, and `epochMs` is a Unix-millisecond snapshot time.
There is no persisted basis/orientation identifier. In particular, the
`barycentric` label does **not** prove that a physical center of mass was
calculated or that x/y/z are aligned to ICRS, the J2000 equator, or the J2000
ecliptic. The celestial seed roots (the Sun in Sol and the primary star in
other systems) are placed at `(0, 0, 0)`; they are not moved to a computed
mass-weighted barycenter.

The verified orbital calculation in
`src/model/solar-system-celestial-seed.js` solves Kepler's equation, makes the
perifocal vector `(xp, yp)`, then applies the active, right-handed rotation
`Rz(longitudeOfAscendingNodeDeg) * Rx(inclinationDeg) * Rz(argumentOfPeriapsisDeg)`.
Consequently `X cross Y = Z`; for a circular orbit with zero inclination,
ascending node, and periapsis argument, mean anomaly 0 is `+X`, mean anomaly
90 degrees is `+Y`, and positive inclination rotates `+Y` toward `+Z`. A
nonzero node rotates the ascending-node direction in XY, and the periapsis
argument rotates the perifocal axes before inclination/node rotation. These
are exact implementation conventions, not a guarantee of a shared
astronomical reference plane. The Sol catalog declares its heliocentric
planet/dwarf-planet/asteroid/TNO elements to be J2000.0 ecliptic mean elements;
the parent-relative moon inputs and Alpha Centauri curated inputs do not carry
uniform reference-plane metadata, and no source-to-common-frame normalization
is applied.

The sources and current transformations are:

| Producer / entity                                | Verified position source and operations                                                                                                                                                                                                                                                                                                                                                                                                                          | Basis limits                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sol curated celestial bodies                     | The orbital formula above. Root Sun is zero; children are recursively translated by their catalog parent's already-computed position. This includes moons, whose stored positions are system-origin snapshots rather than parent-relative offsets.                                                                                                                                                                                                               | Sol's catalog documents J2000 ecliptic input elements for planets/dwarfs/asteroids/TNOs. Moon-source plane conventions are not declared/normalized by this code; no physical barycenter is calculated.                                                                           |
| Curated Alpha Centauri celestial bodies          | Same formula and recursive parent summation. Alpha Cen A is zero; B, Proxima, and their planets use their stored curated elements and parent links.                                                                                                                                                                                                                                                                                                              | Curated orbit values, including companion-star values, have no common physical basis identifier or normalization in the implementation.                                                                                                                                          |
| Procedural HYG-system celestial bodies           | The primary star is zero. Additional stars use synthetic illustrative orbital elements; generated planets use generated elements. Both are passed through the same formula and parent sum.                                                                                                                                                                                                                                                                       | HYG's `positionPc` is not used to position these local bodies. Procedural companions/planets are not transformed from HYG global coordinates.                                                                                                                                    |
| HYG stars and solar-system registry              | `src/model/hyg-star-catalog.js` copies fixture `x/y/z` into `positionPc`; registry and star responses keep those values in parsecs.                                                                                                                                                                                                                                                                                                                              | Separate global catalog coordinates and units, not `spatial.positionKm`; this application does not rotate or convert them. The application does not establish their physical axis alignment.                                                                                     |
| Moons and other parent-relative celestial orbits | Relative orbital vectors use the same Cartesian formula and are added to the parent's seeded system-origin vector inside the materializer. `anchorBodyId` only identifies a non-star orbit origin.                                                                                                                                                                                                                                                               | Consumers must not add the parent again. The source reference plane is not recorded per orbit.                                                                                                                                                                                   |
| Ships                                            | Ship normalizers accept a `spatial` object and retain its XYZ values; list responses return the normalized snapshot. No orbital calculation or display transform is applied.                                                                                                                                                                                                                                                                                     | The supplied source basis is not identified or checked beyond the `barycentric` enum and vector shape.                                                                                                                                                                           |
| Market stations                                  | The catalog builder's `(semiMajorAxisKm, 0, 0)` is only an internal placeholder. Context seeding and list/location reads use `materializeStationSnapshotAsync` in `orbital-math.js`: resolve the exact canonical `trajectory.orbit.anchorBodyId`, evaluate the existing Kepler/rotation relative vector at the host's `spatial.epochMs`, add the host's already-system-origin position once, and copy its epoch. Route stations copy this materialized snapshot. | The relative vector is defined in the host's implementation Cartesian basis (right-handed, zero-inclination XY), not host-local/body-fixed axes. No additional parent translation or physical reference-plane normalization. Consumers use snapshots directly, never add a host. |
| Starter mission asteroids                        | `mission-upsert-message-handler.js` places the ten positions on an XY ring using cosine/sine, adds small Z offsets, and sets `localOffsetKm = positionKm - clusterCenterKm`; the current cluster center is zero.                                                                                                                                                                                                                                                 | These are game-authored positions, not orbital elements or a sourced inertial frame.                                                                                                                                                                                             |
| Gate route entities                              | `solar-system-gate-seed.js` stores game-authored XYZ values, which route responses copy.                                                                                                                                                                                                                                                                                                                                                                         | No physical orientation or transform is specified.                                                                                                                                                                                                                               |

Thus the orbital seeder has a definite right-handed math convention and XY
reference plane at zero inclination, but the current API does **not** guarantee
that every producer listed above is in one physically aligned frame. In
particular, caller-supplied ship coordinates and HYG
global parsec coordinates must not be treated as normalized orbital snapshots.
Do not reconstruct an orbit or add `parentBodyId` positions when consuming
celestial snapshots. Do not combine `positionPc` with local `positionKm`.

For display only, an XY-to-XZ view can use a proper rotation about X rather
than swapping Y and Z (which would reverse handedness). For example,
`(x, y, z) -> (x, -z, y)` is a +90-degree X rotation and maps an XY-plane
snapshot (`z = 0`) to `(x, 0, y)`. Keep this transform in presentation code;
it is not a canonical-coordinate correction and must not be written back.

A unified physical inertial basis or a persisted
`basisId` would require a separate compatibility decision and potentially
versioned data migration. No physical basis migration is introduced here.
The station-only snapshot correction and explicit repair policy follow below.

### Station snapshots, prior behavior, and approved market repair

The legacy market catalog used the nonexistent host ID `sol-moon`, while the
celestial catalog's Moon is `sol-luna` (parent `sol-earth`). **The station identity
remains `sol-moon-orbit`**. Previously the raw seed used `(a,0,0)`, but location
reads added a request-time orbital vector to the cached/DB host snapshot or a
hard-coded fallback. The legacy Moon fallback was `(149982270.7,0,0)`, explaining
the observed market near that X-axis position rather than near canonical Luna.
Those reads labeled the combined result with request time even when the host
snapshot was older. The old producer documentation described only the raw seed,
not this location/route path.

Station materialization now resolves **only the declared exact anchor ID** via
the celestial context cache, then DB on cache miss; there is no `sol-moon` alias,
Earth/system-origin fallback, or inference from `parentBodyId`. A missing host,
invalid host spatial/epoch, wrong system/frame, or missing element epoch raises
`MARKET_ANCHOR_UNRESOLVED`. Market list/location handlers return `success:false`,
an explanatory `message` containing this code, and `markets:[]`. Seed operations
return `success:false` with `reason`; no success-shaped station fallback.

`station.positionKm = host.positionKm + relativeOrbit(orbit, host.epochMs)`.
The existing station orbital helper solves Kepler's equation and applies the
right-handed rotation described above. `orbit.epoch` is the element phase
reference; `spatial.epochMs` is **exactly the host snapshot epoch**. Station
catalog elements use deterministic `2026-01-01T00:00:00.000Z`, independent of
service startup/request time. Hosts are not propagated to now. For a circular
orbit, distance from the host is `a` (Moon 1200 km, Earth 4200 km in circular
regression fixtures); the curated elliptical catalog has instantaneous radius
`a*(1-e*cos(E))`, so those distances need not equal `a` exactly.

List, location, and route-station reads perform **response-only materialization**
against the resolved host snapshot. They do not persist this correction or
change orbital phase with request/asOf time. Fresh contexts hydrate persisted
markets rather than serve bootstrap placeholders. Celestial cache freshness is
unchanged: a context may retain a cached host until explicit refresh/reseed.
Cold in-memory default initialization supplies missing canonical celestial bodies
for Sol, Alpha Centauri, and Barnard's Star before caching their default markets.
Existing supplied host snapshots are preserved. Database-backed initialization
does not fabricate cached hosts; persisted celestial seeding remains explicit.
Restocking remains separate existing economy behavior. No station upserts occur
on reads or on a current-revision seed cache load; sold ship listings stay sold.
Free-floating/belt markets retain their previous location policy; unrelated
orbital dynamics and global astronomical basis alignment are not redesigned.

Market revision is `2026-10-station-snapshot-v2`. An existing nonempty world with
an older/missing revision returns `MARKET_SEED_REPAIR_REQUIRED` on ordinary seeding:
**no automatic revision upgrade or bulk overwrite**. Existing legacy invalid
anchors remain errors until approved repair. No shared-world repair was executed.
Before deploying source behavior to an existing world:

1. Obtain explicit approval and back up affected market records and seed metadata.
   Inventory, ledger, ownership-related records, ship listings, IDs, and user
   data must be preserved; do not rename `sol-moon-orbit`.
2. Verify all declared canonical station hosts exist with finite spatial snapshots
   in the correct system/frame. Decide which persisted host snapshot is authoritative;
   no celestial reseed is implied. The approved exact seed mappings are
   `ac-proxima-station`: `ac-proxima` -> `alpha-centauri-star-tertiary` (Proxima's
   canonical star), and `bs-main-station`: `bs-b1` -> `barnards-star-planet-1`
   (the explicitly approved generated Barnard planet). Both hosts are emitted by
   their registry-backed catalogs. Station IDs and authored orbit parameters are
   preserved. Legacy IDs are not aliases and persisted records are not auto-repaired.
3. Either selectively repair the affected station anchors (`sol-moon-orbit` to
   `sol-luna`, Proxima/Barnard as approved above) and materialize
   affected station spatial fields using this algorithm, or explicitly invoke the
   backend seed service with `force:true` for the approved system. Force now merges
   seed-owned trajectory/spatial into existing markets, preserving other stored
   fields; it can insert missing catalog markets and resets seeded element phases,
   so review all affected stations first. All host materialization completes before
   any upsert. Multi-record writes are not transactional: recover from backup/retry
   if persistence fails midway; the revision is recorded after market writes.
4. After a selective repair, update seed metadata to v2 only after verifying every
   affected station. Refresh relevant backend host/market caches in an approved
   deployment procedure, then verify list/location/route consistency and epochs.
   Do not expect a served YAML version to prove the running Node code was reloaded.

### Approved Proxima/Barnard seed follow-up (2026-10-04)

Retain market revision **`2026-10-station-snapshot-v2`**, celestial revision
`2026-10-canonical-star-orbit-v3`, and pre-release contract **4.0.0 / OpenAPI 3.1.0**.
The failed unresolved-host seed preflights every market before writing any market
or advancing seed metadata. An empty world with a failed seed therefore needs no
new revision: restart updated source, then retry the ordinary seed request. The
seed service re-reads persistence on each call; no failed result is memoized.
Even a current revision with zero persisted markets can seed normally.

Cold startup previously materialized Sol and Alpha Centauri bodies but omitted
Barnard's Star before market seeding. Startup now also awaits Barnard's procedural
celestial seeding before markets. Direct backend callers must likewise seed
celestial bodies before markets; strict station validation is not bypassed by
implicit host generation or an origin/parent fallback.

If legacy anchors are already persisted, ordinary retry does **not** repair them,
including records tagged v2. Back up and obtain explicit approval for selective
repair or reviewed `force:true` as above; preserve economy/user fields and verify
every host and host-epoch snapshot. No live repair, purge or restart was executed.

#### Follow-up validation evidence

Final combined command:

```powershell
node --test test/station-market-snapshot.test.js test/station-market-snapshot.mongo.integration.test.js test/solar-system-market-seed.test.js test/market-seeding-context.test.js test/market-operations-service.test.js test/market-list-message-handler.test.js test/market-list-by-location-message-handler.test.js test/market-list-by-location.mongo.integration.test.js test/solar-system-celestial-seed.test.js test/solar-system-get-message-handler.test.js test/solar-system-list-message-handler.test.js test/context-bootstrap-service.test.js test/hyg-star-catalog.test.js test/alpha-centauri-system.test.js test/procedural-system-generator.test.js test/celestial-canonical-parity.test.js test/celestial-operation-examples.test.js
node --test --test-name-pattern="startServer runs without MongoDB URI" test/server.test.js
```

Results: **105 passed / 0 failed / 0 skipped** combined; **1 passed / 0 failed**
cold-start test on an ephemeral loopback port with Mongo disabled. Mongo tests
used isolated memory-server databases. Coverage verifies exact hosts across all
implemented seeded market systems, cold Alpha/Barnard persistence, ordinary
same-context retry after failed/no-market preflight, current metadata with zero
markets, fresh get/list/location/route shapes, unchanged authored station elements,
shared host epochs, independent Kepler elliptical radius and strict legacy-anchor
failure without writes. At Proxima's large global coordinates the subtraction
assertion allows coordinate-scale floating-point ULPs; the independent relative
radius assertion remains within `1e-7` km.

Initial runs identified that numeric assertion tolerance and two system-list test
fixtures relying on missing host/orbit fallback. Fixtures now declare actual
host/orbit data and seed celestial bodies before count reads; production validation
was not relaxed. The focused rerun is green; no full `npm test` was needed.

OpenAPI validation remains **3.1.0 / 4.0.0**; handler lint and `git diff --check`
pass (existing lint/line-ending advisories only). Read-only semantic comparisons
match runtime and workspace for `/openapi.yaml`, `/openapi/market/openapi.yaml`,
and `/schemas/{spatial-state,market-list-response,market-list-by-location-response,solar-system-get-response}.schema.json`.
The intentional contract edits document the two approved station hosts only; no
schema/event/version change. Serving updated static YAML does not establish that
the running backend source has restarted. Runtime was available, so no GitHub
fallback was needed. Existing dirty approved work was retained.

### Prior station correction validation record (2026-10-04, before follow-up)

The prior focused command was:

```powershell
node --test test/station-market-snapshot.test.js test/station-market-snapshot.mongo.integration.test.js test/solar-system-market-seed.test.js test/market-seeding-context.test.js test/market-operations-service.test.js test/market-list-message-handler.test.js test/market-list-by-location-message-handler.test.js test/market-list-by-location.mongo.integration.test.js test/solar-system-celestial-seed.test.js test/celestial-operation-examples.test.js test/market-buy-sell-message-handler.test.js test/market-inventory-list-message-handler.test.js test/market-ledger-list-message-handler.test.js test/market-quote-message-handler.test.js
```

Result: **106 passed, 0 failed, 0 skipped**. Mongo tests used isolated
`mongodb-memory-server` instances, not the shared Mongo/world. Coverage includes
circular 1200/4200 km offsets, elliptical radius, unequal element/host epochs,
list/location/route equality, invalid anchors/epochs/hosts, persisted roundtrip,
fresh-service reads, no current-revision upserts, blocked old revisions, approved
force repair preserving a nonempty ledger/inventory/sold ship listing and Mongo
record identity, and failed-host preflight with no writes.
Nine market examples and nineteen related celestial/system/launch examples
validated against fully dereferenced schemas.

Additional exact commands:

```powershell
node scripts/lint-handler-patterns.js
node -e "require('@apidevtools/swagger-parser').validate('api/openapi.yaml').then(x=>console.log('OpenAPI validated:',x.openapi,x.info.version)).catch(e=>{console.error(e.message);process.exitCode=1})"
git --no-pager diff --check
```

Handler lint passed with its existing noncritical launch-item/market-utility
advisories; OpenAPI validated as 3.1.0 / info.version 4.0.0; whitespace check
passed (Git emitted line-ending advisories). No full `npm test` or artifact
generation was run.

Read-only HTTP checks found semantic matches between workspace and served
`/openapi.yaml`, `/openapi/market/openapi.yaml`, `/schemas/spatial-state.schema.json`,
and both affected market response schemas. These files are served directly from
disk and therefore do not prove process code reload. Public repository
`main/api/openapi.yaml` remains 3.1.3; its market module remains 3.1.1.
The affected operations' request/response shapes and examples match the public
module, but descriptions/version and spatial/trajectory semantics intentionally
differ. The stated GitHub root `main/openapi.yaml` returned 404; the actual
workspace root contract is `api/openapi.yaml`. No live socket request, Mongo read
or write, shared-world mutation, restart, or commit was performed.

Source diagnosis is high confidence: subtracting the legacy Moon fallback host
from the supplied observed market position gives relative offset
`(-1156.5025304853916, 396.5692937025912, 10.384532421643907)` km, radius
`1222.6500506034024` km, within the authored 1200 km / e=0.02 orbit's
1176-1224 km envelope. The supplied market/host snapshot epochs differ by
13,697,259 ms (3h 48m 17.259s). Running process provenance and persisted live
record state beyond the user's observations remain unverified; this is a
source fix, not a claim of live deployment or data repair.

## Physical provenance, units, and selection precedence

`physicalCatalog` and `physical` remain **separate objects**. No measurements
are merged, renamed, overwritten, or recomputed on read.
The previous solar-system-get asteroid viewer transformation is removed: it
discarded catalog mass/radius/composition fields, synthesized estimates, coerced
mission body types, and injected visualization defaults. Get and body-list now
preserve the same canonical values; consumer presentation fallbacks must not
replace source provenance.

- `physicalCatalog`: original curated catalog approximations; HYG stellar
  mass/radius are existing spectral-class estimates; procedural planet values
  are generated game data; mission asteroid fields are estimates.
- `physical`: gameplay/scan estimated mass and diameter. Existing catalog
  seeding projects finite catalog `massKg` and twice `meanRadiusKm` into these
  estimates, using zero if those particular source fields are unavailable.
  That existing projection is unchanged; zero must not be presented as a measured
  zero size/mass.
- Missing objects/scalars or null mean unavailable. A positive finite value is
  required for usable scalar size/mass selection.

**Scalar display radius, in km**, selects the first positive finite candidate:

1. `physicalCatalog.meanRadiusKm`
2. `physicalCatalog.equatorialRadiusKm`
3. `physicalCatalog.radiusKm`
4. `physicalCatalog.estimatedDiameterM / 2000`
5. `physical.estimatedDiameterM / 2000`
6. Otherwise unknown; no fabricated radius.

Mean radius wins because current curated bodies contain distinct mean and
equatorial values; it is the appropriate scalar summary, not a replacement for
equatorial geometry. Generic/estimated radii fall back for mission objects.

**Mass, in kg**, selects:

1. `physicalCatalog.massKg`
2. `physicalCatalog.estimatedMassKg`
3. `physical.estimatedMassKg`
4. Otherwise unknown.

This is explicit **consumer selection guidance**, not new backend measurement
calculation. A chosen estimate must remain labeled as estimated. Consumers
needing equatorial geometry should explicitly select equatorialRadiusKm instead
of interpreting the scalar display radius as an equatorial measurement.

All radius fields are **km**; diameter fields are **metres**; masses are **kg**.
`rotationPeriodSec` is seconds (existing source sign conventions retained),
`axialTiltDeg` degrees, `surfaceGravityMps2` m/s², `meanTemperatureK` kelvin.
Typed shared schemas define both physical objects and are referenced by request
and dependent read schemas.

## Validation evidence

Executable operation-example tests fully dereference both modules and validate
all requests/responses with AJV. Backend/schema parity tests exercise canonical
writes, classification pairs, composition conditionals, and all seed producers.
Mongo tests reconnect before reading through a fresh service/context so cache
contents cannot masquerade as persisted identity, orbital or stellar data.
