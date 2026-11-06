# Catalog-system naming plan

Date: 2026-11-05

Owner: Forge (backend); consumer coordination: Nova

Status: **The existing 25-entry manifest is enabled on disk and the owner reported live confirmation.** The full-catalog review in section 13 found no additional system that meets both explicit eligibility and approved-unused-content gates, so it made zero additional activations. Eighteen new Earth-landmark draft labels are review-only and unapproved. No independent linguistic/cultural certification or legal clearance is claimed.

## 1. Confirmed direction and boundaries

The completed question form establishes these requirements; do not reopen it:

- **Style:** a blend of settlement-style names, landscape imagery, and aspirational names.
- **Culture:** use all three approaches: curated, sourced names across many linguistic traditions with cultural review; fictional future cultures influenced by Earth traditions; and a mixture of both.
- **Display:** always show an assigned name together with its original designation, for example `New Name (Gj 9066)`. Preserve the source's actual spelling: the local record is `GJ 9066`.
- **Eligibility:** only catalog-style system names; preserve established proper names.
- **Audience and references:** all-ages, “G-rated” naming, including safe science-fiction references. This is an editorial standard, not a claim of formal movie-rating certification.
- **Coverage:** the full checked-in catalog is the intended naming universe. The earlier 620/621 figure is not a target or an assignment cap.
- **Publication gate:** on 2026-11-05 the owner explicitly authorized activation of the exact 25-entry preview and subsequently confirmed it in Nova. This is user-reported live consumer confirmation; detailed deployment checks remain separately scoped (Section 12).
- **Author-honoring candidates:** include Asimov and other science-fiction authors as editorial proposals, not as rights-cleared content or publishable names.

North American towns are an analogy for how communities acquire names, not the default cultural vocabulary or a license to reproduce colonial naming practices. Use naming motivations found across societies: remembered places, landscape metaphors, shared hopes, meeting places, journeys, and community histories.

Scope is **system names only**. Do not regenerate planets, change orbital/physical data, rename planet or star entities, or invent settlement populations or habitability facts. Assess related labels for consistency, but defer actual planet/star naming to a separately approved scope. No additional questionnaire is needed to prepare this plan.

## 2. Grounding and verified inventory

Inspected repository guidance: `CONTRIBUTING.md` and `CODEBASE.md`; no `AGENTS.md` was found. Prefer the actual modules below where the older codebase guide describes pre-refactor architecture.

### Counts are not interchangeable

The user reports **621 systems**. That is not the locally verified full-registry count and must not become an assignment limit or asserted database total.

Read-only Node inspection of the checked-in snapshots and registry on this date found:

- `getSolarSystemRegistry()`: **4,845**.
- Registry source `curated`: **3**.
- Registry source `procedural`: **4**.
- Registry source `exoplanet-catalog`: **4,838**.
- `getHygSystems()` fixture groups: **6**.
- `data/exoplanet-systems.json` records: **4,841**.
- Exoplanet host / planet snapshot records: **4,847 / 6,451**.

The snapshot contains three existing-system records reconciled with existing systems rather than appended as new registry entries. The six HYG groups plus the separate Cygnus X-1 entry and 4,838 appended systems explain 4,845. These are local source-derived counts, not a census of the running server's database, a user's filtered/paged view, or eligible names. The snapshot date is 2026-11-01.

Exact example: `exo-gj-9066` currently has `displayName: GJ 9066`, `catalogName: GJ 9066`, `primaryStar.properName: null`, star ID `exo-star-gj-9066`, HYG ID `118100`, and one catalog planet. It is a candidate for review, not an assignment made here.

### Verified integration points

- `src/model/solar-system-registry.js`: Cached authoritative system list combines HYG groups, curated overrides, and exoplanet records; exposes `getSolarSystemRegistry`, `getSolarSystemById`, and `clearRegistryCache`. Apply one system-name resolver consistently here, not only in MongoDB.
- `src/model/hyg-star-catalog.js`: HYG parser retains `properName`, HYG/HIP/HD IDs, system ID and role. Group display names come from primary proper names (with trailing A/B removed) or the system ID. A nonempty proper-name field is not proof of a traditional name: this fixture also contains `Wolf 359` and `Lalande 21185`.
- `src/model/exoplanet-catalog.js`: `systemDisplayName` currently prefers `names.systems[id]`, primary proper name, catalog name, primary catalog name, then ID. Loads checked-in snapshots lazily; caches results. System name entries also participate in `getExoplanetSystemSeedHash`.
- `data/exoplanet-names.json`: Hand-maintained stable-ID maps for systems, stars, planets. Systems and stars are currently empty; 29 planet names are present and must remain unchanged. Refresh scripts must never overwrite this file.
- `data/exoplanet-overrides.json`: Existing host-match/system-assignment corrections, not a generic naming store. Keep astronomical reconciliation separate from editorial naming overrides.
- `src/handlers/solar-system-list-message-handler.js`: Reads registry, filters before sorting/paging; search includes ID, display name, catalog name, primary proper name and spectral type. Name sort uses display name with ID tie-break.
- `src/handlers/solar-system-get-message-handler.js`: Resolves registry summary by ID, ensures bodies seeded, then reads canonical stored bodies. Renaming a summary must not accidentally trigger body replacement.
- `src/db/models/solar-system-model.js`: Persists `displayName` and nullable `catalogName`; no naming provenance/version/alias fields currently exist. Proposed metadata is not already supported.
- `src/db/service/solar-system-service.js`: Provides system reads/upserts; DB search currently covers ID, display name and primary proper name, unlike registry search's explicit catalog-name support. Align deliberately if alias search is delivered.
- `src/server.js`, `src/db/service.js`: Startup calls `syncSolarSystems(getSolarSystemRegistry())`; delegates collection synchronization to catalog sync service. Audit sync hashing and field ownership before adding persisted naming metadata.
- `src/model/star-catalog.js`: Unified star catalog is independently cached and has stable star IDs. A system rename does not automatically rename stars.
- `src/model/procedural-system-generator.js`, `src/model/solar-system-celestial-seed.js`: Procedural planet labels currently derive from primary proper name or system ID plus Roman numerals; seeding maps catalog display names into bodies. Do not change these paths as a side effect of naming systems.

Existing intent is documented in D24 / deferred N1 in `docs/exoplanet-catalog-import-plan-2026-11-01.md`, and in `docs/exoplanet-catalog-data.md`. This proposal narrows that earlier broad system/star/planet idea to the user's current **system-only** request and adds the combined-label requirement.

## 3. Eligibility: explicit decisions, never rename-by-regex

Build a reviewed eligibility manifest keyed by canonical system ID. Each entry records source evidence, observed source designation, decision (`eligible`, `protected`, `needs-review`), reason, reviewer, and source-snapshot digest.

1. Inventory source system records, primary and component star proper names, existing curated overrides, and hand-assigned names. Exoplanet snapshots themselves can contain `properName`, not just the registry's primary-star summary.
2. Protect curated systems and documented established proper names before considering catalog families. Examples: Sol, Alpha Centauri, Sirius, Barnard's Star, Cygnus X-1; protect IAU names such as Veritate and Pherkad Minor even when the underlying ID looks like a catalog identifier.
3. Use recognized source designation families (GJ, HD, HIP, HYG, Kepler, TOI, coordinate identifiers, etc.) only to **suggest** candidates. Neither `exo-` IDs, digits, source category, nor a missing `properName` alone authorizes renaming. `Kepler` plus a survey number is different from a proper name honoring a person.
4. Review every proposed eligible ID against source provenance and existing editorial assignments. `Wolf 359` and `Lalande 21185` are ambiguous at the catalog/familiar-name boundary: default to protected pending an explicit per-ID decision. Multi-star systems with a named component require review rather than silently erasing that identity.
5. Unknown or contradictory evidence means `needs-review`: leave the current label untouched. Explicit protections outrank an assignment or override; changing protection requires a separate reviewed decision.

The release universe is the full catalog, frozen by canonical IDs and snapshot digest, not “first 621 rows.” The earlier report of 621 is not a limit. The current dry run enumerates the complete 4,845-system checked-in registry and proposes only the explicitly reviewed GJ 9066 pilot; all other IDs remain protected or needs-review until explicit evidence is recorded.

