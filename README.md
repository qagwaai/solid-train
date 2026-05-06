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

This works across bash, cmd, and PowerShell.

## MongoDB configuration

- Default (from `npm start`): `mongodb://localhost:27017/solid-train`
- If you want a different URI, run the server directly with your own env var:

```bash
npx cross-env MONGODB_URI=mongodb://localhost:27017/my-db node src/server.js
```

## Endpoints

- `GET /` - basic status text
- `GET /health` - JSON health response

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
- `add-mission-request` / `add-mission-response`
- `list-missions-request` / `list-missions-response`
- `celestial-body-upsert-request` / `celestial-body-upsert-response`
- `celestial-body-list-request` / `celestial-body-list-response`
- `invalid-session` (server -> client): emitted when session validation fails
- `launch-item-request` / `launch-item-response`

## Test

```bash
npm test
```
