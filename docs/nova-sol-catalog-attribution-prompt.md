# Nova prompt: Sol catalog data attribution

Status: Ready to hand off to Nova
Date: 2026-11-01
From repo: solid-train (Forge)
To repo: laughing-octo-journey (Nova)
Related: [sol-catalog-data.md](./sol-catalog-data.md),
[exoplanet-catalog-import-plan-2026-11-01.md](./exoplanet-catalog-import-plan-2026-11-01.md#attribution-register)

## Purpose

The Sol seed catalog that Forge serves contains public scientific data. Some
sources request an acknowledgment. This document gives Nova a prompt for
adding a data-credits panel and a catalog-limitations note to its Viewer UI.

The exoplanet import adds more sources. Their requirements are tracked in the
[attribution register](./exoplanet-catalog-import-plan-2026-11-01.md#attribution-register)
of the exoplanet plan. They will ship as an addendum to this prompt in
EX-7.3. Nova should build the credits panel so that new sources can be
appended without a redesign.

## Contract facts for Nova

- Forge does **not** send attribution, license, or credits payloads. The
  OpenAPI contract states that attribution is frontend-owned. Nova must ship
  the global credits text as static UI content.
- Each catalog body's `discovery.discoveryNotes` is an open-ended text field
  in the `celestial-body-list` and `solar-system-get` responses. For catalog
  snapshot bodies it carries source and snapshot-date details, for example
  `Minor Planet Center comet orbit record (2026-10-28); designation …` and
  `Mean elements from NASA/JPL Solar System Dynamics (2026-10-28; … frame).`
  For curated and procedural bodies it may hold descriptive text instead.
- Catalog text fields are **plain text, not sanitized HTML**. Nova must render
  them as text or escape them for the context. It must never insert them as
  HTML.
- Snapshots refresh quarterly through an automated PR. The snapshot date is
  visible only inside each body's `discoveryNotes`. Do not hard-code a
  snapshot date in the global panel.
- No contract fields change. This is a UI-only task.

## Sources and required text

| ID  | Source                                                            | Data provided                                         | Required or recommended text                                                                                                                                                                   | Type                 |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| S1  | IAU Minor Planet Center (MPC)                                     | Comet orbits (`AllCometEls.txt`)                      | "This research has made use of data and/or services provided by the International Astronomical Union's Minor Planet Center." Link: https://www.minorplanetcenter.net/                          | Requested, verbatim  |
| S2  | NASA/JPL Solar System Dynamics                                    | Planetary-satellite mean elements and discovery table | "Planetary satellite mean orbital elements courtesy of NASA/JPL Solar System Dynamics." Links: https://ssd.jpl.nasa.gov/sats/elem/ and https://ssd.jpl.nasa.gov/sats/discovery.html            | Recommended credit   |
| S3  | NASA/JPL Small-Body Database                                      | Orbit of 2026 ED138                                   | "Orbit of 2026 ED138 from the NASA/JPL Small-Body Database." Link: https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html                                                                             | Recommended credit   |
| S4  | NSF–DOE Vera C. Rubin Observatory                                 | Candidate status and size range of 2026 ED138         | "Dwarf-planet candidate status for 2026 ED138 as announced by the NSF–DOE Vera C. Rubin Observatory."                                                                                          | Recommended credit   |
| S5  | Cassini Imaging Team (CICLOPS)                                    | Reported orbit of the ring moonlet S/2009 S 1         | "S/2009 S 1 orbit based on the Cassini Imaging Team report." Link: https://ciclops.org/view_popup.php?id=5926.html                                                                             | Recommended credit   |
| S6  | NASA planetary fact sheets, JPL Horizons, and IAU minor-body data | Curated planet, major-moon, and dwarf-planet values   | "Planet and major-moon values adapted from NASA planetary fact sheets and JPL Horizons; dwarf-planet data from IAU minor-body sources." Link: https://nssdc.gsfc.nasa.gov/planetary/factsheet/ | Recommended credit   |
| S7  | HYG star database (astronexus)                                    | Sun's spectral class and luminosity (fixture)         | "Star data from the HYG Database (codeberg.org/astronexus/hyg), licensed CC BY-SA 4.0." Link the license: https://creativecommons.org/licenses/by-sa/4.0/                                      | Required by CC BY-SA |

Rows S2–S6 are good-practice credits rather than strict requirements. Show
them anyway, because the panel will grow into the full data-credits surface
for the exoplanet catalog.

## Catalog limitations to disclose

Show these as short notes in the Viewer, near the credits or in an "About this
data" section:

1. The catalog is game-grade. It uses mean orbital elements and is not a
   flight-grade ephemeris.
2. Asteroids are intentionally excluded.
3. Interstellar objects, such as 1I and 2I, are excluded because they are not
   Solar System comets.
4. Comets with eccentricity ≥ 0.999 use their perihelion elements to place a
   snapshot position. They are not drawn as elliptic orbits.
5. S/2009 S 1 uses an **approximate** circular, zero-phase orbit for
   visualization only.
6. 2026 ED138 is a **dwarf-planet candidate**, not a confirmed dwarf planet.
   Its diameter is reported as a 600–1,500 km range.
7. Body counts depend on the snapshot and may change after each quarterly
   refresh.

## Prompt for Nova

Copy the following prompt into a Nova session in `laughing-octo-journey`.

```text
Add public-data credits and catalog limitations to the Viewer UI.

Context:
- Forge (solid-train) serves the Sol celestial catalog. It contains public
  scientific data, and some sources request acknowledgment.
- Forge sends no attribution payload. Attribution is frontend-owned, so the
  credits text must be static UI content in Nova.
- Each body's `discovery.discoveryNotes` is plain text. For catalog bodies it
  includes the source and snapshot date; for other bodies it may be
  descriptive. Render it as text only. Never use innerHTML or
  bypassSecurityTrust*.

Requirements:
1. Add a "Data credits" panel reachable from the Viewer, for example an info
   button, footer link, or About dialog. Follow existing Nova UI patterns.
2. Drive the panel from a typed data structure, for example
   `DataCredit { id, source, text, links: {label, url}[], license?: {name, url} }`,
   so later sources (exoplanet catalog, Gaia, AT-HYG) can be appended without
   UI changes.
3. Include these credits:
   - S1 (verbatim, required): "This research has made use of data and/or
     services provided by the International Astronomical Union's Minor
     Planet Center." Link https://www.minorplanetcenter.net/
   - S2: "Planetary satellite mean orbital elements courtesy of NASA/JPL Solar
     System Dynamics." Links https://ssd.jpl.nasa.gov/sats/elem/ and
     https://ssd.jpl.nasa.gov/sats/discovery.html
   - S3: "Orbit of 2026 ED138 from the NASA/JPL Small-Body Database." Link
     https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html
   - S4: "Dwarf-planet candidate status for 2026 ED138 as announced by the
     NSF–DOE Vera C. Rubin Observatory."
   - S5: "S/2009 S 1 orbit based on the Cassini Imaging Team report." Link
     https://ciclops.org/view_popup.php?id=5926.html
   - S6: "Planet and major-moon values adapted from NASA planetary fact sheets
     and JPL Horizons; dwarf-planet data from IAU minor-body sources." Link
     https://nssdc.gsfc.nasa.gov/planetary/factsheet/
   - S7 (license, required): "Star data from the HYG Database
     (codeberg.org/astronexus/hyg)", license CC BY-SA 4.0,
     https://creativecommons.org/licenses/by-sa/4.0/
4. Add an "About this data" section with these limitations:
   - Game-grade mean orbital elements, not a flight-grade ephemeris.
   - Asteroids are excluded.
   - Interstellar objects are excluded.
   - Comets with eccentricity ≥ 0.999 are placed from perihelion elements and
     are not drawn as elliptic orbits.
   - S/2009 S 1 uses an approximate circular orbit for visualization only.
   - 2026 ED138 is a dwarf-planet candidate (diameter 600–1,500 km), not a
     confirmed dwarf planet.
   - Body counts depend on the snapshot and change with quarterly refreshes.
5. In the body detail view, show `discovery.discoveryNotes` as plain text
   under a "Notes" label when it is present.
6. Do not hard-code a snapshot date in the global panel.
7. Open external links in a new tab with rel="noopener noreferrer".
8. Add tests: the panel renders every credit and license link, the S1 text
   matches verbatim, discoveryNotes containing markup such as
   "<b>x</b>" renders as literal text, and the panel is keyboard accessible.

Out of scope: contract changes, exoplanet credits (a follow-up addendum will
add them), and texture or imagery attribution (already frontend-owned).

Report back: the files changed, a screenshot of the panel, and the test
command and its result.
```

## Acceptance checklist

- [ ] Credits panel reachable from the Viewer and keyboard accessible
- [ ] S1 MPC acknowledgment shown verbatim
- [ ] S7 HYG credit includes the CC BY-SA 4.0 name and license link
- [ ] Limitations section lists all seven notes
- [ ] `discoveryNotes` rendered as plain text, never as HTML
- [ ] Credits are data-driven so exoplanet sources can be appended
- [ ] Nova tests pass, with the command and result reported back

## Follow-up

The exoplanet addendum is EX-7.3 in the exoplanet plan. It will add the NASA
Exoplanet Archive, per-planet literature references, AT-HYG, Gaia DR3,
Hipparcos and Tycho-2, the Yale and Gliese catalogs, and IAU star-name credits,
plus disclosures for approximate values and controversial planets.
