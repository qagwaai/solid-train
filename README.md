---
Owner: Project Maintainers
Last Verified: 2026-05-08
Status: Living
---

# solid-train

Simple Socket.IO server with Node.js.

## Requirements

- Node.js 20+
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

## MongoDB configuration

- Default (from `npm start`): `mongodb://localhost:27017/solid-train`
- If you want a different URI, run the server directly with your own env var:

```bash
npx cross-env MONGODB_URI=mongodb://localhost:27017/my-db node src/server.js
```

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

