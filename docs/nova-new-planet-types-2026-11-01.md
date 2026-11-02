# Nova prompt: new planet types, rings, and approximate values

Status: Draft. Hand off to Nova with EX-5.4b, when the contract change ships.
Date: 2026-11-01
From repo: solid-train (Forge)
To repo: laughing-octo-journey (Nova)
Related:
[exoplanet-catalog-import-plan-2026-11-01.md](./exoplanet-catalog-import-plan-2026-11-01.md#phase-4--catalog-constrained-procedural-model)
(D38–D43, EX-5.4b),
[nova-sol-catalog-attribution-prompt.md](./nova-sol-catalog-attribution-prompt.md)

## Purpose

Forge is importing the NASA Exoplanet Archive: 6,451 confirmed planets in
4,841 systems. Earth-like and Jupiter-like labels do not describe most of
these worlds, so Forge adds **five planet types** to the existing five. It
also adds optional **rings** and a list of **approximate fields** to each
planet.

This is a **breaking contract change** (D38). There is no fallback field. A
Nova build that does not know the new `surfaceArchetype` values will receive
values it cannot render. Nova must ship this work before, or together with,
the Forge release that seeds exoplanet systems.

## Contract facts for Nova

These shapes come from the Phase 4 generator
([exoplanet-system-generator.js](../src/model/exoplanet-system-generator.js)).
They become part of the public contract in EX-5.4b. Check the field names
against Forge's OpenAPI and `docs/contracts` once that change merges.

- **`surfaceArchetype` gains five values:** `super-earth`, `sub-neptune`,
  `hot-neptune`, `hot-jupiter`, and `super-jupiter`. The existing values
  (`rocky`, `lava`, `ocean`, `gas-giant`, `ice-giant`) are unchanged.
  - `planetType` always equals `surfaceArchetype` for catalog planets.
  - Purely procedural systems still use only the original five.
- **`visualization`** stays `{ colorHex, textureKey }`.
  - `textureKey` is `planet-<archetype>`, for example `planet-hot-jupiter`.
  - `colorHex` is a base tint per type (see the table below).
- **`rings`** is a new optional top-level object on planets:

  ```json
  {
    "innerRadiusKm": 98123.4,
    "outerRadiusKm": 196000.1,
    "tiltDeg": 12.3,
    "colorHex": "#d8c8a8",
    "opacity": 0.62,
    "approximate": true
  }
  ```

  - The field is absent when a planet has no rings.
  - Radii are measured from the planet's centre.
  - `tiltDeg` equals the planet's `physical.axialTiltDeg`, so rings lie in the
    equatorial plane.
  - Every exoplanet ring is procedural, so `approximate` is always `true`.
  - Sol's giants have no rings yet; sourced rings are deferred follow-up F2.
    F2 may later add an optional `bands` array, so Nova should tolerate
    unknown ring fields.

- **`approximateFields`** is a new sorted array of dotted field paths. Each
  path names a value that Forge estimated or seeded instead of taking it from
  the catalog, for example `physical.massKg` or
  `orbit.longitudeOfAscendingNodeDeg`.
  - `surfaceArchetype` appears in the list when the type itself was inferred
    from estimated radius or temperature.
  - `rings` appears whenever rings are present.
  - Every other value is the catalog value, passed through unchanged.
- **`circumbinary: true`** and **`circumbinaryStarIds`** mark planets that
  orbit a pair of stars.
  - `parentBodyId` is one star of the pair, usually the primary.
  - The orbit is drawn around that star but is approximate.
- **`parentBodyId` can be a companion star**, not only the primary. For
  example, 55 Cnc B has its own planets. Do not assume heliocentric orbits
  around the system's first star.
- **Catalog planets never have moons.**
- Catalog text (`displayName`, `catalogName`, `discovery.*`) is **plain
  text**. Render it as text; never insert it as HTML.

## Planet types at a glance

Rules use the archive radius (R⊕), mass (M⊕) and equilibrium temperature
(Teq). "Hot" means Teq ≥ 1,000 K. Counts are from the 2026-11-01 snapshot.

| Type                | New | Rule (summary)                                                   | Planets | Typical radius (R⊕) | Typical Teq (K) | Base colour | Can have rings |
| ------------------- | :-: | ---------------------------------------------------------------- | ------: | ------------------: | --------------: | ----------- | :------------: |
| `rocky`             |     | R < 1.25, not hot                                                |     344 |                1.09 |             669 | `#9b7b5a`   |       No       |
| `lava`              |     | R < 2, hot                                                       |     683 |                1.38 |           1,260 | `#c84a2c`   |       No       |
| **`super-earth`**   | Yes | 1.25 ≤ R < 2, not hot; or a dense 2–4 R⊕ world outside 200–350 K |     894 |                1.69 |             676 | `#8c6f55`   |       No       |
| `ocean`             |     | Dense (≥ 3.5 g/cm³) 2–4 R⊕ world at 200–350 K                    |       6 |                2.37 |             329 | `#3a7ad6`   |       No       |
| **`sub-neptune`**   | Yes | 2 ≤ R < 4, not hot, low density                                  |   1,637 |                2.64 |             616 | `#8fb8c9`   |   Yes (20%)    |
| **`hot-neptune`**   | Yes | 2 ≤ R < 6, hot                                                   |     420 |                2.75 |           1,163 | `#c9a27f`   |       No       |
| `ice-giant`         |     | 4 ≤ R < 6, not hot                                               |     254 |                4.66 |             598 | `#7fbedc`   |   Yes (20%)    |
| `gas-giant`         |     | R ≥ 6, not hot                                                   |   1,300 |               12.80 |             319 | `#d2a679`   |   Yes (30%)    |
| **`hot-jupiter`**   | Yes | R ≥ 6, hot                                                       |     757 |               13.67 |           1,479 | `#b5523b`   |       No       |
| **`super-jupiter`** | Yes | M > 13 Jupiter masses (4,132 M⊕), checked first                  |     156 |               12.10 |             250 | `#a8785a`   |   Yes (30%)    |

Typical values are medians. Rings never appear on a planet with Teq ≥
1,000 K. In this snapshot 831 planets have rings: 426 gas giants, 325
sub-Neptunes, 51 ice giants and 29 super-Jupiters.

## The five new types

### `super-earth`: big rocky worlds

- **What it is.** A rocky planet larger than Earth but smaller than about
  twice Earth's radius. Nothing like it exists in Sol, yet it is one of the
  most common planet sizes in the galaxy.
- **Forge's rule.** Radius 1.25–2 R⊕ and Teq below 1,000 K. A 2–4 R⊕ planet is
  also a super-earth when it is dense (≥ 3.5 g/cm³) but outside the 200–350 K
  temperate band.
- **Typical numbers.** Median 1.69 R⊕, 3.6 M⊕, 676 K. About half are close
  enough (under 0.1 AU) to be tidally locked.
- **Examples.** Kepler-452 b, LHS 1140 b, Kepler-138 d.
- **Rendering.** Rocky and cratered like `rocky`, but heavier: thicker crust
  relief, darker basalt plains, and optionally a thin haze. For the many
  tidally locked worlds, a hot day side and a dark, frosted night side add
  character. No rings.

### `sub-neptune`: gas-wrapped mini-Neptunes

- **What it is.** The most common type in the catalog (25%). A rocky or icy
  core under a thick hydrogen–helium envelope, smaller than Neptune. Nothing
  like it exists in Sol.
- **Forge's rule.** Radius 2–4 R⊕, Teq below 1,000 K, and low density (below
  3.5 g/cm³, or unknown).
