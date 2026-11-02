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
of the exoplanet plan and ship as the
[exoplanet addendum](#exoplanet-addendum-ex-73) at the end of this document.
Nova should build the credits panel so that new sources can be appended
without a redesign.

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
- No contract fields change for the Sol credits. This is a UI-only task. The
  exoplanet addendum uses two additive fields, `discovery.references` and
  `catalogSnapshotDate`.

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

Out of scope: contract changes, exoplanet credits (see the exoplanet addendum
prompt), and texture or imagery attribution (already frontend-owned).

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

## Exoplanet addendum (EX-7.3)

Date: 2026-11-02. This addendum extends the same credits panel with the
exoplanet sources A1–A10 from the
[attribution register](./exoplanet-catalog-import-plan-2026-11-01.md#attribution-register).
Ship it after, or together with, the Sol prompt above. The planet-type and
contract changes it depends on are in
[nova-new-planet-types-2026-11-01.md](./nova-new-planet-types-2026-11-01.md).

### Contract facts for the addendum

- **`discovery.references`** on exoplanet-catalog planets (in
  `solar-system-get` and `celestial-body-list`) is `[{ label, url }]`, with
  the discovery reference first. `label` is plain text, for example
  "Butler et al. 1997" or "Calculated Value". `url` is an ADS abstract link
  (`https://ui.adsabs.harvard.edu/abs/<bibcode>/abstract`) or an absolute
  archive, ExoFOP, or VizieR URL, and some of these use `http`. The field is
  omitted when a planet has no references. Barnard's Star and Lalande 21185
  planets carry it too. The curated Proxima b and d do not.
- **`catalogSnapshotDate`** (`YYYY-MM-DD`) is on exoplanet-catalog system
  summaries in `solar-system-list` and `solar-system-get`. It is absent or
  null for curated and HYG systems. The archive refreshes monthly, so read
  this field instead of hard-coding a date.
- **`approximateFields`**, star `approximate`, and system
  `distanceApproximate` mark values that Stellar estimated (A9).
- **`controversial: true`** marks 58 planets the archive flags as disputed.
- All of these are plain text or URLs. Never render them as HTML.

### Exoplanet sources and required text

| ID  | Source                                   | Required or recommended text                                                                                                                                                                                                                                                                                                                                                                       | Type                  |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| A1  | NASA Exoplanet Archive                   | "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program." Cite Christiansen et al. (2025), PSJ, https://doi.org/10.3847/PSJ/ade3c2. Link https://exoplanetarchive.ipac.caltech.edu/                                  | Requested, verbatim   |
| A2  | Literature references within the archive | Per planet, from `discovery.references`: a "References" list in the planet detail view, discovery reference first.                                                                                                                                                                                                                                                                                 | Requested, per planet |
| A3  | HYG Database v4.4 (astronexus)           | "HYG Database v4.4, astronexus (codeberg.org/astronexus/hyg). Cross-matched with the NASA Exoplanet Archive and subset by Stellar." License CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/. This replaces or extends S7.                                                                                                                                                            | Required by CC BY-SA  |
| A4  | AT-HYG v4.0 (astronexus)                 | "AT-HYG v4.0, astronexus (codeberg.org/astronexus/athyg). Cross-matched with the NASA Exoplanet Archive and subset by Stellar." License CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/                                                                                                                                                                                              | Required by CC BY-SA  |
| A5  | ESA Gaia DR3                             | "This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement." | Requested, verbatim   |
| A6  | ESA Hipparcos and Tycho-2                | "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200."                                                                                                                                                                                                                                                                                                                                      | Citation              |
| A7  | Yale Bright Star and Gliese–Jahreiß      | "Hoffleit, Catalogue of Bright Stars, 5th ed. (1991); Gliese & Jahreiß (1991), Preliminary Version of the Third Catalogue of Nearby Stars." Secondary list.                                                                                                                                                                                                                                        | Recommended           |
| A8  | IAU Working Group on Star Names          | "Star names from the IAU Working Group on Star Names." Secondary list.                                                                                                                                                                                                                                                                                                                             | Recommended           |
| A9  | Stellar-derived values                   | Disclosure, not a credit. Mark every approximate value and explain it, for example "Approximate. Not all orbital elements are published for this planet."                                                                                                                                                                                                                                          | Required disclosure   |
| A10 | IAU NameExoWorlds 2015                   | "Exoplanet names approved by the IAU through the NameExoWorlds contest (2015), nameexoworlds.iau.org." Secondary list. Keep it behind a config flag until Forge confirms the IAU reuse terms.                                                                                                                                                                                                      | Pending sign-off      |

### Exoplanet limitations to disclose

Add these to the "About this data" section:

1. Exoplanet data comes from the NASA Exoplanet Archive's composite
   parameters table and refreshes monthly. Show "Data as of
   `catalogSnapshotDate`" in the system view.
2. Many planets lack published orbital elements, inclinations, or radii.
   Stellar fills the gaps with deterministic estimates, which are marked
   approximate.
3. Some host distances are estimated, and some companion stars are
   synthesized to match the archive's declared star count. These are marked
   approximate.
4. Planet types such as `super-earth` and `hot-jupiter` are classified by
   Stellar from mass, radius, and temperature. They are not archive labels.
5. Rings on exoplanets are procedural and approximate. No exoplanet rings
   have been observed.
6. Game display names may differ from catalog names. The catalog name is
   shown as a secondary label.
7. Planets the archive flags as controversial are labelled "disputed".

### Prompt for Nova (addendum)

```text
Extend the Viewer's data-credits panel with the exoplanet catalog sources.

Context:
- Forge (solid-train) now serves 6,451 NASA Exoplanet Archive planets across
  4,845 systems. Attribution stays frontend-owned: the global credits are
  static UI content.
- Two additive contract fields support per-planet and dated attribution:
  `discovery.references: [{ label, url }]` on catalog planets (discovery
  reference first) and `catalogSnapshotDate` (YYYY-MM-DD) on exoplanet-catalog
  system summaries in solar-system-list and solar-system-get.
- All catalog text is plain text. Never use innerHTML or bypassSecurityTrust*.

Requirements:
1. Append credits A1–A8 and A10 to the existing data-driven credits panel,
   using the text in docs/nova-sol-catalog-attribution-prompt.md (exoplanet
   addendum). Show A1 and A5 verbatim. Show A3 and A4 with the CC BY-SA 4.0
   license name, the link https://creativecommons.org/licenses/by-sa/4.0/,
   and the change notice "Cross-matched with the NASA Exoplanet Archive and
   subset by Stellar". Put A7, A8 and A10 in a secondary list. Keep A10
   behind a config flag that defaults to off.
2. In the planet detail view, show a "References" list built from
   `discovery.references`: the first entry labelled "Discovery", then the
   others. Render each label as text, linked to its url. Open links in a new
   tab with rel="noopener noreferrer". Collapse lists longer than five
   entries behind a "Show all" control. Hide the section when the field is
   absent.
3. In the system view and system details, show "Data as of <date>" from
   `catalogSnapshotDate` when it is present. Never hard-code the date.
4. Mark approximate values (A9): planet fields listed in
   `approximateFields`, stars with `approximate: true`, and systems with
   `distanceApproximate: true`. Use a consistent marker with a tooltip or
   legend explaining that the value is estimated by Stellar.
5. Label planets with `controversial: true` as "disputed".
6. Add the seven exoplanet limitations to the "About this data" section.
7. Add tests: every new credit and license link renders; A1 and A5 match
   verbatim; references render in order with the discovery entry first; a
   reference label containing "<b>x</b>" renders as literal text; the date
   line appears only when catalogSnapshotDate is present; approximate and
   disputed markers appear only when flagged; A10 is hidden when the flag is
   off.

Out of scope: planet-type rendering and the archetype validator (see
docs/nova-new-planet-types-2026-11-01.md) and list paging (a separate
prompt).

Report back: the files changed, screenshots of the credits panel and of a
planet's references (for example 55 Cnc b), and the test command and its
result.
```

### Addendum acceptance checklist

- [ ] A1 and A5 are shown verbatim; A3 and A4 show the license and change
      notice
- [ ] A7, A8 and A10 are in a secondary list, and A10 is behind a flag
- [ ] Planet references are listed with the discovery reference first, as
      plain text with safe links
- [ ] "Data as of" uses `catalogSnapshotDate` and is never hard-coded
- [ ] Approximate values, approximate stars and distances, and disputed
      planets are marked
- [ ] The seven exoplanet limitations are listed
- [ ] Nova tests pass, with the command and result reported back

## Follow-up

- Confirm the IAU NameExoWorlds reuse terms (A10) and then enable the flag.
- Paging for the full system list is a separate prompt (P2 in the exoplanet
  plan).