## 4. Editorial content model and cultural process

Curate a finite bank of **complete reviewed names**, not random syllables or cross-language prefixes/suffixes. A candidate has a stable candidate ID and:

- Display spelling, optional native-script spelling, approved transliteration and pronunciation notes.
- Naming motivation and style tags: settlement, landscape metaphor, aspiration; optional gentle science-fiction motif.
- Lane: sourced tradition, fictional future community, or documented blend.
- Specific language, region, community and source context where applicable; no continent-wide “culture” buckets.
- Source URL/publication and access date, reuse terms/permission, attribution obligations, reviewer and review date.
- Meaning claim and confidence, cultural restrictions, sensitivity notes, all-ages review status, collision keys, approval/withdrawal history.
- For fiction, original authorship and a short in-world rationale, clearly separated from real-world etymology.

Recruit appropriately knowledgeable linguistic/cultural reviewers. Avoid sacred or restricted names, living individuals' names without permission, stereotypes, decorative diacritics, and borrowing marginalized communities' identities as interchangeable scenery. A name being publicly visible is not sufficient permission or cultural clearance. Uncertain translations stay unapproved.

Fictional future cultures may develop their own coherent naming conventions; record the influences and internal grammar. A mixed lane requires a plausible, reviewed history of contact and adaptation, not arbitrary token mixing. Do not infer a culture from a system's sky coordinates or allocate “one ethnicity per spectral class.”

Start with a balanced editorial pilot across specific traditions and fictional communities; assess diversity of motivations, scripts, rhythms and lengths, not merely numerical quotas. The initial language weights below are approved; they are not cultural or population quotas. If reviewed stock is insufficient, leave systems catalog-named instead of manufacturing authenticity.

### Approved initial language composition: policy version 1

Approved by the user on 2026-11-05 as the starting editorial policy for newly named, eligible systems. Protected existing proper names are outside the allocation denominator. These are language targets, not country shares, historical probabilities, ownership claims, or permanent lore.

| Naming language/tradition                 | Target percentage |
| ----------------------------------------- | ----------------: |
| English                                   |               30% |
| Chinese (initially Mandarin-based naming) |               18% |
| Russian                                   |               12% |
| Spanish                                   |                6% |
| Arabic                                    |                5% |
| Hindi                                     |                5% |
| Portuguese                                |                4% |
| Japanese                                  |                4% |
| French                                    |                4% |
| Swahili                                   |                3% |
| Indonesian                                |                3% |
| Turkish                                   |                2% |
| Korean                                    |                1% |
| German                                    |                1% |
| Other reviewed traditions                 |                2% |
| **Total**                                 |          **100%** |