- **Typical numbers.** Median 2.64 R⊕, 7.4 M⊕, 616 K.
- **Examples.** GJ 1214 b, TOI-270 d.
- **Rendering.** A smooth, hazy atmosphere with soft, low-contrast banding in
  pale blue-grey to teal. There is no visible surface. It should read as a
  small Neptune, not a big Earth. About 20% of cool ones have faint rings.

### `hot-neptune`: scorched Neptune-sized worlds

- **What it is.** A Neptune-sized or smaller gas world so close to its star
  that its atmosphere is baking and often escaping. Hot Neptunes are rare in
  nature (the "Neptune desert"), which makes each one notable.
- **Forge's rule.** Radius 2–6 R⊕ and Teq ≥ 1,000 K.
- **Typical numbers.** Median 2.75 R⊕, 8.5 M⊕, 1,163 K. Nearly all are tidally
  locked.
- **Examples.** LTT 9779 b, TOI-849 b.
- **Rendering.** A tan-to-copper atmosphere with a bright, glowing day side.
  Optionally show a faint comet-like tail of escaping gas pointing away from
  the star. Never ringed.

### `hot-jupiter`: giants skimming their stars

- **What it is.** A Jupiter-sized gas giant orbiting extremely close to its
  star, usually in a few days. 51 Peg b, the first planet found around a
  Sun-like star, is one.
