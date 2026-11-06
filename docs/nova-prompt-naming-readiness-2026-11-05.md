# Nova follow-up: multilingual naming-readiness consumer gate

Use the **currently served** modular solar-system OpenAPI source and its referenced
schemas as the contract authority. Check `/openapi/solarsystem/openapi.yaml` and the
referenced `/openapi/schemas/solar-system-{get,list}-response.schema.json`; do not
infer contract fields from the root index alone or stale generated artifacts.

This is a consumer-compatibility gate only. Do not publish names, enable assignments,
refresh the source catalog, or change system/body IDs, planet/star data, or name
assignments. Use local synthetic fixtures for UI tests; fixtures are not approved
content.

Update the consumer types for the actual response shapes and additive fields:
`settlementName` (nullable), `catalogName` (nullable), and `aliases` (string array),
as well as the existing authoritative `displayName`. Confirm list and get response
types independently against their schemas.

Render the exact authoritative `displayName` without duplicating its catalog portion.
It may already be a combined `Settlement Name (Original Catalog Designation)` label.
Keep the exact combined content available for accessibility and copy/search. Use
`settlementName` and `catalogName` as structured presentation components only when
present and semantically complete; do not reconstruct a replacement label from null
or missing fields, and do not append `catalogName` to an already combined label.

Make mixed-script labels legible, with deliberate wrapping and RTL isolation that does
not reorder surrounding UI. Do not split labels with a naive parentheses regular
expression (catalog designations may contain parentheses), and do not inject Unicode
bidi control characters into authoritative names. Use appropriate markup/layout
isolation and retain the original string unchanged.

Support literal one- and two-character search labels, including CJK; do not impose a
client minimum that blocks them. Keep search as substring matching and avoid invented
transliteration or broad accent/script folding.

Validate with authenticated screen-level tests against the actual consuming views:
null `settlementName`, empty/nonempty aliases, an already-combined label, one- and
two-character CJK queries, mixed Arabic/Latin and Devanagari/Latin text, wrapping,
RTL isolation, accessibility text, and exact copy/search content. Also verify the
real app on its supported browser/platform matrix; the existing Windows Chrome
diagnostic glyph check is not evidence that the actual app is verified.

Report the exact served schema URLs/revisions consumed, type and screen-test results,
and any remaining platform or accessibility gaps. Do not change backend API fields
or naming content as part of this consumer task.

Backend handoff: the weighted naming report at
`docs/system-naming-weighted-allocation-2026-11-05.md` and its JSON artifact are
historical offline review materials. On 2026-11-05 the owner explicitly authorized
activation of the exact 25 assignments. Manifest version 2 is enabled on disk; the
shared process was last restarted while disabled and requires another human-coordinated
normal restart before active labels can be expected. Live publication is not yet
verified. After restart expect 25 combined labels; approved explicit aliases are
searchable even while disabled. No additional API fields are introduced.
No independent linguistic/cultural certification or legal clearance is asserted.
Do not consume candidate slots, provisional language content,
or unfilled-slot metadata in the UI. The contract fields and consumer requirements
above remain unchanged.