Language is independent of expedition origin: Martian, lunar, orbital, and multinational communities may use any reviewed language. Author tributes count by the language of their naming construction, not the author's nationality; `Liu Cixin's Signal` is English-language naming.

Small batches use Hamilton's largest-remainder method independently for each requested batch. Integer remainders are ranked descending; exact ties follow the language order in `data/system-naming-weight-policy-v1.json`. For 25 slots the quotas are 8 English, 5 Mandarin, 3 Russian, 2 Spanish, and one each in Arabic, Hindi, Portuguese, Japanese, French, Swahili, and Indonesian. Turkish, Korean, German, and Other receive zero in this batch. The implementation uses integer arithmetic and does not promise cumulative fairness: small shares can remain zero in repeated identical batches. A candidate shortage leaves that language's slots explicitly unfilled, with no cross-language redistribution.

This approval does not approve any sample name-to-system pairing, verify multilingual content, or enable publication. The existing 100-system preview remains a separate unweighted artifact. `scripts/dry-run-system-naming-weighted.js` implements the weighted process without changing that report; it records policy/input digests and actual filled/unfilled counts, preserves the fixed GJ 9066 / Copper Vale proposal within English's quota, and never substitutes another language for a shortage. Regional clustering and expedition histories remain separate design work.

### Possible historical influences (not established setting facts)

Exploration and settlement history may eventually inform fictional naming context, but no country weights, expedition timeline, naming authority, or alternate-history account is approved. Early US, Chinese, and Soviet space-exploration heritage can be considered as style research only; any later use needs sourced factual context and explicit editorial approval. Soviet legacy and survival are especially unresolved and must not be fictionalized as settled fact in this preview.

Keep launch provider, expedition sponsor, founding population, and naming authority distinct. Do not infer a future population or language from a launch nation. A hypothetical Martian, lunar, or orbital naming influence is metadata/style inspiration only; it is not evidence of real habitation, sovereignty, population, or history in this game.

Any future setting model must be authored and reviewed before assignment tooling uses it. The approved language weights above are editorial targets only; they do not establish a geopolitical ranking, simulated expedition history, runtime demographic inference, or equal-distribution requirement.

Real-language names should remain untranslated in their primary labels where appropriate; meanings belong in supporting details. Native-script spelling, reviewed transliteration, pronunciation, and language-specific place-name naturalness require review. The multilingual conversation sample is illustrative only, not a verified or approved language bank. Do not assign Earth cultures from sky directions or assume that a star's position above an Earth territory implies ownership.

### Open design: possible non-human naming traditions

Non-human civilizations, their territories, languages, and writing systems are not yet established game lore. The following is a recommendation for future design, not an enabled naming policy or an API/schema change.

- Distance may influence encounter likelihood or exploration history, but must not automatically determine species, ownership, naming language, or hostility. Define the reference point (for example Sol) and coordinate units before introducing any distance model. Discovery is not evidence that a system is inhabited.
- Prefer reviewed regions, routes, and contact histories over a hard distance boundary. Allow human expeditions beyond known regions, nearby non-human presence, mixed communities, and unknown/uninhabited systems if later lore supports them. Do not generate any of these as facts today.
- Distinguish an original catalog designation, a human exonym, a community's own name (endonym), and a readable rendering or transliteration. A human-assigned label is not proof of settlement or sovereignty. Keep canonical IDs and source designations unchanged.
- Humans may independently name a system even when another civilization discovered or named it first, whether or not humans know that earlier name. The human name need not translate or replace the earlier name, and first discovery does not confer exclusive naming authority. Distinguish first discoverer, inhabitants, and naming community; an earlier discoverer's name is not necessarily the inhabitants' endonym. Multiple communities' names may coexist for the same canonical system, with separate provenance and knowledge/visibility rules. Learning an earlier name must not automatically rename the system for every player or retire its human name. Any future preferred-label policy needs explicit product review; no such behavior is implemented here.
- Separate civilization, species, language, and script. One civilization can contain multiple species and languages; one species need not share a single language or political identity. Construct fictional languages coherently rather than treating unfamiliar real-world scripts as inherently alien.
- Until a language exists, retain the current catalog label or a separately approved human name. Do not invent purported native names, write placeholder glyphs into canonical fields, or infer native pronunciation from random Unicode characters.
- Prefer standard Unicode text where suitable. If a custom script is later required, evaluate original glyph assets, font licensing, shaping, accessibility, copy/search behavior, and fallback together. Do not use arbitrary private-use characters as interoperable names without a defined encoding/font strategy. Every custom-script presentation needs a stable readable text alternative, not a replacement entity ID.
- A future discovery/localization design may select which approved name a player sees according to known information. Do not expose hidden civilization names through aliases, search, or API metadata before the relevant discovery. This needs explicit product and contract design; the current shared system-summary contract has no such visibility mechanism.

Before implementation, decide the setting's exploration era, distance/region model, whether non-human presence is authored or generated, contact/discovery rules, and language/script ownership. Future naming metadata and Nova rendering requirements should follow those decisions in a separately reviewed additive contract. Keep the current `displayName`, `settlementName`, and `aliases` semantics unchanged in this documentation pass.

### Illustrative names, not approved cultural content

These earlier English-language/original-fiction sketches are **not final assignments**. The separate 100-system review preview below adds diverse language/script sketches, but they are **not verified translations, culturally authentic examples, legally cleared names, or approved assignments**.

- **Lantern Reach:** arrival, welcome and a settlement-style place name.
- **Copper Vale:** landscape metaphor; does not assert an actual habitable valley.
- **Quiet Meridian:** landscape/navigation imagery.
- **Open Accord:** shared civic aspiration.
- **Patient Horizon:** optimism and long-duration exploration.
- **Signal Hearth:** a gentle science-fiction homage to communication and belonging.

An illustrative combined label is `Lantern Reach (GJ 9066)`. This does not reserve the name for that system.

## 5. All-ages and safe science-fiction review

Apply automated screening followed by human approval of every complete name and combined label:

- Reject profanity, slurs, sexual meanings, drug references, graphic violence, hateful symbols, frightening cruelty, and suggestive wordplay inappropriate for children.
- Review case folding, spacing, punctuation removal, transliteration, diacritic folding, likely pronunciations, homophones, and unintended word boundaries. Check relevant languages and scripts with qualified reviewers; no automated blocklist can guarantee global safety.
- Treat short substrings as review flags, not automatic proof of obscenity. For example, the real designation `24 Sex` is a constellation abbreviation in the local snapshot; do not corrupt or censor immutable source identifiers to satisfy a naive filter. Review the full context and document exceptions.
- Flag multilingual ambiguity or later-discovered harmful associations for editorial resolution. Retain the prior decision and audit trail; never silently reroll names at runtime.
- Reject control/bidirectional override characters and invisible spoofing characters; render names as plain text, never HTML.

Include science-fiction **motifs**: patient generation voyages, cooperative first contact, observatories, beacons, robotics, discovery and hopeful futures. Do not copy distinctive franchise planets, factions, characters, catchphrases, or curated fan-wiki name lists. Do not scrape unlicensed name datasets. A generic-looking word can still need trademark/context review.

Specific literary references require documented rights/public-domain checks for the relevant jurisdiction and edition, and human approval; public-domain source text does not clear later adaptations or trademarks. Default to original thematic homages. No franchise clearance is implied by the examples above.

The current bank v3 records the approved wording **Asimov's Beacon**, **Le Guin's Horizon**, **Butler's Reach**, **Clarke Meridian**, **Bradbury's Hearth**, **Jemisin Accord**, and **Liu Cixin's Signal**. Their English editorial and all-ages content review is approved; the owner accepted unresolved rights risk without claiming legal clearance. They remain unassigned. The preview repeats each once and carries this status explicitly.

## 6. Identity, deterministic assignment and persistence

### Immutable identity and precedence

Never derive IDs from a new name. Preserve system IDs, star/planet IDs, source keys, catalog designations and links, parent/anchor IDs, `spatial.solarSystemId`, seeds, positions, and save references. `catalog-identity.js` concerns celestial source bindings; do not repurpose it as a system-name heuristic.

Proposed resolution order:

1. Protection/eligibility gate.
2. Reviewed explicit override by canonical system ID, including an explicit “keep catalog label.”
3. Previously approved persisted assignment.
4. Newly proposed deterministic assignment, usable only after review/publication.
5. Existing proper/catalog fallback.

Keep overrides separate from generated output and import snapshots. They must survive restart, refresh, reordering and generator upgrades. Validate dangling IDs, duplicate overrides and protection conflicts before publication; never resolve these by last-write-wins.

### Reproducible assignment procedure

1. Freeze eligible IDs, protected names, approved candidates, policy, normalization rules and source snapshot digests.
2. Record an explicit algorithm version, bank version, policy version, fixed seed and hash/encoding specification. Do not use current time, database order, ambient locale, runtime randomness or network data.
3. Load existing assignments/overrides first and reserve their names, plus protected names and retained historical aliases.
4. Process only unassigned eligible IDs in a specified bytewise ID order. Rank complete candidates by SHA-256 of a canonical tuple `(algorithmVersion, seed, systemId, candidateId)`, with candidate-ID tie-break. Apply documented style/editorial balance constraints deterministically.
5. Choose the highest-ranked available approved candidate; try the next on collision. If none remain, report exhaustion and preserve the catalog label. Do not append random numbers or generate unreviewed compounds.
6. Emit a proposal manifest recording system ID, exact original designation, candidate ID, name, versions, input hashes, selection reason, review status and prior assignment. Persist the approved manifest under version control; runtime loads approved results, not a live lottery.

A clean run with identical complete inputs must be byte-reproducible. **Incremental growth uses the persisted manifest:** inserting an earlier-sorting system or adding candidates must not reshuffle existing assignments. A scratch rebuild without the previous manifest is not a supported stable migration. Bank/policy upgrades propose changes only for unassigned systems unless an explicit rename migration is approved.

Recommended implementation design: a small pure naming resolver and a separate offline proposal/report tool. Retain `data/exoplanet-names.json` as the existing exoplanet runtime projection where compatible; keep richer provenance, protections, assignments and overrides in a proposed system-wide naming manifest so HYG systems are covered too. Exact new artifact names/shape are implementation-review decisions, not files created here. Do not hide combined presentation strings in source fields.

### Normalization and collisions

Preserve original display text and original catalog spelling. Store reviewed names in Unicode NFC. Version comparison/search rules separately: Unicode case folding, normalized whitespace and punctuation, plus secondary diacritic/transliteration keys and confusable-script flags. Pin Unicode behavior or fixtures so upgrades cannot silently alter uniqueness.

Require unique new system-name comparison keys across the registry, not merely unique combined labels. Check existing proper names, aliases, and pending assignments; flag near-homophones and visual confusables for review. Avoid visually deceptive cross-script spellings. Secondary accent-fold collisions require review, not destruction of authentic spelling. Never reuse a retired name automatically. System merges/splits or upstream ID corrections need explicit identity reconciliation preserving lineage; do not change game IDs to accommodate naming.

## 7. Display, search, contracts and related labels

Implemented additive API semantics: `displayName` is the authoritative combined label for assigned systems, `catalogName` remains the exact original designation, `settlementName` is the nullable bare name, and `aliases` is an array of searchable source/historical labels. At the prior disabled checkpoint existing display labels were unchanged and `settlementName` was null; see Section 12 for the subsequently authorized activation and process status.

- Assigned systems always display `Assigned Name (Original Catalog Designation)`, including maps, lists, details, navigation, tooltips and accessible labels. Never double-wrap a label already composed. Protected and unassigned systems retain their existing proper/catalog label rather than `Sol (Sol)` or invented placeholders.
- Preserve all source aliases and historical game names in an audited alias record with provenance and status. Search new names, combined labels, original catalog names, source aliases and prior published names; use exact canonical IDs for get/navigation and mutation. List search returns all matching systems, not an arbitrary alias resolution.
- Align in-memory and DB search deliberately; preserve paging/filter order and stable ID tie-breaks. Renaming intentionally changes alphabetical ordering and may move offset pages; coordinate a versioned rollout and consumer cache invalidation.
- Search is a literal substring over each label independently. Queries and labels use the shared `normalizeAlias` rules: NFC, trimmed/collapsed whitespace, and `toLocaleLowerCase('en-US')`. Accents remain significant; there is no transliteration, diacritic removal, or script folding. One- and two-character queries are valid. Mongo stores the normalized search-term projection during registry sync/upsert, so older cache records acquire it on the next full registry synchronization; the regex substring query remains unindexed, as it was before this gate, and must be monitored before the cache grows materially. The projection never rewrites source display/catalog spellings.
- Use one backend resolver/formatter for registry and persisted projections. Updating only MongoDB or only `exoplanet-names.json` would leave HYG/list/get paths inconsistent. Restart or explicitly invalidate relevant naming/registry caches when publishing a manifest.
- Audit the OpenAPI index, solar-system module and referenced request/response schemas and examples. Update `api/openapi.yaml` and affected modular/schema artifacts in the implementation pass; do not introduce a second root contract file. Account for strict schema/additional-property rules and persisted-field handling before adding metadata.
- System labels must not automatically cascade into star/planet `displayName`. Existing planet proper names (including all 29 curated exoplanet names), catalog aliases, Roman numerals, discovery references and body IDs remain unchanged. UI context can show an unchanged planet label alongside its newly named system. Audit market/gate/NPC and saved navigation labels for stale text without reseeding those entities.
- Exoplanet system naming is presentation-only and is excluded from `getExoplanetSystemSeedHash`. `test/exoplanet-catalog-cache.test.js` verifies that changing a system presentation name changes neither the physical/body seed hash nor generated bodies. Preserve this guard: do not copy settlement labels into body records or bump body-generation seed versions for naming. Solar-system registry/search projection sync is separate from celestial-body seeding.

Nova owns frontend structure and implementation. Backend handoff supplies explicit field semantics, combined examples, alias-search rules, ordering/cache effects and rollout version; it does not prescribe Angular architecture.

### Backend multilingual search readiness gate (2026-11-05)

- Implemented one shared matching/projection helper for registry and Mongo search, reusing the naming manifest's `normalizeAlias` definition. Unicode is NFC-equivalent; whitespace is trimmed/collapsed; casing is English-locale lowercase. Turkish dotted-I therefore remains distinct from plain `i` (`İstanbul` matches `İST`, not `istanbul`). Accents are significant. Arabic, Devanagari, and CJK are matched as literal Unicode substrings, without guessed transliteration.
- Any non-whitespace search length is accepted, including one or two characters; a whitespace-only query does not filter. Regex punctuation is escaped for Mongo. Fields are matched independently (no concatenation boundary matches) across `id`, display name, settlement name, catalog name, aliases, primary-star proper name, and spectral type.
- The Mongo `searchTerms` field is an internal normalized projection, not a public API field. Registry sync includes it in the sync hash and replaces existing cache rows when the projection changes; direct upserts also maintain it. This refreshes prior persisted records without destructive normalization of the original labels. Mongo's regex substring lookup still has no index and retains the prior collection-scan characteristics; it does not fetch the whole collection into Node for filtering. Monitor that existing cost if cache scale changes.
- Contract documentation is in `api/openapi/solarsystem/openapi.yaml` and `api/schemas/solar-system-list-request.schema.json`; the root `api/openapi.yaml` references those modular sources and the response schemas. Runtime comparison and validation outcomes are recorded in the handoff summary.
- Focused validation on 2026-11-05: `node --test test/solar-system-search.test.js test/solar-system-db-search.test.js test/solar-system-list-message-handler.test.js` — **21 passed, 0 failed**; `npx eslint` on the changed backend JS and tests — **passed**; `npx tsc --noEmit -p tsconfig.checkjs.json` — **passed**. `npm test` — **784 passed, 0 failed**; its `@apidevtools/swagger-cli validate api/openapi.yaml` stage reported **valid**. Node unit tests exercise matching and Mongo query construction with mocks; no live Mongo integration test was run.
- Local runtime contract comparison: **exact match after CRLF-to-LF normalization**, HTTP 200, for `http://localhost:3000/openapi.yaml` ↔ `api/openapi.yaml`, `http://localhost:3000/openapi/solarsystem/openapi.yaml` ↔ `api/openapi/solarsystem/openapi.yaml`, and the referenced list request, list response, and get response schemas at `http://localhost:3000/openapi/schemas/solar-system-{list-request,list-response,get-response}.schema.json`. The master index points to modular contract/schema refs; it need not duplicate their field summaries. No unexpected contract drift was observed. No separate root-level `openapi.yaml` exists; workspace source is `api/openapi.yaml`.
- Frontend readiness remains open. Use the bounded follow-up in `docs/nova-prompt-naming-readiness-2026-11-05.md`; actual app rendering, authenticated screen tests, accessibility/RTL checks, and supported-platform verification remain Nova-owned gates.

