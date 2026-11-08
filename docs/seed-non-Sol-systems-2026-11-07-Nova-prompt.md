# Nova prompt: intro-page universe sources and attributions

Date: 2026-11-07

Status update: P2 has been reopened for the full body-family assessment in
[plan Section 12](./seed-non-Sol-systems-2026-11-07.md#12-reopened-p2-complete-celestial-family-assessment).
The current source list documents restricted v1 work and the
[preliminary five-system assessment](./seed-non-Sol-systems-2026-11-07-five-system-review.md),
not a completed scientific basis for every newly selected family. Additional
assessment references below are contextual, not implemented occurrence laws;
newly assessed gas/ice giants, companions, remnants and unbound populations are
not yet generated or released by this plan revision.

Copy the following brief into the Nova repository. Implement the UI change in
Nova, not the Stellar backend. This is an attribution handoff, not authorization
to activate non-Sol generation or change celestial contracts.

## Objective

Update the existing intro/welcome page with an accessible **Universe sources and
attributions** section. Reuse Nova's existing layout, credits components,
localization, typography, and link styling. Preserve existing credits and primary
navigation; do not replace the intro page with a scientific bibliography.

Include a concise summary and a clearly labelled expandable section or link to
full credits. Keep catalog/data credits distinct from scientific modeling
references and from project-authored fictional content.

Suggested original summary copy:

> Our universe combines astronomical catalog data with hypothetical,
> scientifically screened game content. Catalog values can include estimates,
> and generated worlds are not confirmed discoveries. Names, stations, resource
> distributions, and gameplay rules may be fictional or approximate.

Adjust this wording to the current released features. P2 augmentation is
**offline-only and not activated**; do not announce that its preview bodies
already exist in the playable universe.

## Authoritative backend handoff sources

Paths below are relative to the Stellar `solid-train` repository, not Nova.
If the backend checkout is unavailable, use the public references below and
request the current notices before implementing any legally required wording.

- [Implementation plan, especially Section 11](./seed-non-Sol-systems-2026-11-07.md):
  agreed scope, scientific assumptions, limitations, validation, and release gates.
- [Versioned P2 numeric policy](../data/non-sol-scientific-policy-v1.json):
  exact reference URLs, units, authored budgets, and screening limits.
- [Expanded five-system review](./seed-non-Sol-systems-2026-11-07-five-system-review.md):
  preserved inventory, hypothetical proposals, scientific references and explicit
  unresolved blockers. Proposed count envelopes are not approved numeric policy.
- [Celestial contract](./celestial-body-contract.md):
  provenance distinctions, generated naming, retirement, station placement,
  and curated Cygnus X-1 source interpretation.
- [Exoplanet data documentation](./exoplanet-catalog-data.md) and
  [import plan attribution register](./exoplanet-catalog-import-plan-2026-11-01.md#attribution-register):
  catalog lineage and consumer credit requirements.
- [Exoplanet dataset license and acknowledgments](../data/LICENSE-exoplanet-catalog.md):
  dataset-specific CC BY-SA 4.0 notice, adaptations, and NASA/ESA wording.
- [Per-object literature reference register](../data/exoplanet-references.json):
  plain-text labels and ADS bibcodes/URLs behind catalog parameters.
- [Sol catalog source documentation](./sol-catalog-data.md):
  MPC/JPL sources and existing whole-universe credit obligations.

Use the actual shipped snapshot dates if displaying them. Do not hardcode
preview totals as observed discoveries, live database counts, or released
coverage. Internal implementation documents are evidence, not external scientific
sources or public URLs to ship as working website links.

## Catalog and public-data credits

| Credit label                                                          | Public source                                                                                                                                                                                                              | What the project uses                                                                    | Attribution guidance                                                                                                                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NASA Exoplanet Archive / Caltech / NASA Exoplanet Exploration Program | [Archive](https://exoplanetarchive.ipac.caltech.edu/), [official acknowledgment guidance](https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html), [Christiansen et al. 2025](https://doi.org/10.3847/PSJ/ade3c2) | Planet/host parameters and literature references from the `pscomppars` composite table   | Retain the official acknowledgment from the backend notice and credit original parameter papers where applicable. The current official archive citation is Christiansen et al. 2025, replacing Akeson et al. 2013.               |
| HYG and AT-HYG databases, David Nash / astronexus                     | [HYG](https://codeberg.org/astronexus/hyg), [AT-HYG](https://codeberg.org/astronexus/athyg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)                                                               | Stellar cross-matches, positions, distances, identifiers, and source-resolved companions | Credit the creator and source, link the license, and state that Stellar subsets/cross-matches/adapts the data. The backend documents HYG v4.4 and AT-HYG v4.0. The old GitHub HYG repository is archived and points to Codeberg. |
| ESA Gaia and the Gaia Data Processing and Analysis Consortium (DPAC)  | [Gaia](https://www.cosmos.esa.int/gaia), [DPAC](https://www.cosmos.esa.int/web/gaia/dpac/consortium)                                                                                                                       | Astrometric information passed through the stellar catalog pipeline                      | Preserve the Gaia/DPAC acknowledgment and funding wording supplied by the backend notice. Do not claim all game positions are direct Gaia measurements.                                                                          |
| ESA Hipparcos and Tycho catalog contributors                          | [Hipparcos](https://www.cosmos.esa.int/web/hipparcos)                                                                                                                                                                      | Stellar identifiers and astrometric catalog lineage through HYG/AT-HYG                   | Include ESA 1997, _The Hipparcos and Tycho Catalogues_, ESA SP-1200; retain Tycho-2 lineage where applicable.                                                                                                                    |
| IAU NameExoWorlds                                                     | [NameExoWorlds](https://www.nameexoworlds.iau.org/)                                                                                                                                                                        | Existing approved exoplanet proper-name overrides                                        | Credit the naming program, but retain the import register's unresolved reuse-term review. Do not label all game names as IAU-approved or imply IAU endorsement.                                                                  |
| NASA/JPL Solar System Dynamics                                        | [Satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/), [satellite discovery table](https://ssd.jpl.nasa.gov/sats/discovery.html), [Small-Body Database API](https://ssd-api.jpl.nasa.gov/doc/sbdb.html)           | Existing Sol satellite elements/discoveries and selected small-body data                 | Preserve existing Sol credits. These sources are not evidence for hypothetical non-Sol moons or comets.                                                                                                                          |
| International Astronomical Union Minor Planet Center                  | [MPC](https://www.minorplanetcenter.net/), [comet orbital data](https://www.minorplanetcenter.net/iau/MPCORB/AllCometEls.txt)                                                                                              | Existing Sol comet snapshot                                                              | Preserve the MPC acknowledgment supplied in the Sol source documentation. Do not apply the MPC label to fictional non-Sol reservoirs.                                                                                            |
| Cassini Imaging Team / CICLOPS                                        | [S/2009 S 1 source](https://ciclops.org/view_popup.php?id=5926.html)                                                                                                                                                       | Existing Sol ring-moonlet orbit reference                                                | Retain relevant existing credits; no Cassini imagery is requested by this prompt.                                                                                                                                                |

**License scope:** The backend's combined exoplanet/HYG-derived data files are
distributed under CC BY-SA 4.0. This does not, by itself, license the entire game,
Nova source code, every upstream service, or every scientific article under
CC BY-SA. Keep the dataset scope and the adaptation notice explicit. Verify
upstream requirements before changing legal notices; do not erase unresolved
licensing review items to make the credits look complete.

## Scientific modeling references

Use these as a compact, readable reference list in the expanded credits. State
that they informed approximate models, not that their authors validated the game.

| Reference                                                                   | Public link                                                                                                                                                                                                       | Relevance and limitation                                                                                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Hill sphere                                                                 | [Formulation and references](https://en.wikipedia.org/wiki/Hill_sphere)                                                                                                                                           | Approximate gravitational-dominance boundary used in satellite and encounter screening. Not an N-body stability proof.                       |
| Roche limit                                                                 | [Formulation and exceptions](https://en.wikipedia.org/wiki/Roche_limit)                                                                                                                                           | Fluid Roche approximation used to screen moon clearance and ring proposals; real strength, elasticity, and resonances can change the result. |
| Oberbeck 1974, _Roche limit of a solid body_                                | [NASA NTRS record 19740055720](https://ntrs.nasa.gov/citations/19740055720)                                                                                                                                       | Source illustrating why solid-body breakup is not governed by one universal fluid-limit formula.                                             |
| Planetary equilibrium temperature                                           | [Radiative-equilibrium formulation](https://en.wikipedia.org/wiki/Planetary_equilibrium_temperature)                                                                                                              | Approximate irradiation screen; not surface temperature, atmospheric modeling, or a habitability claim.                                      |
| Holman and Wiegert 1999, _Long-Term Stability of Planets in Binary Systems_ | [arXiv:astro-ph/9809315](https://arxiv.org/abs/astro-ph/9809315), [DOI:10.1086/300695](https://doi.org/10.1086/300695)                                                                                            | Binary stability context and fit limitations. P2 does not invent binary solutions or extrapolate this work to arbitrary stellar hierarchies. |
| Margot 2015, _A Quantitative Criterion for Defining Planets_                | [arXiv:1507.06300](https://arxiv.org/abs/1507.06300), [DOI:10.1088/0004-6256/150/6/185](https://doi.org/10.1088/0004-6256/150/6/185), [formula summary](https://en.wikipedia.org/wiki/Clearing_the_neighbourhood) | Quantitative clearing proxy used in disclosed hypothetical planet/dwarf classification. Not an official classification of generated objects. |
| NASA Exoplanet Archive occurrence-rate bibliography                         | [Refereed occurrence-rate papers](https://exoplanetarchive.ipac.caltech.edu/docs/occurrence_rate_papers.html)                                                                                                     | Survey completeness/selection context. Raw catalog counts are not inferred real-world occurrence rates.                                      |
| Miller-Jones et al. 2021, Cygnus X-1 parameters                             | [DOI:10.1126/science.abb3363](https://doi.org/10.1126/science.abb3363)                                                                                                                                            | Curated black-hole/binary estimates; not a measured gameplay-safe station location.                                                          |
| Orosz et al. 2011, Cygnus X-1 system modeling                               | [DOI:10.1088/0004-637X/742/2/84](https://doi.org/10.1088/0004-637X/742/2/84)                                                                                                                                      | Additional curated binary-model reference; authored co-location does not supply observed orbital phase.                                      |
| NASA/ESA Hubble, Sirius B companion evidence                                | [Science release heic0516](https://esahubble.org/news/heic0516/)                                                                                                                                                  | Public evidence that a small fixture containing only Sirius A is not a complete single-star model. No Hubble image reuse is requested.       |

Wikipedia links are the secondary explanatory sources consulted for formulas;
the primary papers and official data providers are identified separately. Prefer
short original descriptions and links, not copied article text or illustrations.
If adding any externally sourced prose, imagery, or logos later, check its
specific license and required credits first. This prompt requests text/links only.

### Additional references from the expanded assessment

Include these in modeling/research credits only when relevant to the released
feature. Do not describe them as sources of measured moons, rings, ocean worlds
or generated bodies in the playable universe.

| Reference | Public source | Assessment use and limitation |
| --- | --- | --- |
| NASA planet types | [Overview](https://science.nasa.gov/exoplanets/planet-types/) | Family diversity and overlapping physical descriptions; no per-system probability law. |
| Chen & Kipping 2017, probabilistic mass-radius forecasting | [arXiv:1603.08614](https://arxiv.org/abs/1603.08614), [DOI:10.3847/1538-4357/834/1/17](https://doi.org/10.3847/1538-4357/834/1/17) | Physical regimes and intrinsic scatter; not unique composition from radius or occurrence counts. |
| Weiss & Marcy 2014, small-planet mass-radius relation | [arXiv:1312.0936](https://arxiv.org/abs/1312.0936) | Sample of 65 planets smaller than four Earth radii, periods <100 d; not a universal giant/outer-world model. |
| Dressing & Charbonneau 2015, M-dwarf small-planet occurrence | [arXiv:1501.01623](https://arxiv.org/abs/1501.01623) | Survey completeness/false-positive-adjusted evidence in defined size/period/host domains; not additions to already known systems. |
| Johnson et al. 2010, giant occurrence versus stellar mass and metallicity | [arXiv:1005.3084](https://arxiv.org/abs/1005.3084), [DOI:10.1086/655775](https://doi.org/10.1086/655775) | Host-conditioned survey evidence, not an unconditional giant probability for unknown metallicities or out-of-domain hosts. |
| Montet et al. 2014, TRENDS IV: giant planets around M dwarfs | [arXiv:1307.5849](https://arxiv.org/abs/1307.5849), [DOI:10.1088/0004-637X/781/1/28](https://doi.org/10.1088/0004-637X/781/1/28) | 111-star survey, 1-13 Jupiter masses within 20 AU; its 6.5% +/-3.0% host fraction is not a probability of adding another giant to a known system or a rate for Copper Vale's ~0.21-Jupiter-mass planet. Expanded v2 uses authored exploration, not a fitted occurrence law. |
| Mazeh, Holczer & Faigler 2016, short-period Neptune desert | [arXiv:1602.07843](https://arxiv.org/abs/1602.07843), [DOI:10.1051/0004-6361/201528065](https://doi.org/10.1051/0004-6361/201528065) | Conditional suppression/structure in period-mass/radius space; not an absolute hot-Neptune ban. |
| Kollmeier & Raymond 2019, Can Moons Have Moons? | [arXiv:1810.03304](https://arxiv.org/abs/1810.03304), [DOI:10.1093/mnrasl/sly219](https://doi.org/10.1093/mnrasl/sly219) | Theoretical survival for selected large/wide moons; no detected submoon or adopted frequency. |
| NASA observed planet summaries | HR 8799 [b](https://science.nasa.gov/exoplanet-catalog/hr-8799-b/) / [e](https://science.nasa.gov/exoplanet-catalog/hr-8799-e/), [GJ 9066 c](https://science.nasa.gov/exoplanet-catalog/gj-9066-c/), [Proxima b](https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/), Barnard [b](https://science.nasa.gov/exoplanet-catalog/barnard-b/) / [c](https://science.nasa.gov/exoplanet-catalog/barnard-c/) / [d](https://science.nasa.gov/exoplanet-catalog/barnard-d/) / [e](https://science.nasa.gov/exoplanet-catalog/barnard-e/) | Sample-system anchors; preserve original parameter-paper credits and distinguish estimated radii/temperatures from measurements. |
| Solar minor-population analogies | NASA [Kuiper Belt](https://science.nasa.gov/solar-system/kuiper-belt/), [Oort Cloud](https://science.nasa.gov/solar-system/oort-cloud/), [Lucy science](https://science.nasa.gov/mission/lucy/science/) | Solar evidence/hypotheses, not measured extrasolar belt/cloud/Trojan frequencies. |
| NASA stellar types and evolution | [Star types](https://science.nasa.gov/universe/stars/types/) | Remnant diversity/evolution, not evidence of new companions in the reviewed systems. |
| HR 8799 debris context, secondary source | [Debris-disk summary and primary references](https://en.wikipedia.org/wiki/HR_8799#Debris_disk) | Initial assessment context only. Obtain/credit adopted Spitzer/ALMA primary work before claiming calibrated disk geometry or distributions; a circumstellar disk is not a planetary ring. |

The assessment flags HR 8799's current game `hot-jupiter` appearance as requiring
thermal/source review: wide-orbit young giants' emitted temperature must not be
advertised as confirmed close-in irradiation. Also preserve candidate/estimate
labels for curated Proxima bodies and provisional Barnard stellar inputs.
Unresolved sources/models for captured or heated moons, rings, clouds, rogues
and companions remain gaps, not released science-backed populations.
The subsequent expanded supported-family preview is still offline: one of five
systems currently adds representatives, four remain blocked. Its counts and
hypothetical structures must not be advertised as released discoveries or live
universe population totals.

## Fictional and estimated content disclosure

- Retained catalog identities do not mean every parameter is measured.
  Estimated masses/radii, missing-orbit reconstruction, synthesized companions,
  game appearance, and authored fallback positions must remain distinguishable.
- Generated non-Sol bodies are hypothetical. Representative asteroid/comet
  counts are software sampling budgets, not estimates of total real populations.
- Equilibrium-temperature screens do not establish habitability. Analytic
  Hill/Roche/spacing screens do not prove long-term survival or safe access.
- Station locations, mining resources, cultural naming profiles, and narrative
  exceptions are project-authored gameplay choices unless individually sourced.
  Cultural weights are design policy, not observed demographic proportions.
- Credit Stellar/Nova project contributors for game-specific generation and
  naming, without inventing an external institution's endorsement.

## Implementation and validation instructions for Nova

1. Locate the current intro page and any shared About/Credits UI before editing.
   Add the summary near existing project credits, with an accessible route or
   expandable panel for the longer list.
2. Use Nova's existing localization and component patterns. Do not introduce a
   new dependency merely to render a reference list.
3. Render titles, acknowledgments, and source labels as text. Do not inject HTML
   from catalog reference strings. Only validated HTTPS URLs become links; ADS
   bibcodes may resolve through `https://ui.adsabs.harvard.edu/abs/{bibcode}/abstract`.
4. Ensure keyboard navigation, screen-reader labels, focus visibility, mobile
   layout, and readable link contrast. External links opened in a new tab should
   use the repository's established safe-link behavior.
5. Preserve existing catalog/object-level references and credits. The intro
   summary complements, rather than replaces, detailed source attribution.
6. Do not expose local backend filesystem paths as public navigation links.
   Do not add live catalog fetches, change API contracts, activate generation,
   modify backend data, or publish preview totals as live content.
7. Run the smallest existing Nova tests/lint/type checks covering the page and
   any shared credits component. Report each exact command and result.
8. Provide owner validation steps: open the intro page, expand/navigate to full
   credits, verify NASA/ESA/HYG/MPC acknowledgments and license scope, follow the
   source links, check the fiction/estimate disclosure, and test keyboard/mobile
   behavior. Include a screenshot if the existing workflow supports it.

## Acceptance criteria

- Intro credits visibly distinguish catalog providers, modeling references,
  and hypothetical/project-authored content.
- Required existing acknowledgments, dataset license/adaptation notices, and
  original parameter-paper links are retained.
- Source links are meaningful and accessible; no untrusted reference HTML is
  rendered and no third-party asset is added without its own permission/credit.
- The page does not claim institutions endorse the game, all generated objects
  are observed, or offline P2 previews are already released.
- Existing intro behavior remains intact and targeted Nova validation passes.
