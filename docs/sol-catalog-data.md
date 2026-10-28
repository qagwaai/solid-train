# Sol catalog data

The Sol seed catalog contains **5,135 bodies** in the checked-in snapshot,
refreshed on 2026-10-28:

| Body type                                     | Count |
| --------------------------------------------- | ----: |
| Star                                          |     1 |
| Planets                                       |     8 |
| Official dwarf planets                        |     5 |
| Trans-Neptunian objects, including 2026 ED138 |     4 |
| Planetary moons                               |   461 |
| Comets                                        | 4,656 |

Asteroids are intentionally excluded from this performance-test catalog. The
two interstellar visitors present in this MPC snapshot are also excluded
because they are not Solar System comets. These counts are snapshot-specific
and can change when the source catalogs are refreshed.

## Data sources

The checked-in [MPC comet snapshot](../data/sol-comets.json) was refreshed on
2026-10-28 from the Minor Planet Center's
[AllCometEls data](https://www.minorplanetcenter.net/iau/MPCORB/AllCometEls.txt).
The MPC requests the following acknowledgment:

> This research has made use of data and/or services provided by the
> International Astronomical Union's Minor Planet Center.

The MPC's [comet orbit format](https://docs.minorplanetcenter.net/mpc-ops-docs/orbits/comet-orbit-format/)
documents the fixed-width source fields. Bound comets with eccentricity below
0.999 use elliptic orbital elements. Higher-eccentricity and unbound comets use
their perihelion elements to calculate a snapshot position without representing
them as elliptic orbits.

The checked-in [JPL satellite snapshot](../data/sol-satellites.json) was
refreshed on 2026-10-28 from the JPL Solar System Dynamics
[satellite mean-elements table](https://ssd.jpl.nasa.gov/sats/elem/) and
[discovery table](https://ssd.jpl.nasa.gov/sats/discovery.html). Duplicate
Puck mean-element rows are collapsed to the newer epoch. S/2009 S 1 is included
from the Cassini Imaging Team's [reported ring-moonlet orbit](https://ciclops.org/view_popup.php?id=5926.html);
its circular, zero-phase orbit is an explicitly approximate visualization
fallback because it has no row in the JPL mean-elements table.

The additional object 2026 ED138 is included as a **TNO/dwarf-planet
candidate**, not as a confirmed dwarf planet. Its orbit comes from the
[NASA/JPL Small-Body Database API](https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=2026%20ED138).
The source reports an estimated diameter range of 600–1,500 km; the catalog
preserves that range in discovery notes rather than inventing a precise size.

## Refreshing snapshots

Run `npm run catalog:sol:refresh` to download and regenerate the MPC and JPL
snapshots. Runtime seeding reads only the checked-in files and does not make
network requests. The seed version includes a SHA-256 digest of both snapshot
files, so changes to their contents or metadata cause an existing database to
be reseeded on startup. A quarterly GitHub Actions workflow runs the refresh
and validation checks, then opens a pull request if the snapshots changed.
Repository settings must permit GitHub Actions to create pull requests for that
last step to succeed.

## Nova UI attribution prompt

The Nova UI is maintained in a separate repository. Copy the prompt in
[nova-sol-catalog-attribution-prompt.md](./nova-sol-catalog-attribution-prompt.md)
to add public-data credits and catalog limitations to its Viewer UI.