### Future planet naming: reuse and system/planet combinations

Planet naming is a later, separately approved scope. Support both systematic designations and independent proper names: `Sol III` can refer to `Earth`, while another planet may retain only its systematic designation or receive a unique community-given name. These examples express future naming semantics, not new aliases or fields implemented today.

Reuse system naming's reviewed content, provenance, cultural/all-ages checks, and stable assignment principles where appropriate, but do not require a planet's name to repeat its system name or draw from the same language or theme. A future display could show `Earth (Sol III)` or contextual `Earth — Sol`; unnamed planets could use an approved system-plus-designator convention. Exact formatting remains undecided. Compose labels from structured name/designation components, not the already combined system `displayName`, to avoid nested catalog parentheses.

Keep source exoplanet letter designations intact: discovery letters are not guaranteed orbital order and must not be mechanically converted to Roman numerals. Record any game-specific ordinal separately and do not silently renumber it when planets are discovered or orbital data changes. Preserve canonical body IDs and parent links regardless of label.

Proper planet names may recur in different systems; future uniqueness and search rules should distinguish planets by canonical ID and system context rather than forcing galaxy-wide unique names. A system rename may update a contextual label through an explicit presentation policy, but must not overwrite an independently assigned planet name, mutate source designations, or regenerate bodies. No planet renaming, alias migration, contract change, or reseeding is authorized by this note.

## 8. Dry run, staged rollout and rollback

1. **Inventory only:** reconcile the reported 621 with the verified 4,845 registry and intended deployment. Produce a frozen pilot ID list and a protected/eligible/review breakdown. No writes or catalog refresh.
2. **Content preparation:** approve initial banks, provenance, cultural and all-ages reviews, sci-fi rights checks, normalization rules and overrides.
3. **Offline dry run:** produce human-readable and machine-readable reports before enabling runtime use. Include input/version digests, counts by source/eligibility/style/lane, before/after/combined labels, aliases, reasons, collisions, exhausted stock, unresolved reviews, changed existing assignments and dangling IDs. Include an explicit zero-change assertion for protected systems and all non-name data. The 100-row preview in `data/system-naming-100-review-preview.json` and `docs/system-naming-100-review-preview-2026-11-05.md` is deliberately a separate proposal-only artifact: pattern recognition nominates, but does not approve, each system; no approved eligibility or assignment is created.
4. **Review and contract gate:** humans sign off the exact assignment diff; Forge validates backend contracts and tests; Nova verifies consumer handling. Unexpected pre-existing drift is reported, not auto-fixed.
5. **Small pilot:** enable a pinned approved manifest for a representative explicit ID allowlist, including GJ 9066 if approved, with both catalog-fed and eligible HYG cases if available. A pilot is not permission to rename an ambiguous proper name.
6. **Expand:** verify save/navigation continuity, list/get/search parity, persisted projections, cache invalidation and no body reseeds; then expand in reviewed batches. Monthly refresh reports new or orphaned IDs without modifying editorial artifacts.
7. **Rollback:** pin the prior approved manifest/version or disable the naming overlay; invalidate caches and resynchronize only name-owned system projections from recorded before-images. Preserve identity, aliases and audit history. Revert any additive search/contract behavior through a coordinated compatible deployment, not data deletion. Do not restore an entire world database or rerun planet generation to undo names.

Stop expansion for a protected-name rename, unsafe name, missing provenance, contract mismatch affecting consumers, existing-name reshuffle, or any non-name mutation. A safety withdrawal uses a reviewed replacement or original catalog fallback, never an unreviewed random replacement.

## 9. Concrete acceptance criteria and future tests

These are implementation requirements, **not tests executed for this documentation task**.

