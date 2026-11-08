# Non-Sol universe: first expanded five-system assessment

Date: 2026-11-07

Status: **For owner review; assessment only.** No generation, contracts, runtime
activation, catalog refresh, database writes, or new numeric policy is implemented
by this document. P0/P1 remain accepted; expanded P2 remains unaccepted.

This review implements the owner's selected scope:

- Retain Alpha Centauri, Barnard's Star, Copper Vale and Cygnus X-1.
- Add a catalog system with known giants: **Toivonranta (HR 8799)**,
  `exo-hr-8799`. It demonstrates a giant-rich outer architecture and the need to
  assess debris structures, thermal interpretation, and orbital uncertainty.
- Assess all selected families before generation, propose count ranges for
  discussion, and keep blockers explicit.

The [main plan Section 12](./seed-non-Sol-systems-2026-11-07.md#12-reopened-p2-complete-celestial-family-assessment)
remains authoritative. This is a first qualitative assessment, not the completed
family occurrence calibration or approval of the proposed numbers.

## 1. Reading the assessment

**Existing** means current checked-in catalog/seed output, including its estimates,
candidates, and authored appearance choices. It does not mean every parameter
or depicted surface is observed.

**Proposed** means an optional hypothetical addition to assess, not a newly
discovered body, generated preview, persistent record, or verified orbit.

Matrix legend:

- **P**: priority for physical/occurrence assessment; may produce zero bodies.
- **C**: conditional possibility; required evidence/history/host conditions are
  unresolved. Not yet scientifically eligible for generation.
- **L**: low-priority or poorly matched to the sample architecture; default zero
  pending evidence, not a claim that the family is impossible.
- **B**: explicit contract, dynamics, classification or environment blocker.
- **E**: an existing catalog example; generated additions still need assessment.

Codes describe proposals independently of existing examples. `E/C` therefore
means preserve the example and consider extra bodies only conditionally.
All positive proposal codes remain subject to the named blockers in Sections 3-5.
No numeric scientific occurrence probability has been assigned in this review.

## 2. Existing contents: separate from additions

Inventory read directly from `buildSeededCelestialBodiesForSolarSystem` at J2000,
without database access or changing the accepted snapshot. Orbital distances
below are current game catalog values, not newly fitted orbital solutions.

| Review system | Canonical system ID | Existing stars/remnants | Existing planets | Existing moons / asteroids / comets / ring properties |
| --- | --- | --- | --- | --- |
| Alpha Centauri | `alpha-centauri` | A, B, Proxima: 3 stars | Proxima b, c, d: 3 | 0 / 0 / 0 / 0 |
| Barnard's Star | `barnards-star` | 1 star | Barnard b, c, d, e: 4 | 0 / 0 / 0 / 0 |
| Copper Vale (GJ 9066) | `exo-gj-9066` | 1 star | GJ 9066 c: 1 | 0 / 0 / 0 / 0 |
| Cygnus X-1 | `cygnus-x1` | 1 black hole + HD 226868: 1 star | 0 | 0 / 0 / 0 / 0 |
| Toivonranta (HR 8799) | `exo-hr-8799` | 1 star | HR 8799 b, c, d, e: 4 | 0 / 0 / 0 / 0 |

**Combined baseline across these five:** 7 stars, 1 black hole, 12 planets,
20 canonical celestial bodies. Current catalog ring properties are absent in
this sample. Published circumstellar debris evidence is not the same as an
existing generated ring property or individually cataloged minor body.

| Existing planet | Current game archetype | Current semimajor axis (AU) | Interpretation to preserve/review |
| --- | --- | --- | --- |
| Proxima b | `rocky` | 0.04856 | Source-supported small planet; radius/composition and habitability remain uncertain. |
| Proxima c | `ice-giant` | 1.489 | Curated candidate/strongly suspected object; appearance does not prove composition or confirmation. Do not promote its status. |
| Proxima d | `lava` | 0.02885 | Preserve curated status and visual choice; no claim of an observed global lava surface. |
| Barnard b / c / d / e | `rocky` | 0.0229 / 0.0274 / 0.0188 / 0.0381 | Four compact small planets; NASA pages describe terrestrial planets with estimated radii. |
| GJ 9066 c | `gas-giant` | 0.88 | Existing giant around an M star; estimated radius and eccentricity 0.46 matter for neighbors/moons. |
| HR 8799 b / c / d / e | All `hot-jupiter` in current game output | 68 / 38 / 24 / 16.4 | NASA describes giant planets on wide orbits. Flag classification/temperature semantics; do not call these close-in hot Jupiters simply because the current enum says so. |

No new HR 8799 b/c/d/e duplicates should be generated. No known gas giant is
missing merely because the restricted P2 addition code generated only rocky worlds.
The missing capability is diverse **additional** planets and family assessment.

### Source/representation issues found

1. **HR 8799 thermal/classification:** Current catalog planet temperature fields
   are approximately 1,150-1,300 K and feed the hot-archetype branch. For young,
   self-luminous, directly imaged giants, emitted/effective temperature and
   irradiation-equilibrium temperature are not interchangeable. Determine the
   source field meaning before any correction. Leave IDs, names, source values
   and existing archetypes unchanged in this assessment.
2. **HR 8799 dynamics:** Current independent elements include c eccentricity 0.5
   and d eccentricity 0.6. They are composite literature values, not necessarily
   one mutually consistent resonant orbit solution. An isolated eight-Hill
   spacing rule can reject a real giant architecture; that is a model limitation,
   not evidence that the observed planets are invalid.
3. **Barnard's stellar inputs:** Current procedural star estimates are roughly
   0.286 solar masses, 0.433 solar radii and 5,778 K, despite the fixture's M4Ve
   discovery note. These generic estimates need source reconciliation before
   using them as calibrated small-star physical truth. Preserve the accepted
   catalog during this review.
4. **Alpha Centauri architecture:** The three-star hierarchy and Proxima planet
   candidates must remain distinguishable from a complete measured binary phase
   model. Existing modeled positions are not proof of stable additional orbits.
5. **Cygnus X-1 geometry:** The black hole and companion are deliberately
   co-located authored snapshots with no canonical orbital elements. That is
   not a safe mining/station region or a measured orbital configuration.

These issues are explicit assessment blockers to address through reviewed
calibration/contract work, not permission to repair protected catalog data here.

## 3. Every selected family: five-system matrix

Columns: **AC** Alpha Centauri; **BS** Barnard's Star; **CV** Copper Vale;
**CX** Cygnus X-1; **HR** HR 8799.

### Planets

| Family | AC | BS | CV | CX | HR | Evidence/conditions and next assessment |
| --- | --- | --- | --- | --- | --- | --- |
| Rocky/terrestrial | E/C | E/P | P | B | C | Small-planet occurrence is supported around M dwarfs, but not guaranteed in a known system [S3]. Screen known neighbors, stellar facts, multiplicity and irradiation. |
| Gas giants / cold Jupiters | C | L | E/C | B | E/C | Known examples in CV/HR [S5,S6]. Giant occurrence depends on host mass/metallicity and survey domain [S4]; do not apply a solar-metallicity rate to unknown hosts. |
| Ice giants | E/C | C | P | B | C | AC's existing candidate has this game appearance, not measured ice composition. Separate Neptunian masses/radii from chemistry [S1,S2]; assess outer stable zones. |
| Super-Earths | E/C | C | P | B | C | Proxima b is publicly described as a super-Earth but appears rocky in the game [S7]. Class overlap is expected; do not count it twice or assume a rocky surface from mass. |
| Sub-Neptunes | C | C | P | B | C | Radius/mass scatter and volatile envelopes require probabilistic interpretation [S2,S3]. No confirmed additional examples in this five-system baseline. |
| Hot Neptunes | L | L | L | B | C | Short-period desert/survival constraints [S8]; frequency and atmospheric-loss models remain unresolved for these hosts. |
| Hot Jupiters | L | L | L | B | L | No close-in hot-Jupiter example in the five-system baseline. CV/HR wide giants do not qualify; assess rare occurrence/migration instead of forcing one into this sample. |
| Super-Jupiters | L | L | L | B | E/C | HR provides high-mass giant examples [S6]; formation and age-dependent masses matter near the brown-dwarf boundary [S2]. No new HR giant is initially recommended. |
| Lava planets | E/C | C | C | B | C | AC visual example exists. Need stellar irradiation plus surface/tidal/atmospheric modeling; hot temperature alone does not prove lava [S1,S10]. |
| Ocean/water-rich planets | C | C | C | B | C | Hypothetical only. Composition/envelope/atmosphere uncertainty [S1,S2,S10]; no confirmed ocean in this sample, and no habitability guarantee. |

**Counting rule:** rocky, super-Earth, Neptunian, hot, and ocean descriptions can
overlap. A body is allocated once to a physical model and gets one valid appearance
classification; it is not a separate count in every descriptive row.

### Minor bodies, satellites and structures

| Family | AC | BS | CV | CX | HR | Evidence/conditions and next assessment |
| --- | --- | --- | --- | --- | --- | --- |
| Dwarf candidates | C | C | C | B | P | Outer population and rounding/clearing model required [S11,S12]. No confirmed dwarfs in this baseline. |
| Outer/TNO analogues | C | C | P | B | P | Solar Kuiper Belt is an analogy, not an exosystem census [S11]. HR debris evidence strengthens assessment priority, not exact body count [S9]. |
| Rocky/icy moons | C | L | P | B | P | Giant hosts provide useful candidate space; radii/mass budgets and survival remain hypothetical [S10,S13]. Tight BS planets may have none. |
| Lava/tidally heated moons | C | L | C | B | C | Need eccentricity maintenance, tidal dissipation, age and heat model; no random lava texture or reliable frequency inferred here. |
| Captured irregular moons | C | L | C | B | C | Need capture-history and inclined/retrograde stability model. Current low-inclination v1 moon policy cannot represent this population adequately. |
| Submoons | L | L | C | B | C | Theoretical survival possible for selected large, widely orbiting moons [S13]; no confirmed submoons or adopted occurrence frequency. Tidal parameters are missing. |
| Sparse/scattered asteroids | C | P | P | B | P | Minimum mining coverage is an authored gameplay requirement, not observational occurrence. Report blocked if no credible region can be modeled. |
| Organized asteroid belts | C | C | C | B | P | No system-specific belt evidence adopted for AC/BS/CV; HR has reported warm/cold debris structures [S9]. Dust does not establish individual mineable asteroid sizes/materials. |
| Trojan/co-orbital populations | B | B | B | B | B | Solar Trojan evidence [S14] motivates assessment, not guaranteed exo-Trojans. Stable mass ratios, resonant phase/libration and multi-planet perturbations need a reviewed evaluator. |
| Comet nuclei / near reservoirs | C | C | C | B | P | Icy planetesimal populations are plausible proposals, not individually detected comets here [S9,S11]. Periapsis heating/encounters and replenishment need assessment. |
| Distant comet-cloud analogues | B | B | B | B | B | Solar Oort-cloud theory does not establish universal exo-clouds [S15]. Retention, Galactic tides/encounters and domain beyond 100 AU are unresolved. |
| Cold icy circumplanetary rings | C | L | C | B | C | No existing ring property in this five-system baseline. Separate host-irradiated particulate temperatures from giant intrinsic temperatures; Roche/retention/lifetime checks [S10]. |
| Rocky/dust circumplanetary rings | C | C | C | B | C | Different material/thermal/strength regimes need assessment. HR's circumstellar dust is not evidence that its planets have rings [S9,S10]. |

### Companions, unbound bodies and remnants

| Family | AC | BS | CV | CX | HR | Evidence/conditions and next assessment |
| --- | --- | --- | --- | --- | --- | --- |
| Rogue/unbound planets | B | B | B | B | B | Rogue planets exist as a population [S1], but no event/membership/orbit is established here. Existing elliptic elements are insufficient for free/hyperbolic motion. |
| Brown dwarfs / substellar companions | B | B | B | B | B | Separate science category and age/formation/mass classification required [S2]. Do not relabel known HR planets or fabricate companions from a mass threshold. |
| Additional uncatalogued stars | L/B | L/B | L/B | L/B | L/B | No additional companion evidence adopted in this review. Multiplicity does not justify random additions; source incompleteness and hierarchy/phase models must be assessed first. |
| White dwarfs | L/B | L/B | L/B | L/B | L/B | Stellar evolution establishes their existence, not a white dwarf in each sample system [S16]. No new companion proposed; explicit classification/appearance and history review needed. |
| Neutron stars | L/B | L/B | L/B | L/B | L/B | No neutron-star evidence adopted for these systems [S16]. CX's known black hole must not be duplicated or replaced by a neutron star. |
| Black-hole environments | L/B | L/B | L/B | E/B | L/B | Preserve CX and assess its actual geometry/radiation [S17]. No second black hole proposed; separate owner approval still mandatory. |

This matrix considers every selected family. It does **not** certify the P2-A
whole-universe occurrence matrix complete: capture, tidal heating, rings,
substellar companions and remnant populations still need specialist evidence
and conditional distributions before generation.

## 4. First proposed addition ranges: for discussion, not implementation

These are **authored review envelopes for addressable samples**, not scientific
confidence intervals, population totals, lower bounds, or independent random
draws. All optional families can produce zero. Numbers are not new approved caps.
The giant-host moon proposal is deliberately larger than restricted v1, while
avoiding a requirement to materialize thousands of real moonlets.

| System | Proposed additional planets, all subclasses combined | Proposed regular moons | Minor-body / structure review envelope | Main prerequisite |
| --- | --- | --- | --- | --- |
| AC | 0-6 across separately assessed A/B/Proxima zones, including 0-2 giants/Neptunian worlds within that total | 0-4 per **suitable** existing/new host; 0-12 sampled system total initially | 8-40 asteroid representatives, 0-12 comet nuclei, 0-8 outer minor bodies, 0-2 distinct belt descriptors | Binary/hierarchy model; no requirement to add giant planets around Proxima or planets around A/B. |
| BS | 0-4, primarily terrestrial/Neptunian; 0-1 giant only if independently justified, included in the same total | 0-1 per existing close-in planet; 0-8 around any separately justified outer giant | 8-30 asteroids, 0-10 comets, 0-6 outer minor bodies, 0-1 belt descriptor | Reconcile stellar inputs and compact known planet architecture. Giants may remain zero. |
| CV | 0-4 terrestrial/Neptunian; up to 1 additional giant included, not a separate guaranteed draw | 0-12 sampled regular moons around the existing giant; 0-4 per other suitable host | 12-50 asteroids, 0-15 comets, 0-12 outer minor bodies, 0-2 belt descriptors | Respect eccentric giant periapsis/Hill domain and unknown mutual inclinations; no assumed Solar-like layout. |
| CX | No numeric envelope proposed | None proposed | No numeric asteroid/comet/belt envelope proposed | Geometry, irradiation, survival and explicit safe gameplay exception first. Remains blocked, not falsely “complete.” |
| HR | 0-3 smaller interior/exterior planets; **0 new massive giants initially** | 0-12 sampled regular moons per existing giant, 0-48 system sample total | 20-80 asteroid representatives, 0-20 comets, 4-24 outer minor bodies **only if that reservoir is modeled**, 1-2 source-constrained debris population descriptors | Consistent orbital solution, disk evidence/domain and young-giant thermal model. Numeric minimums describe a chosen valid reservoir model, not mandatory additions when blocked. |

For all systems:

- Planet counts are additions. If a later approved model selects the top of a
  proposed envelope, AC could have 9 combined planets, BS 8, CV 5 and HR 7;
  these are arithmetic examples, not predicted populations. CX remains zero
  until its exceptional model is approved.
- Outer minor-body totals include any generated dwarf candidates; do not add
  dwarfs again as a separate budget. Suggested dwarf subset: 0-2 for AC/BS/CV
  and 0-4 for HR, subject to the same outer-model prerequisites.
- Circumplanetary rings: 0-1 descriptor per suitable host, icy or rocky/dust
  according to a reviewed physical model. Never convert a circumstellar belt
  into a host ring to avoid new representation work.
- Captured irregular moons: discuss 0-6 additional representatives per suitable
  giant host only after a capture/stability model. They are not included in the
  regular-moon sample envelope; a combined mass/count policy must be approved.
- Heated moons are a subset of modeled moons, not extra bodies. Submoons,
  Trojans, distant clouds and unbound objects get **no numeric allocation yet**:
  missing evidence/evaluator is not solved by assigning a small arbitrary number.
- No new stars, brown dwarfs, white dwarfs, neutron stars or black holes are
  proposed for these five. Assessment remains open, but source constraints and
  registry/category changes must precede any future proposal.

The old 0-2 rocky-addition cap and 16-moon system cap are not binding on this
assessment. Scientific architecture/occurrence work must precede selecting and
implementing new budgets. There is no performance-optimization decision here.

## 5. Required implementation/contract assessment

| Gap | Required next work | Existing behavior to preserve |
| --- | --- | --- |
| Missing giant/Neptunian/lava/ocean augmentation | Conditional planet-family physical models and shared mass-radius/thermal checks; use existing valid planet appearance pairs | Existing catalog bodies, source values, IDs, labels and class pairs |
| HR thermal semantics and composite orbits | Review source meaning/uncertainties and a consistent orbit/historical model before authorizing any corrections | No silent catalog reclassification or orbital rewrite |
| Binary/triple and CX geometry | Multiplicity-aware host selection, barycenters, relative frames, irradiation and stability limits; distinct remnant hazard review | Curated identities and explicitly approximate authored snapshots |
| Outer minor bodies / disks | `tno` bodies and typed population extent/composition/provenance; decide if existing descriptors adequately describe a circumstellar debris disk | Rings stay host properties; belts are not celestial body types |
| Irregular/heated moons and submoons | Inclined/retrograde/capture distributions, tidal models, age and nested-anchor tests | Legacy elliptic catalog trajectories; no false survival proof |
| Trojan/co-orbital dynamics | Resonant/libration representation and evaluator assessment; exact parent/primary references | Do not encode a Trojan as an independent ordinary ellipse and claim dynamics support |
| Long-period/cloud and rogue objects | Domain/precision/retention assessment; free/hyperbolic trajectories and membership when needed | Do not silently expand frozen registry scope or clamp unbound objects into elliptic orbits |
| Brown dwarfs and stellar remnants | Scientific classification/appearance design, provenance and contract amendments with owner selection | Never use an existing star/black-hole enum as a misleading fallback |
| Occurrence/count reporting | Report existing, proposed/generated, and combined counts plus physical subclasses and explicit evidence/contract blockers | P0 progress stays pending until actual rollout stages; no preview counts as live contents |

P0/P1 are not restarted. Additive amendments arising from this assessment are
new scoped work that must pass their own parity/persistence/consumer validation.
P3 resource/station coverage cannot be certified by these assessment tables.

## 6. Sources used and limits of inference

Public sources were checked during this review. Live web summaries can differ
from the checked-in 2026-11-01 snapshot and combine estimates inconsistently.
They inform assessment, not an automatic source refresh.

| ID | Source | What it supports / does not support |
| --- | --- | --- |
| S1 | [NASA planet-type overview](https://science.nasa.gov/exoplanets/planet-types/) | Existence/diversity of terrestrial, super-Earth, Neptunian, giant and rogue families; not calibrated probabilities in each sample system. |
| S2 | [Chen & Kipping, 2017, probabilistic mass-radius forecasting](https://arxiv.org/abs/1603.08614), DOI [10.3847/1538-4357/834/1/17](https://doi.org/10.3847/1538-4357/834/1/17); [Weiss & Marcy, 2014](https://arxiv.org/abs/1312.0936) | Physical-regime/scatter evidence. Chen/Kipping sample: 316 well-constrained objects; Weiss/Marcy: 65 planets <4 Earth radii, periods <100 d. Neither supplies universal per-system counts or unique compositions from radius. |
| S3 | [Dressing & Charbonneau, 2015, Kepler M-dwarf occurrence](https://arxiv.org/abs/1501.01623) | Injection/recovery and false-positive-adjusted small-planet occurrence in a defined M-dwarf sample. Approximately 2.5 +/-0.2 planets of 1-4 Earth radii and periods <200 d **per surveyed M dwarf**, not “add 2.5 planets” to a known system. Does not cover sub-Earth BS planets or distant giant counts directly. |
| S4 | [Johnson et al., 2010, stellar mass/metallicity and giant occurrence](https://arxiv.org/abs/1005.3084), DOI [10.1086/655775](https://doi.org/10.1086/655775) | 1,194 survey stars, roughly 0.2-1.9 solar masses; host-property dependence in that survey. No unconditional rate for Proxima/CV (~0.12/~0.15 solar masses), unknown metallicities, or HR's wide imaged planets. |
| S5 | [NASA GJ 9066 c](https://science.nasa.gov/exoplanet-catalog/gj-9066-c/) | Known M-star giant, RV discovery, 0.21 Jupiter masses, 0.88 AU, e=0.46 and estimated radius. Does not prove moons, rings, belts or an additional giant. |
| S6 | [NASA HR 8799 b](https://science.nasa.gov/exoplanet-catalog/hr-8799-b/) and [e](https://science.nasa.gov/exoplanet-catalog/hr-8799-e/) | Known imaged giants at 68 and 16.4 AU; reported masses/ages/orbits are model dependent. Supports selecting this fifth system, not random extra giants. Original discovery records: [Marois et al. 2008](https://ui.adsabs.harvard.edu/abs/2008Sci...322.1348M/abstract) and [2010](https://ui.adsabs.harvard.edu/abs/2010Natur.468.1080M/abstract), retained in the backend reference register. |
| S7 | NASA [Proxima b](https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/), Barnard [b](https://science.nasa.gov/exoplanet-catalog/barnard-b/), [c](https://science.nasa.gov/exoplanet-catalog/barnard-c/), [d](https://science.nasa.gov/exoplanet-catalog/barnard-d/), [e](https://science.nasa.gov/exoplanet-catalog/barnard-e/) | Observed small-planet anchors and estimated radii; not proof of oceans, lava or complete planet censuses. Proxima c/d status comes from the preserved curated catalog, not an assertion that this source confirms them. |
| S8 | [Mazeh, Holczer & Faigler, 2016, short-period Neptune desert](https://arxiv.org/abs/1602.07843), DOI [10.1051/0004-6361/201528065](https://doi.org/10.1051/0004-6361/201528065) | Suppression/structure in period-mass/radius space, initially near 2-4 d and possibly extending farther. A conditional population issue, not a blanket ban on hot Neptunes or a host-specific rate. |
| S9 | [HR 8799 secondary summary, debris-disk section](https://en.wikipedia.org/wiki/HR_8799#Debris_disk) | Reported warm/cold dust components and halo, citing Spitzer/ALMA work. First-review context only; primary disk geometry/uncertainties must be retrieved before adopting belt boundaries or body-count distributions. Circumstellar disk != planetary rings. |
| S10 | [Hill sphere](https://en.wikipedia.org/wiki/Hill_sphere), [Roche limit](https://en.wikipedia.org/wiki/Roche_limit), [equilibrium temperature](https://en.wikipedia.org/wiki/Planetary_equilibrium_temperature), [Holman & Wiegert 1999](https://arxiv.org/abs/astro-ph/9809315) | Approximate screening/binary-fit limitations. No long-term N-body, capture/tidal, atmosphere or habitability certification. The binary fits cover finite mass-ratio/eccentricity ranges and 10,000 binary periods, not arbitrary triples/remnants. |
| S11 | [NASA Kuiper Belt](https://science.nasa.gov/solar-system/kuiper-belt/) | Solar icy minor-body analogy; no direct frequency or exact population inference for these five systems. |
| S12 | [Margot 2015, quantitative planet criterion](https://arxiv.org/abs/1507.06300) | A clearing proxy, with stellar-lifetime/circular-orbit assumptions. Not measured rounding or an official dwarf classification for hypothetical bodies. |
| S13 | [Kollmeier & Raymond 2019, Can Moons Have Moons?](https://arxiv.org/abs/1810.03304), DOI [10.1093/mnrasl/sly219](https://doi.org/10.1093/mnrasl/sly219) | Theoretical submoon survival in selected large/wide-moon configurations, sensitive to tides; does not establish detected submoons or a frequency. Regular/irregular exomoon counts remain uncalibrated here. |
| S14 | [NASA Lucy science](https://science.nasa.gov/mission/lucy/science/) | Solar Jupiter Trojans, varied surfaces and formation-history relevance. Not evidence for exo-Trojans at every giant or automatic evaluator support. |
| S15 | [NASA Oort Cloud](https://science.nasa.gov/solar-system/oort-cloud/) | Solar distant-reservoir hypothesis/context; does not establish exo-cloud retention, total sizes or universal occurrence. |
| S16 | [NASA star types/evolution](https://science.nasa.gov/universe/stars/types/) | White-dwarf/neutron-star existence and evolution, including surviving debris possibilities. Not evidence for new remnants or companions in these sample systems. |
| S17 | Curated Cygnus sources: [Miller-Jones et al. 2021](https://doi.org/10.1126/science.abb3363), [Orosz et al. 2011](https://doi.org/10.1088/0004-637X/742/2/84) | Source-backed binary/remnant estimates retained in the [contract](./celestial-body-contract.md#cygnus-x-1-curated-bodies). No measured safe gameplay location or new companion proposal. |

Use the [archive occurrence-rate bibliography](https://exoplanetarchive.ipac.caltech.edu/docs/occurrence_rate_papers.html)
to select further appropriate surveys; cite the actual adopted paper, not the
bibliography as a fitted occurrence law. Captured moons, ring material/lifetimes,
tidal heating, Oort retention, rogue membership and companion occurrence remain
explicit specialist-evidence gaps. The review ranges are authored proposals until
that calibration and owner selection occur.

Backend evidence:

- [Celestial catalog resolution](../src/model/solar-system-celestial-seed.js):
  exact five-system inventory and preserved precedence.
- [Curated Alpha Centauri](../src/model/alpha-centauri-system-catalog.js):
  triple hierarchy, candidate notes and existing appearances.
- [Exoplanet generator](../src/model/exoplanet-system-generator.js):
  mass/radius/temperature appearance mapping and approximate-field handling.
- [Current restricted offline policy](../data/non-sol-scientific-policy-v1.json)
  and [preview module](../src/model/non-sol-augmentation.js): historical limits,
  not the reviewed expanded budgets.
- [Dataset credits/license](../data/LICENSE-exoplanet-catalog.md) and
  [Nova attribution prompt](./seed-non-Sol-systems-2026-11-07-Nova-prompt.md):
  preserve required credits and add only sources actually used.

## 7. Owner review: what to validate now

No test commands or Nova gameplay validation are required for this document-only
assessment. Existing tests do not prove the expanded families are implemented.
Review these decisions:

1. **Sample:** HR 8799 is the fifth system, not Sirius. Sirius's known companion
   blocker remains in the historical policy; it is not removed by this sample choice.
2. **Breadth:** Every selected family appears in the matrix. Priority/conditional
   entries are hypothetical possibilities, not scientifically certified additions.
3. **Scale:** Review the proposed addressable-body envelopes, especially
   giant-host moons and small-body samples. Do not equate them with total physical
   populations. These ranges are not ready to become generation limits.
4. **Interpretation:** Confirm existing/new/combined counts are separate and HR's
   wide giants are not presented as verified close-in hot Jupiters.
5. **Blockers:** Accept that binary/remnant/thermal/source problems and unsupported
   trajectories are visible. No new remnant, companion or rogue is inserted to
   demonstrate a selected category.
6. **Next slice:** Choose the physical/occurrence calibration priorities and revise
   proposal ranges before implementing any new family. Contract/trajectory design
   questions get a separate selectable checkpoint.

**Pause:** This review authorizes nothing to generate or deploy. After owner
feedback, update P2-A/B/C assessment/calibration decisions; do not skip to P3.

## 8. Subsequent owner-authorized expanded offline preview

The owner subsequently selected expanded supported-family implementation,
approved Section 4 as provisional offline sampling envelopes after calibration,
and selected preserved contents plus explicit blockers for unsupported systems.
That supersedes the assessment-only stop above **for this supported offline
slice**, not for rollout, source corrections or completed global occurrence work.

The opt-in [v2 pilot policy](../data/non-sol-scientific-policy-v2.json) and
[expanded generator](../src/model/non-sol-expanded-augmentation.js) retain v1 and
its historical reports unchanged. V2 currently generates only Copper Vale;
the other four have the explicit blockers below. This is physical/qualitative
evidence calibration, not a fitted occurrence simulation: source-domain
limitations and authored sampling remain explicit as `occurrenceCalibrated: false`.

Physical calibration reuses the backend's mean Chen/Kipping mass-radius
approximation, existing classification, spherical mass/density, Kepler periods,
Hill/Roche bounds, temperature and mutual spacing screens. The +/-15% radius
scatter, log-uniform mass/orbit candidates, uniform sample counts, 25% optional
ring proposal trial and satellite mass ceiling are authored choices, **not**
the full Forecaster posterior, measured family probabilities or lifetime models.
No additional family is inserted merely to demonstrate variety.

New supplementary evidence: [Montet et al. 2014, TRENDS IV](https://arxiv.org/abs/1307.5849),
DOI [10.1088/0004-637X/781/1/28](https://doi.org/10.1088/0004-637X/781/1/28).
The 111-M-dwarf survey estimates 6.5% +/-3.0% hosting one or more 1-13 Jupiter-mass
companions within 20 AU. This is **not** a probability of adding another giant to
Copper Vale, whose known ~0.21-Jupiter-mass planet is outside that mass interval.
V2 limits any proposed additional massive/gas giant to 20 AU and at most one,
but does not apply that survey fraction as an independent generation roll.
Masses, metallicity, architecture and survey selection still require global
conditional occurrence calibration.

### Actual five-system counts at J2000

These are deterministic offline representatives, not live game contents.

| System | Existing bodies | Added planets | Added moons | Added asteroids | Added outer/TNO analogues | Added comets | Combined bodies | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Alpha Centauri | 6 | 0 | 0 | 0 | 0 | 0 | 6 | Blocked: triple hierarchy/irradiation |
| Barnard's Star | 5 | 0 | 0 | 0 | 0 | 0 | 5 | Blocked: reconcile estimated stellar inputs |
| Copper Vale | 2 | 4 | 16 | 26 | 7 | 2 | 57 | Analytically screened offline slice |
| Cygnus X-1 | 2 | 0 | 0 | 0 | 0 | 0 | 2 | Blocked: remnant geometry/radiation |
| Toivonranta / HR 8799 | 5 | 0 | 0 | 0 | 0 | 0 | 5 | Blocked: correlated orbits/thermal semantics |
| **Total** | **20** | **4** | **16** | **26** | **7** | **2** | **75** | **1 screened; 4 blocked** |

| Canonical type | Existing | Generated additions | Combined |
| --- | --- | --- | --- |
| Star | 7 | 0 | 7 |
| Black hole | 1 | 0 | 1 |
| Planet | 12 | 4 | 16 |
| Dwarf planet | 0 | 0 | 0 |
| Moon | 0 | 16 | 16 |
| Asteroid | 0 | 26 | 26 |
| TNO / outer minor-body analogue | 0 | 7 | 7 |
| Comet | 0 | 2 | 2 |

Added planet appearances: **2 rocky, 1 super-Earth, 1 sub-Neptune**.
Added moons: **8 rocky, 8 icy**. No newly generated gas/ice giant was selected
in this deterministic pilot, although those cold physical regimes are supported
and tested; the existing giant remains preserved and hosts a richer moon sample.
The existing giant hosts **9** of the 16 added moons; the remaining **7** orbit
new suitable hosts, with at most four sampled moons per non-giant host.
Zero dwarfs is an allowed sample outcome. V2 does not force unsupported hot,
ocean/lava, capture/submoon, rogue/companion or remnant families into the result.

Separate structures, **not extra celestial bodies**: **1 hypothetical cold icy
ring proposal and 2 reservoir population descriptors** (scattered asteroids,
comets). The ring proposal does not mutate the existing host. TNO analogues do
not masquerade as asteroid population members: that would violate P1's current
population-kind/body-type relationship.

Combined raw planet appearance counts: 7 rocky, 1 lava, 1 gas giant, 1 ice giant,
1 super-Earth, 1 sub-Neptune, 4 `hot-jupiter`; all other planet appearances zero.
The last four are **preserved HR 8799 game labels**, not a scientific assertion
that its wide giants are close-in hot Jupiters. Candidate/estimated existing
Proxima classifications remain unchanged.

### Reproduce and validate this checkpoint

From the backend repository:

```powershell
npm run seed:non-sol:preview -- --expanded
node --test test\non-sol-augmentation.test.js test\non-sol-expanded-augmentation.test.js test\non-sol-celestial-manifest.test.js test\celestial-universe-metadata.test.js
npm run typecheck
npm run seed:non-sol:preservation
npm run seed:non-sol:progress
```

Expected preview: 5 targets, 1 screened / 4 blocked, 55 additions, 75 combined
bodies, the counts above, no runtime activation/database writes/mining/station
verification. The 4,844-body rollout target stages remain pending. `--expanded
--all` is rejected: the expanded policy is authorized only for these five pilots.
Omitting `--expanded` retains the historical v1 four-system preview.

Owner validation now:

1. Confirm the four named blockers are acceptable; zero additions there means
   blocked, not a scientifically empty system.
2. Check Copper Vale's actual type/subclass counts and larger giant moon sample
   against the approved envelopes; optional absent families need not be forced.
3. Confirm ring/reservoir structures are counted separately and existing
   catalog appearances/candidate statuses remain intact.
4. Accept this supported offline slice or request changes. It does not complete
   full-family calibration, approve P2 as a whole, or activate P3/rollout.

### Automated validation evidence

- Combined four-suite `node --test` command above: **38 passed, 0 failed**.
  Tests include physical-family coverage, exact counts, mass/spacing/temperature
  screens, schemas, nested host snapshots, epoch-stable identity, tamper rejection,
  serialized report replay, argument guards, and v1/P0 preservation.
- `npm run typecheck`: **passed**.
- `npx --no-install eslint src\model\non-sol-augmentation.js src\model\non-sol-expanded-augmentation.js scripts\non-sol-celestial-preview.js test\non-sol-expanded-augmentation.test.js`: **passed**.
- `npm run seed:non-sol:preservation`: **passed**, all 4,844 accepted target
  identities/catalog outputs, markets and Sol preserved.
- `npm run seed:non-sol:progress`: **passed**, all 4,844 rollout targets pending.
- Published report readback/replay and exclusive identical rerun: **passed**.
  Report digest:
  `67fa0e7f29cbb545eada7a22ab2ee41670bf0ceccb178928ba0298442de76b8d`.
- Historical restricted report compared exactly to preserved owner v2 evidence:
  **unchanged**, digest
  `271fb97ecfafd29f0df058a25774b556ecb2468510ea22b789b2fa0292929836`.
- Local documentation links and `git diff --check`: **passed**.

No database is used for these checks. No commit/push, runtime activation or
catalog correction was performed. Prettier remains deferred while the expanded
major P2 phase is incomplete.
