# Exoplanet catalog data license and acknowledgments

This notice covers the exoplanet catalog snapshots in this directory:

- `exoplanet-planets.json`
- `exoplanet-hosts.json`
- `exoplanet-references.json`
- `exoplanet-hyg-stars.json` (AT-HYG and HYG rows for matched hosts and
  their companions)
- `exoplanet-match-report.json`
- The AT-HYG and HYG sample rows in `test/fixtures/exoplanet/`
- Later snapshots from the same import pipeline, such as the solar-system
  grouping

## License

These files are distributed under the
[Creative Commons Attribution-ShareAlike 4.0 International license (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
The pipeline combines NASA Exoplanet Archive data with HYG and AT-HYG data,
which are licensed CC BY-SA 4.0. The share-alike terms therefore apply to the
derived files.

This license applies only to the data files listed above. It does not change
the license of the source code in this repository.

## Changes made

The data was produced by `scripts/import-exoplanet-catalog-data.js` and later
pipeline scripts. Compared with the sources:

- Only the columns listed in the importer are kept. Values are renamed to
  camelCase with units in the field name.
- A missing orbital period or semi-major axis is calculated from the other
  value with Kepler's third law, using the host star's mass.
- The argument of periapsis is normalized to the range 0–360°.
- Host-star values repeated across planet rows are reduced to the most
  common value.
- Literature reference anchors are reduced to plain-text labels plus an ADS
  bibcode or URL.
- Host stars are cross-matched against HYG and AT-HYG and grouped into
  solar systems.

## Sources and acknowledgments

### NASA Exoplanet Archive

Planet and host-star parameters come from the `pscomppars` table of the
[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/). The
snapshot date is recorded in each file.

> This research has made use of the NASA Exoplanet Archive, which is operated
> by the California Institute of Technology, under contract with the National
> Aeronautics and Space Administration under the Exoplanet Exploration
> Program.

Citation: Christiansen et al. (2025), _The Planetary Science Journal_,
[doi:10.3847/PSJ/ade3c2](https://doi.org/10.3847/PSJ/ade3c2).

The archive also asks users to acknowledge the individual references behind
each parameter. Those references are listed in `exoplanet-references.json`,
and each planet's `refs` array points into that table.

### HYG and AT-HYG

- HYG Database v4.4, astronexus
  ([codeberg.org/astronexus/hyg](https://codeberg.org/astronexus/hyg)),
  CC BY-SA 4.0.
- AT-HYG v4.0, astronexus
  ([codeberg.org/astronexus/athyg](https://codeberg.org/astronexus/athyg)),
  CC BY-SA 4.0.

Changes: cross-matched to exoplanet hosts and reduced to a subset by Stellar.

### ESA Gaia

> This work has made use of data from the European Space Agency (ESA) mission
> _Gaia_ (https://www.cosmos.esa.int/gaia), processed by the _Gaia_ Data
> Processing and Analysis Consortium (DPAC,
> https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC
> has been provided by national institutions, in particular the institutions
> participating in the _Gaia_ Multilateral Agreement.

### ESA Hipparcos and Tycho-2

ESA, 1997, _The Hipparcos and Tycho Catalogues_, ESA SP-1200.