- **Forge's rule.** Radius ≥ 6 R⊕ and Teq ≥ 1,000 K, with mass below the
  super-Jupiter limit.
- **Typical numbers.** Median 13.7 R⊕ (often inflated beyond Jupiter's
  11.2), 291 M⊕, 1,479 K. 91% are tidally locked.
- **Examples.** 51 Peg b, HD 209458 b, HD 189733 b, WASP-12 b, WASP-121 b,
  KELT-9 b (over 4,000 K).
- **Rendering.** Dark red-brown to charcoal banding, with a glowing day side
  and a strong day–night contrast. The hottest can glow orange on their own.
  Never ringed.
- **Caveat.** A few young, self-luminous giants imaged far from their stars,
  such as HR 8799 b at 68 AU, have a catalog temperature of 1,000 K or more
  from their own internal heat, so they are classed here too. Do not assume
  every `hot-jupiter` is close to its star; use its orbit.

### `super-jupiter`: giant planets near the brown-dwarf limit

- **What it is.** An object more than 13 times Jupiter's mass, the point at
  which deuterium fusion can begin. These sit on the boundary between giant
  planets and brown dwarfs, and many were found by direct imaging. (The
  Phase 4 form called this type `brown-dwarf-companion`; the contract value
  is `super-jupiter`.)
- **Forge's rule.** Mass above 13 Jupiter masses. This check runs first, so
  it applies regardless of radius or temperature.
- **Typical numbers.** Median 12.1 R⊕ (about Jupiter's size, despite 20× the
  mass), 6,200 M⊕ (about 19.5 Jupiter masses). Teq ranges from 13 K to
  2,500 K.
- **Examples.** HD 202206 b, HIP 54515 b, TOI-5422 b, HIP 99770 b.
- **Rendering.** A dense, muted giant with faint, compressed banding in
  brown-magenta tones. Young or hot ones can show a dull red self-glow. 30% of
  those below 1,000 K have rings.

## How the existing types change

The original five values keep their names but are now also driven by catalog
facts:

- **`lava`** now covers every hot planet below 2 R⊕ (683 planets), including
  hot super-earths such as 55 Cnc e, CoRoT-7 b and Kepler-10 b.
- **`ocean`** is rare: only 6 planets, such as K2-18 b and Kepler-22 b. Forge
  requires both a high density and a temperate 200–350 K, so these deserve a
  distinctive look.
- **`rocky`**, **`ice-giant`** and **`gas-giant`** now cover Earth-sized
  worlds, cool 4–6 R⊕ worlds and cool giants. Many are much hotter than
  their Sol counterparts, so do not tint them by Sol assumptions. Use
  `physical.meanTemperatureK`.

## Rings

- Draw a flat annulus from `innerRadiusKm` to `outerRadiusKm`, tilted by
  `tiltDeg` in the planet's equatorial plane, coloured `colorHex` at
  `opacity`.