- **Eligibility:** Exact approved ID manifest controls assignment. Regex-only positives fail closed. Protect Sol, Alpha Centauri, Sirius, Barnard's Star, Cygnus X-1, Veritate and Pherkad Minor; default-protect Wolf 359/Lalande 21185. Missing/contradictory provenance stays unchanged.
- **Formatting:** Approved GJ 9066 example becomes exactly `Assigned Name (GJ 9066)`; original case preserved, no double parentheses. Proper/unassigned labels unchanged; null catalog designation blocks assignment pending review.
- **Determinism:** Golden proposal digest for fixed inputs; identical output across reordered source data, repeated runs, restart and supported Node environments. Different seeds/versions recorded explicitly.
- **Stability:** Adding/removing unrelated systems or candidates does not change published assignments. Overrides survive refresh. Missing IDs and upstream merges/splits are review errors; rollback restores prior labels exactly.
- **Collisions:** Case/spacing/punctuation, NFC/decomposed Unicode, accent-fold and transliteration fixtures; protected/historical name reservations, confusables, deterministic collision retries and exhaustion without suffix invention.
- **Safety/provenance:** Unapproved, withdrawn, untranslated/uncertain or rights-uncleared candidates cannot publish. Test multilingual flags, false-positive substring review, invisible controls and plain-text rendering. Human reviews remain required beyond tests.
- **Identity/data:** Compare all IDs, links, seeds, orbits, physics, references, counts and planet/star names before/after; only approved system-name-owned fields differ. Naming-only changes never trigger celestial reseed or alter procedural golden outputs.
- **Runtime/persistence:** List/get and persisted system projections agree with and without MongoDB; restart/cache reload retains assignments; startup sync cannot erase overrides.
- **Search/paging:** New/bare/combined/catalog/alias/old-name searches resolve the same IDs; ambiguous aliases remain multiple results. Filtering then sort/paging and ID tie-break remain stable for a pinned naming version.
- **Contract:** Validate affected OpenAPI/schema examples and responses, strict consumers, combined label semantics and aliases. Compare runtime served index, relevant modules and referenced schemas against workspace/repository artifacts before release.
- **Rollout:** Dry run performs zero writes; pilot touches only approved IDs; rollback restores exact prior name projections and preserves body/save data.

Extend existing `test/solar-system-list-message-handler.test.js`, `test/solar-system-get-message-handler.test.js`, `test/exoplanet-catalog-runtime.test.js`, `test/exoplanet-catalog-cache.test.js`, `test/hyg-star-catalog.test.js`, `test/procedural-system-generator.test.js` and `test/solar-system-celestial-seed.test.js`; add focused pure naming/manifest tests and persistence sync coverage. Keep the existing refresh-does-not-write-names guard. Future implementation must end with `npm test` (or an explicitly justified Node test command), plus affected contract validation and required integration checks.

## 10. Historical implementation status, contract check and handoff

The implementation/review results in this section record earlier gates. Empty-assignment, pending-eligibility and content-only approval statements describe those historical snapshots, not the current approved-disabled manifest. Section 12 supersedes their current approval status and validation totals. Preserve the old JSON reports and their original input hashes.

Implemented artifacts:

- Shared runtime resolver: `src/model/system-naming.js`, integrated into the authoritative registry. The reviewed eligibility/protection manifest is `data/system-naming-manifest.json` and is fail-closed. At this earlier implementation checkpoint it contained zero approved assignments and was disabled; see Section 12 for the later 25-entry approval and activation.
- Candidate bank: `data/system-naming-candidates.json`. Original fictional names remain unapproved. The seven author-honoring candidates have user-approved wording and English-language all-ages review, with owner authorization accepting unresolved rights risk, not legal clearance. These candidate records are not consumed by runtime.
- Offline generator: `node scripts/dry-run-system-naming.js`. It enumerates the complete registry, verifies reviewed source-snapshot digests and candidate-bank validity, records input digests and lane/style counts, uses deterministic hash-ranked candidate selection with normalized collision reservations, and writes `data/system-naming-dry-run-proposal.json`. The report includes exhaustion/collision counts and zero-change assertions for identities, protected labels, non-name fields and physical bodies. It has no database write path.
- Separate 100-system review preview: `node scripts/dry-run-system-naming-100-review.js` writes `data/system-naming-100-review-preview.json` and `docs/system-naming-100-review-preview-2026-11-05.md` from the checked-in catalog and `data/system-naming-review-bank-v1.json`. It keeps the existing GJ 9066 / Copper Vale proposal fixed, selects 99 more records reproducibly by versioned SHA-256 rank, records exact source designation and source-evidence digest on each row, and reserves catalog/proper/alias/approved labels. Every added row is explicitly `decision: not-decided`; the tool does not write eligibility into the approved manifest or consume MongoDB. Its 76 English names comprise 69 original proposals and the seven previously approved author tributes; 24 provisional entries span 12 other languages/scripts. The language and lane mix is an editorial sample, not a population, geopolitical weighting, expedition history, or launch metric. All non-English glosses/transliterations await knowledgeable-speaker, cultural, pronunciation and all-ages review; no reviewer signoffs are recorded.
- Weighted review-only batch v2: `node scripts/dry-run-system-naming-weighted.js` writes only `data/system-naming-weighted-batch-v1.json` and `docs/system-naming-weighted-allocation-2026-11-05.md`. It uses `data/system-naming-weight-policy-v2.json`, `data/system-naming-weighted-landmark-supplement-v1.json` and the explicit continuity plan `data/system-naming-weighted-batch-plan-v2.json`. The separate supplement leaves the v1 bank and 100-system review-preview inputs unchanged. It freezes all 25 selected system IDs/slot indices and pins all 20 previously filled name-to-system pairs by stable IDs and candidate names; only the five previously empty Mandarin, Russian and French slots receive new candidate selections. The result is 25/25 filled with the same Hamilton quotas. Its five Earth-remembrance contents have user-approved editorial selection dated 2026-11-05, accurate explicit language tags, and recorded Earth references; independent linguistic/cultural/context and all-ages verification remain pending. No legal clearance, source eligibility approval, assignment authorization or publication is asserted. All rows remain review-only and runtime-disabled.
- No database drop is needed for this offline work or a future name-only registry update. The existing startup `syncSolarSystems` hashes and refreshes the `solar_systems` projection by stable `id`, rebuilding its `searchTerms`; verify the intended registry snapshot first because sync also removes IDs absent from that snapshot. The naming manifest is loaded once per Node process, so a separately approved manifest change requires a coordinated process restart, after which registry sync can refresh persisted labels/search terms. Do not refresh or drop celestial-body collections for a name-only change; the system-name/body-seed invariant is covered by the focused seed-hash test.
- Focused test: `test/system-naming-100-review-preview.test.js` checks exact 100-row cardinality, distinct current catalog IDs and names, original designation fidelity, source evidence, protected-name exclusion, pending-only state, fixed GJ 9066 continuity, author-tribute uniqueness, byte-stable generated artifact and selection independence from registry input order.
- Focused weighted allocation tests: `test/system-naming-weighted-allocation.test.js` cover invalid counts/policies, integer Hamilton arithmetic and tie order, deterministic candidate ranking, collision rejection, exact preservation of all 20 prior name-to-system pairs and all 25 system slots, the five approved content selections and their review limits, frozen-lock rejection cases, protected prior artifact bytes, output semantics and registry-order independence.
- Runtime system summary adds `settlementName` and `aliases`; search includes display, settlement, catalog, alias, ID, and primary-star fields in the registry and MongoDB service. Editorial provenance remains internal and is never returned.
- The naming manifest is loaded once per Node process. Publishing any future reviewed manifest requires a coordinated process restart; do not assume `clearRegistryCache()` reloads the required JSON module or publish through runtime mutation.
- Body seed hashing excludes system-name-only changes. No star, planet, physical data, ID, or name in `data/exoplanet-names.json` was changed.

Dry-run result for the pinned local catalog: **4,845 systems** (3 curated, 4 procedural, 4,838 exoplanet catalog); 1 explicitly reviewed eligible pilot, 162 protected, and 4,682 needs-review. The one pending proposed assignment is `Copper Vale (GJ 9066)` for canonical ID `exo-gj-9066`; the exact original designation is `GJ 9066`. The candidate, all-ages, and rights reviews remain pending. This is an editorial proposal, not clearance or publication. All other systems remain unchanged. The author's proposals are separately recorded and cannot be selected as runtime candidates.

The workspace has **no root `openapi.yaml`**. The canonical workspace/runtime source is `api/openapi.yaml`, modular solar-system contract `api/openapi/solarsystem/openapi.yaml`, and referenced schemas under `api/schemas/`. Updated both response schemas and the modular contract. Runtime-vs-workspace check: **matched the affected artifacts**, as detailed below. Repository-main parity and the full runtime schema audit are not claimed. If localhost is unavailable, compare the GitHub fallback without auto-fixing unexpected drift.

