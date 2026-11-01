---
Owner: Project Maintainers
Last Verified: 2026-05-08
Status: Living
---

# solid-train

Simple Socket.IO server with Node.js.

## Requirements

- Node.js 24+ (CI and `.nvmrc` pin 24.22.2)
- MongoDB (local default: `mongodb://localhost:27017`)

## Setup

```bash
npm install
```

## VS Code extension recommendations

This repository includes workspace extension recommendations in `.vscode/extensions.json`.
When you open the folder in VS Code, you can install all suggested extensions from the prompt.

Current recommendations focus on Node.js and this project stack:

- MongoDB for VS Code
- GitHub Copilot and Copilot Chat

## Run

```bash
npm start
```

The server listens on port `3000` by default. Set `PORT` to override.

`npm start` uses a cross-platform script (`cross-env`) and sets:

- `MONGODB_URI=mongodb://localhost:27017/solid-train`
- `LOG_LEVEL=info` (default when unset)

This works across bash, cmd, and PowerShell.

Every server startup builds a fresh contract artifact and checks it against the approved
baseline before initializing the database or listening. Startup is blocked if the baseline is
missing or contract variance is found. To inspect drift locally, run `npm run contract:artifact`
followed by `npm run contract:gate:hard`.

To make the server reachable from other devices on this PC's local network, run:

```bash
npm run start:host
```

This binds the server to `0.0.0.0` on port `3000` (or the port set by `PORT`). Connect to
`http://<this-PC's-LAN-IP>:3000` or `http://<this-PC's-LAN-IP>:<PORT>`. Your firewall must allow
connections to that port. Binding to all network interfaces can expose the server beyond your own
PC, so only use this on a trusted network.

## MongoDB configuration

- Default (from `npm start`): `mongodb://localhost:27017/solid-train`
- If you want a different URI, run the server directly with your own env var:

```bash
npx cross-env MONGODB_URI=mongodb://localhost:27017/my-db node src/server.js
```

The server loads `.env` from the working directory using dotenv. Existing process
environment values take precedence, including empty strings. A missing `.env`
file is allowed; `PORT` defaults to `3000` when unset. The dotenv 18 fast parser
is opt-in and is not enabled by the server.

## Logging levels

The server supports level-based logging via `LOG_LEVEL`:

- `error`
- `warn`
- `info` (default)
- `debug`
- `trace`

Example:

```bash
npx cross-env LOG_LEVEL=debug node src/server.js
```

At the default `info` level, high-level operational messages (for example handler/upsert flow and startup events) are logged, while diagnostic `*-diag` traces are suppressed unless `LOG_LEVEL=debug` or `LOG_LEVEL=trace`.

## Endpoints

- `GET /` - basic status text
- `GET /health` - JSON health response
- `GET /openapi.yaml` - OpenAPI source document
- `GET /docs` - Swagger UI served by the same Node/Express process
- `GET /docs/celestial-body-contract.md` - Celestial-body contract and data semantics

The expanded non-asteroid Sol performance-test catalog, its public data sources,
and refresh process are documented in [docs/sol-catalog-data.md](docs/sol-catalog-data.md).

### Cygnus X-1 catalog support

The curated `cygnus-x1` system exposes a separate black hole and HD 226868
companion through the existing Socket.IO system/body contracts. The black hole
uses the additive `black-hole` body type and surface archetype. Renderer selection
uses exact `catalogIdentity` pairs, not names or entity IDs.

After restarting with the updated code, request the system to seed its bodies
on demand; it is not seeded at startup. Existing caller-specified body limits
are preserved. See the
[Cygnus X-1 contract, request examples, and Nova checklist](docs/celestial-body-contract.md#cygnus-x-1-curated-bodies)
for availability, scientific values, authored placement, unknown global
coordinates, and the distinction between horizon/reference radii and cinematic
disk sizing. No travel routes or gates are added.

## Socket.IO events

- `welcome` (server -> client): sent on connection
- `message` (client -> server): broadcasts to all clients as `message`
- `register` / `register-response`
- `login` / `login-response`
- `character-list-request` / `character-list-response`
- `character-add-request` / `character-add-response`
- `character-delete-request` / `character-delete-response`
- `character-edit` / `character-edit-response`
- `ship-list-request` / `ship-list-response`
- `game-join` / `game-join-response`
- `mission-upsert-request` / `mission-upsert-response`
- `list-missions-request` / `list-missions-response`
- `celestial-body-upsert-request` / `celestial-body-upsert-response`
- `celestial-body-list-request` / `celestial-body-list-response`
- `invalid-session` (server -> client): emitted when session validation fails
- `launch-item-request` / `launch-item-response`

## Test

```bash
npm test
```

Run the remaining local validation checks with:

```bash
npm run typecheck
npm run lint
npm run format:check
```

ESLint uses `eslint.config.cjs` (flat configuration). Run `npm run format` to
apply the repository's Prettier formatting.

### Dependency security gate

Run `npm run security:audit` to check the locked dependency tree. High or critical
advisories fail this gate; moderate advisories are reported but do not block it.
CI also verifies reproducible installation with `npm ci --ignore-scripts`.

The `body-parser` and `qs` overrides in `package.json` pin patched versions.
When updating these pins, preserve body-parser's supported qs range and refresh
`package-lock.json`. Keep Undici and the transitive `follow-redirects` dependency
on patched versions as well; both are covered by the same audit gate.

All Node-based CI workflows use `.nvmrc`. Keep its pinned Node 24 LTS version,
the `package.json` engine requirement, and these setup instructions aligned.

Dependabot groups CodeQL action updates so `init`, `autobuild`, and `analyze`
always move together. Mixed CodeQL action versions are not supported.

Runtime JSON Schema validators use AJV 8 with full date-time and UUID format
validation through the shared schema-validator factory. The intentional
calendar-date tightening and a copy/paste Nova compatibility prompt are in
[the AJV 8 migration handoff](docs/ajv8-migration-nova-handoff.md).

## License and Commercial Use

This repository is published as source-available for review only and is not
open source.

- All rights are reserved by the owner.
- You may not copy, modify, redistribute, or use this project commercially
  without prior written permission.
- See LICENSE for binding terms.

Commercial licensing requests:

- Open an issue at https://github.com/qagwaai/solid-train/issues
- Use the subject prefix "[Commercial License]"