- Ring radii are 1.2–1.6× the planet radius (inner) and up to about 4× the
  planet radius (outer). Render at the same scale as the planet.
- Because every exoplanet ring is approximate, the planet info panel should
  say so (see below).

## Showing approximate values

Forge never alters a known catalog value. Everything it had to estimate is
listed in `approximateFields`, and Nova decides how to present it at runtime
(D40).

- **Always approximate on catalog planets:** longitude of ascending node,
  rotation period, axial tilt, composition tags and atmosphere. These are
  never measured for exoplanets.
- **Often approximate:**

  | Field                                     | Planets |
  | ----------------------------------------- | ------: |
  | `orbit.argumentOfPeriapsisDeg`            |   4,334 |
  | `physical.surfaceGravityMps2`             |   4,015 |
  | `physical.massKg`                         |   3,974 |
  | `orbit.inclinationDeg`                    |   1,600 |
  | `orbit.eccentricity`                      |   1,068 |
  | `orbit.meanAnomalyAtEpochDeg`             |     582 |
  | `surfaceArchetype` / `planetType`         |     579 |
  | `physical.meanTemperatureK`               |     540 |
  | `orbit` and `parentBodyId` (circumbinary) |      53 |
  | `physical.meanRadiusKm`                   |      50 |
  | `orbit.semiMajorAxisKm` / period          |       7 |

  Most approximate masses are minimum masses (M·sin i) from radial-velocity
  surveys.

- **Suggested display:** mark approximate values with a "≈" prefix or a
  subtle "estimated" badge, and add a tooltip such as "Estimated: not
  measured in the NASA Exoplanet Archive." When `surfaceArchetype` is in
  the list, label the type "likely".

## Prompt for Nova

> Forge is adding five planet types for the NASA Exoplanet Archive import:
> `super-earth`, `sub-neptune`, `hot-neptune`, `hot-jupiter` and
> `super-jupiter`. They join the existing `rocky`, `lava`, `ocean`,
> `gas-giant` and `ice-giant` in `surfaceArchetype` (and `planetType`). This
> is a breaking contract change with no fallback field. Please:
>
> 1. Add renderers or material presets for each new type, keyed by
>    `visualization.textureKey` (`planet-<archetype>`) and tinted by
>    `visualization.colorHex`. Follow the descriptions in
>    `docs/nova-new-planet-types-2026-11-01.md`.
> 2. Treat an unknown `surfaceArchetype` defensively: render a neutral
>    placeholder sphere and log a warning, instead of failing the system view.
> 3. Render the new optional `rings` object (`innerRadiusKm`,
>    `outerRadiusKm`, `tiltDeg`, `colorHex`, `opacity`, `approximate`) as a
>    tilted annulus. Ignore unknown ring fields.
> 4. Read `approximateFields` and mark the listed values as estimated in the
>    planet info panel. Label the planet type "likely" when
>    `surfaceArchetype` is listed.
> 5. Show a "circumbinary" note when `circumbinary` is true, naming the stars
>    in `circumbinaryStarIds`.
> 6. Resolve orbits through `parentBodyId`. Planets can orbit a companion
>    star, not only the primary, and companion separations can reach about
>    500,000 AU (GJ 900). Keep camera framing and orbit-line scaling robust
>    at those distances.
> 7. Expect no moons on catalog planets, and render all catalog text as
>    plain text.
> 8. Add tests that each of the ten archetypes renders, that rings render
>    and are omitted when absent, and that approximate markers appear only
>    for listed paths.

## Acceptance criteria

- Every one of the ten `surfaceArchetype` values has a distinct look. The
  five new types are visually distinguishable from `rocky` and `gas-giant`
  at system-view zoom.
- An unknown archetype degrades to a placeholder instead of an error.
- Ringed planets show rings in the correct plane, and unringed planets show
  none.
- Approximate values are visibly marked, and catalog values are not.
- Planets around companion stars and circumbinary planets are placed on the
  correct parent.