Final validation commands/results: `node scripts/dry-run-system-naming.js` generated the deterministic proposal for 4,845 systems with 1 pending proposal and 0 approved; `npm test` passed OpenAPI validation and all **772 Node tests** (0 failures); targeted `npx prettier --check` and `git diff --check` passed. The repository handler-pattern check emitted two existing advisory warnings. Runtime HTTP GETs returned 200 and matched the workspace text (after CRLF normalization) for `/openapi.yaml`, `/openapi/solarsystem/openapi.yaml`, and both `/schemas/solar-system-{list,get}-response.schema.json` artifacts. This verifies runtime/workspace match for the affected contract artifacts; GitHub main/repository-main parity was not fetched because localhost was available. No unexpected drift was found. The focused Mongo-backed runtime test ran successfully as part of the suite; catalog refresh was not run because it can mutate source data.

### Nova handoff checklist

Additional verification: `npm run typecheck` passed; ESLint on all changed JavaScript files passed after correcting the candidate control-character check; `node --test test/system-naming.test.js test/solar-system-db-search.test.js test/exoplanet-catalog-cache.test.js test/solar-system-get-message-handler.test.js test/solar-system-list-message-handler.test.js` passed all **28 tests**.

- Weighted allocator follow-up validation recorded before the landmark supplement: the earlier v1 preview had 20 filled proposals and 5 shortages. This v2 work supersedes only that weighted report; it does not regenerate the 100-system preview or the separate single-pilot report. Final NEXT STEP1 validation: `node --test test/system-naming-weighted-allocation.test.js test/system-naming-100-review-preview.test.js` passed **8 tests**; `npx eslint scripts/dry-run-system-naming-weighted.js src/model/system-naming-weighted-allocation.js test/system-naming-weighted-allocation.test.js` passed without warnings; `npm run typecheck` passed. The focused tests verify all prior pairings/system slots, invalid frozen-plan references, prior-artifact hashes and deterministic report output. The full `npm test` suite was not run for this offline-only step. No OpenAPI files, runtime assignments, catalog data or celestial records were changed by this work.

- [x] Pull the additive contract changes in `api/openapi.yaml`, `api/openapi/solarsystem/openapi.yaml`, and both solar-system response schemas.
- [ ] Keep IDs canonical and names presentation-only; never navigate or mutate by alias.
- [ ] Treat `displayName` as the sole authoritative user-facing system label; do not compose it with `settlementName` a second time.
- [ ] Treat `settlementName: null` as “no approved name enabled,” not as a request to synthesize a name. Keep `aliases` an array and use it only for search/display matching.
- [ ] Do not consume dry-run artifacts as runtime assignments. The exact 25 assignments are owner-accepted in the disabled manifest; publication still needs separate authorization.
- [ ] Keep star/planet labels and celestial identity/data unchanged; no frontend-generated names.
- [ ] Preserve existing search, filters, stable ID tie-break and paging behavior; list search may return multiple matching systems.

### Human follow-up required before publishing any name

#### Approved gate: weighted proposal review and landmark selections

On 2026-11-05, the user confirmed review of the weighted proposals and approved the five Earth-landmark candidates below to address the remaining language-bank shortages. The weighted proposal/content-selection gate is **approved**. This records the user's editorial decision; it does not assert independent linguistic/cultural verification, legal clearance, source-eligibility approval, or runtime publication authorization.

| Policy bucket | Approved candidate spelling | Supporting transliteration / Earth reference |
| ------------- | --------------------------- | -------------------------------------------- |
| Mandarin      | 泰山                        | Tàishān; Mount Tai                           |
| Mandarin      | 黄山                        | Huángshān; Huangshan mountain range          |
| Mandarin      | 天山                        | Tiānshān; Tian Shan mountain range           |
| Russian       | Байкал                      | Baykal; Lake Baikal                          |
| French        | Mont Blanc                  | Mont Blanc; Alpine mountain                  |

These establish an approved editorial **Earth remembrance** naming lane: communities may commemorate an Earth landscape without claiming similar terrain at the destination. Preserve original-language spelling; transliterations are supporting text, not additional English suffixes. Geographic location does not imply exclusive national ownership. Sacred, historical, and cross-border associations still need accurate provenance and appropriate review.

**NEXT STEP1 completed:** the five contents were added to the separate `data/system-naming-weighted-landmark-supplement-v1.json`; the prior v1 review bank, single-pilot report, and 100-system preview inputs were left unchanged. The v2 policy and frozen batch plan regenerate `data/system-naming-weighted-batch-v1.json` and its Markdown report as a complete 25/25 offline proposal. All 20 prior candidate-to-system pairings and all 25 selected system IDs/slot indices are preserved. The report records the supplement version/digest and per-candidate provenance and remains a historical proposal snapshot; its pending/disabled statuses are not the current manifest state (Section 12).

The user-approved scope is editorial proposal/content selection only. The new candidates have not received independent native-speaker, linguistic, cultural, context, or all-ages verification. No legal clearance is asserted. Do not interpret candidate-content approval as source eligibility or assignment authorization.

At this historical gate, Mongo search/projection synchronization and publication/rollback verification were pending. Section 12 records their subsequent isolated verification. Remaining release gates are Nova's authenticated actual-screen confirmation and explicit authorization for live activation. Keep `settlementName` unchanged. No further exploration-era or non-human-language decisions are prerequisites for this pilot.

On 2026-11-05, the user approved the author-honoring wording: **Asimov's Beacon**, **Le Guin's Horizon**, **Butler's Reach**, **Clarke Meridian**, **Bradbury's Hearth**, **Jemisin Accord**, and **Liu Cixin's Signal**. The user subsequently approved the English-language all-ages review and explicitly accepted unresolved rights risk as project owner without claiming legal clearance. Candidate bank version 3 records `editorialStatus: "user-approved"`, `allAgesStatus: "user-approved-english-language-review"`, `rightsStatus: "owner-authorized-risk-accepted-not-legally-cleared"`, and `approved: true` for these seven entries. This is candidate-content approval only: no system assignment or runtime publication is authorized. It is not multilingual safety certification, estate permission, or completed legal review. Stable candidate IDs are retained, including `author-bradbury-horizon`, whose display wording is now Bradbury's Hearth. English possessives are optional, not a template for every linguistic tradition.

- The owner has accepted the exact 25 weighted entries and frozen source evidence (section 12); the single-pilot report remains a historical snapshot.
- Review every row in the separate 100-system preview; its source-backed catalog-style nominations remain undecided and do not alter the approved manifest.
- The exact weighted assignments/source eligibility are now owner-accepted; the historical proposal report is not a consumer contract or publication source.
- Editorial, context and all-ages acceptance is owner acceptance based on the preview, not independent linguistic/cultural certification. Rights risk acceptance is not permission or legal clearance.
- Obtain separate explicit live activation authorization; do not enable the manifest during this handoff.
- Review the 4,682 `needs-review` systems in explicit, evidence-backed batches; never infer eligibility from a regex or catalog ID alone.
- For an actual deployment, compare runtime `/openapi.yaml` and `/openapi/solarsystem/openapi.yaml` with workspace artifacts, and run any needed MongoDB integration checks before release.

## 11. Ready-to-use Nova prompt

Current approval/technical results: section 12. Nova's actual authenticated screen gate remains open.

> Implement frontend consumption for the backend's additive solar-system summary contract. Pull the updated workspace contract at `api/openapi.yaml`, its solar-system module `api/openapi/solarsystem/openapi.yaml`, and the schemas `api/schemas/solar-system-list-response.schema.json` and `api/schemas/solar-system-get-response.schema.json`.
>
> Exact summary fields:
>
> - `id: string` is the canonical identity and the only key for get/navigation/mutation.
> - `catalogName: string | null` is the exact original catalog designation and spelling.
> - `displayName: string` is the authoritative label to render. For a future approved/active assignment it will be `Settlement Name (Original Catalog Designation)`. Do not append the catalog name yourself or double-wrap this value.
> - `settlementName: string | null` is the bare approved name; `null` means no approved assignment is enabled.
> - `aliases: string[]` is always an array of searchable source/catalog/historical labels. It is not identity and does not guarantee unique resolution.
>
> Current examples are `Sol` with `settlementName: null`, and `GJ 9066` with `catalogName: "GJ 9066"`, `settlementName: null`, `aliases: []`. The original designation remains separately searchable through `catalogName`. `Copper Vale (GJ 9066)` and the other 24 exact weighted assignments are owner-accepted but **not live**: the manifest remains disabled. Editorial/context/all-ages acceptance is based on the preview, not independent linguistic/cultural certification. The owner accepted unresolved rights risk without claiming legal clearance. Do not display proposals as active assignments; use the authoritative runtime `displayName`.
>
> Search may match display name, settlement name, aliases, catalog designation, ID, and primary-star name/type; ambiguous matches can return multiple systems. Preserve existing filters, paging and stable ID tie-breaks. No frontend name generation or star/planet rename is in scope. Backend aliases/provenance are not a publication mechanism; editorial provenance is not exposed through the API. Keep UI architecture decisions within Nova's frontend ownership.
>
> Backend naming follow-up: `data/system-naming-weighted-batch-v1.json` is a historical review snapshot, not the current runtime manifest. The exact 25 assignments and eligibility records are owner-accepted in manifest version 2 and enabled on disk; live publication requires a human restart and verification. No additional API fields are introduced. Do not consume weighted candidate slots, source evidence or review metadata in the UI. The consumer contract and instructions above remain unchanged.

## 12. Approved-disabled technical rollout

### Authorization and prepared state

On 2026-11-05 the owner confirmed review of the **complete 25-row weighted proposal and source eligibility** and said green. This supersedes the earlier content-only gate: all exact frozen system/name pairings, explicit eligibility decisions and preview transliterations are accepted for preparation and isolated technical validation. The seven author-honoring entries retain owner rights-risk acceptance, **not legal clearance**. Editorial, context and all-ages acceptance is owner acceptance based on the preview; no independent native-speaker, linguistic or cultural certification is fabricated.

`data/system-naming-manifest.json` version 2 contains 25 explicit eligible records, their exact frozen source-snapshot digests, 25 approved assignments with stable candidate IDs/version/provenance, unchanged protections, no overrides, and only the 11 transliterations actually listed in the preview as aliases. Every entry passes the existing full source/proper-name/collision validator. Policy v2 retains the same percentages; its version identifies the mapping. No catalog, body/star/planet name, identifier, physical data or API field was changed in this validation pass.

At the earlier validation checkpoint **`runtimeEnabled` was false**: the disabled projection retained all 4,845 original display labels and null settlement names, including `GJ 9066`. Explicit aliases are deliberately resolved independently of activation: e.g. `Xingang` may find `Kepler-397` even while disabled. Rollback retains these approved aliases; it does not pretend to restore the earlier empty-alias proposal input.

**Activation update, 2026-11-05:** the owner explicitly said “go for explicit activation of 25-system pilot.” The persistent manifest now has `runtimeEnabled: true`, with no other manifest bytes changed. Its `approval.livePublicationAuthorized: false` and scope are preserved as the earlier review's historical metadata, not a record of this later authorization. The shared process was restarted while disabled before this change; it caches the manifest on load and has not been restarted for activation. Live publication and live database contents have not been observed. The enabled projection has exactly 25 approved labels and 4,820 unchanged labels.

No live publication, current game database writes/drop, service restart/stop, environment enabling switch, catalog refresh or commit was performed. No formatter was run; the parent owns the final formatting pass.

### Implementation and historical artifacts

- `getSolarSystemRegistry({ namingManifest })` accepts an explicit in-memory projection for isolated tests. It validates against raw canonical records and does not populate/replace the default runtime cache when using a cloned manifest. Tests use the enabled default and a cloned disabled manifest for rollback, without toggling the production file.
- The single-pilot dry-run generator now exports a pure `buildReport({ manifest })`; importing it does not write or format files. Its CLI remains an explicit artifact writer. Do not rerun historical artifact writers during rollout.
- `test/fixtures/system-naming-proposal-manifest-v1.json` pins the historical semantic input (`JSON.stringify` SHA-256 `1fee3560053aaa8cb2997779460a1a9df62adb702d4bb1931607a921dd9f57d7`, exactly the old weighted report's input digest). Historical single-pilot, 100-system and weighted JSON reports remain unchanged; their disabled/zero-assignment counts and hashes are snapshots, not current manifest assertions. Tests reconstruct them with the pinned input and separately validate the current 25-entry active state and disabled rollback.
- The audited startup path is `DatabaseService.syncSolarSystems` → normalized `searchTerms` → `syncCatalogCollection`. The hash includes the search projection, so existing pre-search documents are replaced even if their old registry hash was current. No protection gates were relaxed. The physical seed hash excludes presentation-only system names; body reads hit the existing seed-state/cache path.

### Actual isolated Mongo evidence

First probe: a read-only ping to the existing loopback Mongo instance succeeded. The integration connects explicitly to `127.0.0.1:27017` with a newly generated `dbName`, never `MONGODB_URI` or the default/live database. Each run checks empty initial collections, creates an ownership marker containing the exact database name and UUID, and verifies all global Mongoose models are bound to that test database in the dedicated Node test process. Missing Mongo is an explicit test failure, not a skip or in-memory success.

Successful verification database: `stellar_naming_rollout_test_ef3964f595c442d4847bb18bb626a506`; owner `ef3964f5-95c4-42d4-847b-b18bb626a506`. Cleanup checked prefix + exact ownership marker, dropped only that unique owned test database and verified it had no collections afterward. An initial fixture attempt failed because the ship schema has no `parentBodyId`; that unique database (`stellar_naming_rollout_test_c74a852b83754d15b99eb26929d5b946`) was also cleaned with the same guard. The fixture was corrected to a schema-validated barycentric saved ship/system reference; no production schema was changed.

Final rerun after adding explicit persisted non-presentation field comparisons: **1/1 passed**, database `stellar_naming_rollout_test_3af6406f511948178d755e99564ec49d`, owner `3af6406f-5119-4817-8d75-5e99564ec49d`. The same exact ownership cleanup and empty-collection verification succeeded. Final focused rerun remained **48/48**, with typecheck, lint and diff check all passing.

The test inserts the **complete 4,845-system baseline** with original labels and the old content hash, without search terms. It persists canonical bodies/seed states for GJ 9066, Kepler-397 and protected Sol, plus an actual player/character/saved ship fixture:

1. Approved-disabled full-registry sync rewrites 4,845 existing records, removes **0**, builds exact normalized search terms, keeps all original labels and null settlement names.
2. Cloned active manifest sync changes **exactly 25** labels and settlement names, removes **0**; all stable system and Mongo document IDs, source/catalog, positions, primary-star facts, seeds and counts are invariant. Every canonical non-presentation input field is compared with its persisted value.
3. Every old designation, new bare name and approved alias resolves to its expected ID. One/two-character CJK, Arabic/Hindi literals and listed aliases, decomposed NFC-equivalent accented alias input, and literal regex-injection inputs are exercised against actual Mongo queries.
4. Repeat activation is hash-skipped with 0 writes/removals. Rollback uses the complete approved-disabled projection, restores the exact stored presentation/search projection and original disabled hash; repeated rollback also skips.
5. All 25 physical seed hashes are recomputed after clearing the exoplanet cache. Generated full body digests, **5,140 persisted celestial bodies**, body/seed-state IDs and data, and saved player/ship references remain identical throughout. The real on-demand seed function returns `database-cache` for all three representative systems; write methods fail hard if called. The real get handler is also checked for original label/null settlement and no internal search/approval/provenance fields.

Sync SHA-256: disabled `02cef4b87d7f090067ee1391c632f1021b7f39c74bc5c0839aa57c524016b76f`; active `455c4fe5c6f4b7a1677b8c6a5a5cc0f75fb86ccaea549e4f004e2df7c8bf7d17`. The rollback hash equals the disabled hash. The current game database was never inspected for records or modified.

### Commands and results

Run from the repository root; none requires a game-server restart:

```powershell
node --test test-support/system-naming-rollout.mongo.js
node --test test/system-naming*.test.js test/solar-system-search.test.js test/solar-system-db-search.test.js test/exoplanet-catalog-cache.test.js test/solar-system-get-message-handler.test.js test/solar-system-list-message-handler.test.js
npm run typecheck
npm run lint
npm test
```

Results: isolated actual Mongo **1/1 passed**, directly affected tests **48/48 passed**, typecheck and repository ESLint passed. Full `npm test` passed OpenAPI validation, handler-pattern gate, and **792/792 tests**, 0 failures/skips. Two existing handler-pattern advisory warnings remain. Test-generated unrelated contract-report absolute paths were restored; no unrelated dirty edits were reverted. `git diff --check` passed.

Contract check: HTTP 200 and CRLF-normalized exact match for runtime `/openapi.yaml`, `/openapi/solarsystem/openapi.yaml`, and `/schemas/solar-system-{get-response,list-response,list-request}.schema.json` against their workspace files. The root index references modules and need not itself contain `settlementName`. No unexpected affected-contract drift; no contract edits were needed in this pass. There is no workspace root `openapi.yaml`; the actual source is `api/openapi.yaml`. GitHub main was not fetched because the preferred runtime source was available; repository-main parity is not claimed. Current running manifest/cache parity is not inferred from static contract parity, and no restart was requested or performed.

Activation-pass contract check: those same five served files match the workspace after CRLF normalization. Compared with local Git HEAD, the pre-existing workspace/runtime solar-system get/list module and the three get/list/request schemas differ: they describe the additive settlement/alias fields and literal search semantics among other schema edits. This pass did not modify those files; the intent of the earlier drift is not independently confirmed. Humans should review and reconcile `api/openapi/solarsystem/openapi.yaml` and `api/schemas/solar-system-{get-response,list-response,list-request}.schema.json` with the repository before release. GitHub main parity is not claimed.

Activation-pass validation: focused tests **48/48**, isolated Mongo **1/1**, full `npm test` **792/792**, ESLint and typecheck passed. The isolated test used a unique owned loopback database, verified its marker before dropping only that database, and left the shared game database untouched. Its first run caught the get handler's active process-cache behavior after database-only rollback; the corrected test explicitly verifies that distinction and passed. Historical preview inputs and report bytes remained unchanged.

### Operator rollout / rollback

**Current pilot status:** on 2026-11-05, following activation instructions, the user reported "we are confirmed in Nova." Live consumer confirmation is therefore recorded as user-verified, not an independently repeated backend audit. No further restart is requested for this confirmation. Future manifest changes still require a human-coordinated normal restart: `require` caches the JSON, and `clearRegistryCache()` does not reload it. The assistant did not restart the shared server or directly write its game database.

For the authorized pilot:

1. Finish Nova's authenticated **actual-screen** consumer checks (mixed scripts/RTL, exact authoritative combined labels without duplication, CJK short search, accessibility/copy). The owner has authorized this pilot; coordinate the normal restart and its database writes. Preserve `settlementName` and stable IDs; no frontend-generated names.
2. Pin the reviewed manifest/catalog/code versions and backups/before-images. Recheck all 25 source digests, protection/collision validation and contract parity; rerun the isolated command above. Stop for unexpected drift or identity/source changes.
3. The exact manifest is already `runtimeEnabled: true`. Have the human restart normally; no enabling environment variable is needed or supplied.
4. Normal startup invokes `syncSolarSystems(getSolarSystemRegistry())`. Always pass the **full canonical registry**: `syncCatalogCollection` deletes IDs absent from its input. Never pass the 25-row assignment subset, never drop a collection/database, and never force world/celestial reseeding to rename systems. Verify 4,845 records for this pinned catalog, precisely 25 label changes and 0 removals, search/get/list parity and unchanged body/save data.
5. To roll back, set `runtimeEnabled: false` in this approved manifest, perform a human-coordinated restart and let the same full-registry sync restore original labels/null settlement names and consistent search terms. Keep approved aliases/provenance, stable IDs and body/save data. No database restoration/drop or planet regeneration is required. Verify disabled hash/idempotence and expected counts. If the catalog/version differs, stop and reconcile before syncing.

After restart, verify using the existing authenticated list/get flows (not invented endpoints): baseline count 4,845, exactly 25 active labels and zero removals against a pinned before-image; old catalog designation, bare new name and listed alias each find the same ID. Examples: `GJ 9066` / `Copper Vale` → `exo-gj-9066`; `Kepler-397` / `星港` / `Xingang` → `exo-kepler-397`; `Kepler-1633` / `Маяк` / `Mayak` → `exo-kepler-1633`; `HD 66428` / `Mont Blanc` → `exo-hd-66428` (no additional approved transliteration). Aliases can already match before activation and do not by themselves prove publication. Check unchanged bodies/save references and list/get parity; stop if counts or catalog differ.

The pilot's live Nova confirmation gate is complete based on the user's report. That report does not establish a full browser/platform or assistive-technology matrix, an independently measured live 4,845-record/25-label census, or live body/save-data comparisons. Human review of deployment/runtime differences and the existing contract changes from repository HEAD remains necessary before a broader release. No additional independent certifications or legal findings are implied. Do not expand beyond the approved 25-system pilot without a separately reviewed batch.

## 13. Full-catalog review and approved-content activation gate

The owner subsequently requested a full remaining-catalog review and authorized activation **only** where a system already has explicit approved eligibility and the name content is approved and unused. The existing 25 assignments are frozen and unchanged. This section supersedes the earlier "do not expand beyond the approved 25" limit only to the extent of preparing the full-scope offline report and checking the stated activation gate; it does not authorize inferred eligibility or provisional-content activation.

`data/system-naming-full-catalog-review-v1.json` and `docs/system-naming-full-catalog-review-2026-11-05.md` account for all 4,845 checked-in registry systems:

- 25 existing approved/active assignments, unchanged (assignment digest `f4928d558e8bfe3d065dcfb0577393c0954f141ce5d3b7c9426835cfda99f9af`);
- 4,025 source-evidence-backed catalog-pattern nominations total, including the 25 existing assignments; **4,000 remaining nominations** have no explicit eligibility approval;
- 162 protected systems and 658 systems without a current catalog-pattern nomination;
- zero additional explicitly eligible unassigned systems, zero approved unused content, and **zero additional activations**.

Pattern recognition and source evidence are nomination aids, not eligibility decisions. The full-scope Hamilton quotas for the 4,000 remaining nominations are review-only (English 1,200; Mandarin 720; Russian 480; Spanish 240; Arabic 200; Hindi 200; Portuguese/Japanese/French 160 each; Swahili/Indonesian 120 each; Turkish 80; Korean/German 40 each; other reviewed traditions 80). There are **94 provisional name-to-system pairings** and **3,906 slots without candidates**. The pairings comprise 86 English, two Turkish, and one each in Arabic, Hindi, Portuguese, Japanese, Swahili and Indonesian. No quota has approved unused content ready for activation. Shortages are language-specific and are not redistributed; the English-heavy available bank does not change the approved weights. The language split does not establish system eligibility or name assignments.

`data/system-naming-full-catalog-review-candidates-v1.json` adds 18 English-draft Earth-landmark phrases for review only. They are explicitly unapproved, unassigned, and not language-origin claims about their referenced place names; source/context, all-ages, cultural and rights review remain pending. The existing five Earth-remembrance entries are already part of the frozen 25 and are not reused. Existing original-English and provisional multilingual bank material remains review-only; historical 100-system candidate-to-system pairings were not imported into the full-catalog proposal.

This pass did not alter the manifest, activate content, write a live database, change system/body/star/planet data, or modify OpenAPI/API schemas. No new contract drift was introduced; pre-existing API/schema work remains outside this naming pass and its runtime parity is not re-certified here. No server restart is needed for this pass.

Validation: `npm run test:unit` **734/734 passed** before adding provisional pairings; the final focused `node --test test/system-naming-full-catalog.test.js test/system-naming-weighted-allocation.test.js test/system-naming-approved.test.js test/system-naming-100-review-preview.test.js` passed **11/11**. Focused ESLint on the allocation/report/test files and `npm run typecheck` passed after those changes. Test-generated contract-report paths were restored to their previously clean state. Full follow-up requires humans to review the 4,000 source nominations and approve eligibility explicitly, review provisional pairings/content, and grow approved unused banks by language before any additional activation. Nova has no contract or consumer behavior change to pull from this pass.
